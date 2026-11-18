from decimal import Decimal

from app.services.finance_service import budget_warning, limit_warning

# evaluate an expense and collect financial warnings and AI results.


# Later:
# -Receive financial data from expense_service after MySQL integration.
# -Use the real anomaly detection results when the AI model is ready.
def evaluate_expense(
    amount: Decimal,
    category_limit: Decimal | None,
    monthly_spent: Decimal,
    monthly_budget: Decimal | None,
    anomaly_result: dict | None = None,
) -> dict:

    warnings = []

    # check if the expense exceeds the category limit.
    category_result = limit_warning(amount, category_limit)

    if category_result:
        warnings.append(category_result)

    # check if the expense exceeds the monthly department budget.
    budget_result = budget_warning(monthly_spent, amount, monthly_budget)

    if budget_result:
        warnings.append(budget_result)

    # return financial warnings and anomaly detection results.
    return {
        "warnings": warnings,
        "risk_level": (anomaly_result.get("risk_level") if anomaly_result else None),
        "anomaly_score": (
            anomaly_result.get("anomaly_score") if anomaly_result else None
        ),
    }
