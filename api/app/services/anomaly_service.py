import httpx
from logging import getLogger
from app.db.session import SessionLocal
from app.models import Expense, RiskLevel
from app.core.config import settings
from sqlalchemy import select
from app.models import Category, Expense, RiskLevel

## send one expense to the anomaly model and return its result
def score_expense(payload: dict) -> dict:
    url = settings.ai_service_url.rstrip("/")
    response = httpx.post(f"{url}/anomaly/score", json=payload, timeout=3.0)
    response.raise_for_status()
    return response.json()

logger = getLogger(__name__)


## score the saved expense and store the result in mysql
def score_saved_expense(expense_id: int) -> None:
    try:
        with SessionLocal.begin() as db:
            expense = db.get(Expense, expense_id)
            if expense is None:
                return
            ## get earlier requests by the same employee on the same expense date
            same_day = db.execute(
                select(Expense.id, Category.name, Expense.amount)
                .join(Category, Expense.category_id == Category.id)
                .where(
                    Expense.requester_id == expense.requester_id,
                    Expense.expense_date == expense.expense_date,
                    Expense.id < expense.id,
                )
            ).all()

            result = score_expense({
                "expense_id": expense.id,
                "requester_id": expense.requester_id,
                "department_id": expense.department_id,
                "category": expense.category.name,
                "amount": str(expense.amount),
                "expense_date": expense.expense_date.isoformat(),
                "same_day_requests": [
                    {"expense_id": row_id, "category": category, "amount": str(amount)}
                    for row_id, category, amount in same_day
                ],
            })

            expense.anomaly_score = result["score"]
            expense.risk_level = RiskLevel(result["risk_level"])
            expense.risk_justification = result["reason_details"]

    except (httpx.HTTPError, KeyError, ValueError) as error:
        logger.warning("Could not score expense %s: %s", expense_id, error)