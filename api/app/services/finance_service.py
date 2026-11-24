"""Finance rules: category spending limits, monthly department budgets, and weekly spending.

These are pure calculations (no database), so they are easy to test.
The routes and the Decision Engine call them with numbers from the database.
"""
from datetime import date, datetime, timedelta
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


# ---------- Weekly spending (for the forecast) ----------
def week_start(day: date) -> date:
    """Sunday that starts the week of this day. Weeks run Sunday to Saturday."""
    if isinstance(day, datetime):
        day = day.date()
    return day - timedelta(days=(day.weekday() + 1) % 7)


def completed_weeks(today: date, count: int) -> list[date]:
    """Start dates of the last `count` completed weeks, oldest first.

    The current week is not finished yet, so it is not included.
    """
    this_week = week_start(today)
    return [this_week - timedelta(weeks=n) for n in range(count, 0, -1)]


def weekly_totals(expenses: list[tuple[date, Decimal]], weeks: list[date]) -> list[Decimal]:
    """Add up the expenses that fall inside each week (a week is its Sunday plus 6 days)."""
    totals = {start: Decimal("0") for start in weeks}
    for day, amount in expenses:
        start = week_start(day)
        if start in totals:
            totals[start] += Decimal(amount)
    return [totals[start] for start in weeks]