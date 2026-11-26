from datetime import date
from logging import getLogger

import httpx
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import Category, Expense, ExpenseStatus, RiskLevel
from app.schemas.expenses import AnomalyReason


logger = getLogger(__name__)


## validate the model result before saving it
class AnomalyResult(BaseModel):
    expense_id: int
    score: float = Field(ge=0, le=1)
    risk_level: RiskLevel
    reason_details: list[AnomalyReason]


## send one expense to the anomaly model and return its result
def score_expense(payload: dict) -> dict:
    url = settings.ai_service_url.rstrip("/")
    response = httpx.post(f"{url}/anomaly/score", json=payload, timeout=3.0)
    response.raise_for_status()
    return response.json()


## build the same input for live scoring and batch scoring
def expense_payload(db: Session, expense: Expense) -> dict:
    ## include all other requests by this employee on the same expense date
    same_day = db.execute(
        select(Expense.id, Category.name, Expense.amount)
        .join(Category, Expense.category_id == Category.id)
        .where(
            Expense.requester_id == expense.requester_id,
            Expense.expense_date == expense.expense_date,
            Expense.id != expense.id,
        )
        .order_by(Expense.id)
    ).all()

    ## use the current category limit for the split request check
    category_limit = expense.category.expense_limit
    return {
        "expense_id": expense.id,
        "requester_id": expense.requester_id,
        "department_id": expense.department_id,
        "category": expense.category.name,
        "amount": str(expense.amount),
        "expense_date": expense.expense_date.isoformat(),
        "category_limit": str(category_limit.max_amount) if category_limit is not None else None,
        "same_day_requests": [
            {"expense_id": row_id, "category": category, "amount": str(amount)}
            for row_id, category, amount in same_day
        ],
    }


## save the result for the matching expense
def save_result(expense: Expense, result: AnomalyResult) -> None:
    if result.expense_id != expense.id:
        raise ValueError("The anomaly result belongs to a different expense.")

    expense.anomaly_score = result.score
    expense.risk_level = result.risk_level
    expense.risk_justification = [reason.model_dump() for reason in result.reason_details]


## score one request while keeping its details stable
def score_one_expense(expense_id: int, pending_only: bool = False) -> tuple[int, date] | None:
    with SessionLocal.begin() as db:
        query = select(Expense).where(Expense.id == expense_id)
        if pending_only:
            query = query.where(Expense.status == ExpenseStatus.PENDING)
        expense = db.scalar(query.with_for_update())
        if expense is None:
            return None

        result = AnomalyResult.model_validate(score_expense(expense_payload(db, expense)))
        save_result(expense, result)
        return expense.requester_id, expense.expense_date


## score the saved request, then refresh the employee's related pending requests
def score_saved_expense(expense_id: int, previous_date: date | None = None) -> None:
    scoring_id = expense_id
    try:
        scored_expense = score_one_expense(expense_id)
        if scored_expense is None:
            return

        requester_id, expense_date = scored_expense
        ## refresh the old date too if the expense moved to a different day
        dates = {expense_date}
        if previous_date is not None:
            dates.add(previous_date)
        with SessionLocal() as db:
            related_ids = db.scalars(
                select(Expense.id)
                .where(
                    Expense.requester_id == requester_id,
                    Expense.expense_date.in_(dates),
                    Expense.status == ExpenseStatus.PENDING,
                    Expense.id != expense_id,
                )
                .order_by(Expense.id)
            ).all()

        for scoring_id in related_ids:
            score_one_expense(scoring_id, pending_only=True)
    except (httpx.HTTPError, ValueError, SQLAlchemyError) as error:
        logger.warning("Could not score expense %s: %s", scoring_id, error)
