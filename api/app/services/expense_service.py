from decimal import Decimal

from app.services.decision_engine import evaluate_expense

# prepare a pending expense with its warnings and any AI result
# the caller provides employee and finance data and handles saving
def prepare_expense(
    expense_data: dict,
    employee: dict,
    category_limit: Decimal | None,
    monthly_spent: Decimal,
    monthly_budget: Decimal | None,
    anomaly_result: dict | None = None,
) -> dict:

    # collect the finance warnings and any AI result
    evaluation = evaluate_expense(
        amount=expense_data["amount"],
        category_limit=category_limit,
        monthly_spent=monthly_spent,
        monthly_budget=monthly_budget,
        anomaly_result=anomaly_result,
    )

    # new expenses start as pending
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
