from decimal import Decimal
from app.services.finance_service import budget_warning, limit_warning

# collect finance warnings and include the AI result when available
def evaluate_expense(
    amount: Decimal,
    category_limit: Decimal | None,
    monthly_spent: Decimal,
    monthly_budget: Decimal | None,
    anomaly_result: dict | None = None,
) -> dict:

    warnings = []

    # check the amount against the category limit
    category_result = limit_warning(amount, category_limit)

    if category_result:
        warnings.append(category_result)

    # check if adding the request would go over the department budget
    budget_result = budget_warning(monthly_spent, amount, monthly_budget)

    if budget_result:
        warnings.append(budget_result)

    # leave the AI fields empty if the caller has no result
    return {
        "warnings": warnings,
        "risk_level": (anomaly_result.get("risk_level") if anomaly_result else None),
        "anomaly_score": (
            anomaly_result.get("anomaly_score") if anomaly_result else None
        ),
    }
