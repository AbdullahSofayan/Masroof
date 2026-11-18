from decimal import Decimal

from app.services.decision_engine import evaluate_expense

# prepare expense data with financial warnings and AI results


# Later:
# -Get employee information from authentication.
# -Fetch category limits and monthly budget data from mysql
# -Save the prepared expense using SQLAlchemy.
def prepare_expense(
    expense_data: dict,
    employee: dict,
    category_limit: Decimal | None,
    monthly_spent: Decimal,
    monthly_budget: Decimal | None,
    anomaly_result: dict | None = None,
) -> dict:

    # evaluate the expense using finance rules and AI results
    evaluation = evaluate_expense(
        amount=expense_data["amount"],
        category_limit=category_limit,
        monthly_spent=monthly_spent,
        monthly_budget=monthly_budget,
        anomaly_result=anomaly_result,
    )

    # prepare the expense with pending status
    expense = {
        "requester_id": employee["id"],
        "department_id": employee["department_id"],
        "category_id": expense_data["category_id"],
        "amount": expense_data["amount"],
        "description": expense_data["description"],
        "expense_date": expense_data["expense_date"],
        "status": "Pending",
        "warnings": evaluation["warnings"],
        "risk_level": evaluation["risk_level"],
        "anomaly_score": evaluation["anomaly_score"],
    }

    # return the prepared expense without saving it
    return expense
