"""Re-score missing AI results, or all expenses after a model update."""

from argparse import ArgumentParser
from itertools import count
from sys import stderr

import httpx
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import Expense
from app.services.anomaly_service import AnomalyResult, expense_payload, save_result

BATCH_SIZE = 200


class BatchResult(BaseModel):
    results: list[AnomalyResult]


## save each batch before moving to the next page of expenses
def run(rescore_all: bool = False) -> int:
    service_url = settings.ai_service_url.strip().rstrip("/")
    if not service_url:
        raise ValueError("Set AI_SERVICE_URL before running expense scoring.")

    last_id = 0
    scored = 0
    with httpx.Client(timeout=30.0) as client:
        for batch_number in count(1):
            with SessionLocal.begin() as db:
                query = select(Expense).where(Expense.id > last_id)
                if not rescore_all:
                    query = query.where(Expense.risk_level.is_(None))
                chunk = db.scalars(
                    query.order_by(Expense.id).limit(BATCH_SIZE).with_for_update()
                ).all()
                if not chunk:
                    break

                response = client.post(
                    f"{service_url}/anomaly/score-batch",
                    json={"items": [expense_payload(db, expense) for expense in chunk]},
                )
                response.raise_for_status()
                batch = BatchResult.model_validate_json(response.content)
                results = {result.expense_id: result for result in batch.results}
                if len(batch.results) != len(chunk) or results.keys() != {expense.id for expense in chunk}:
                    raise ValueError("The anomaly service returned results for different expenses.")

                for expense in chunk:
                    save_result(expense, results[expense.id])
                last_id = chunk[-1].id

            scored += len(chunk)
            print(f"Batch {batch_number}: scored {scored} expenses.")

    return scored


def main() -> int:
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--all", action="store_true", help="Also re-score previously scored expenses.")
    args = parser.parse_args()
    try:
        scored = run(rescore_all=args.all)
    except (httpx.HTTPError, ValueError, SQLAlchemyError) as error:
        print(f"Re-scoring stopped: {error}", file=stderr)
        return 1
    print(f"Finished: {scored} expenses scored.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
