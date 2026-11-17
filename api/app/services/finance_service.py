"""Finance rules: category spending limits and monthly department budgets.

This file holds the pure calculations (no database yet).
The database layer will call these once the team's models are ready.
"""
from decimal import Decimal


def limit_warning(amount: Decimal, max_amount: Decimal | None) -> str | None:
    """Return a warning if the amount is above the category limit, else None.

    max_amount = None means the category has no limit.
    """
    if max_amount is None:
        return None
    if amount <= max_amount:
        return None
    return f"Amount {amount} SAR is above the {max_amount} SAR limit for this category."


def budget_warning(spent: Decimal, amount: Decimal, budget: Decimal | None) -> str | None:
    """Return a warning if this request would take the department over its monthly budget.

    spent  = approved spending already counted this month.
    budget = None means no budget was set for this month.
    """
    if budget is None:
        return None
    if spent + amount <= budget:
        return None
    return f"This request takes the department to {spent + amount} SAR, over its {budget} SAR monthly budget."


def budget_usage(spent: Decimal, budget: Decimal) -> dict:
    """Remaining amount and usage percentage for one department in one month."""
    remaining = budget - spent
    if budget == 0:
        percent = Decimal("0")
    else:
        percent = round(spent / budget * 100, 1)
    return {"budget": budget, "spent": spent, "remaining": remaining, "percent": percent}