"""Tests for the finance request shapes in app/schemas/finance.py.

Run from the api folder:  python -m tests.test_finance_schemas
"""

from decimal import Decimal

from pydantic import ValidationError

from app.schemas.finance import (BudgetCreate, DepartmentCreate,
                                 ExpenseLimitCreate)


def rejected(schema, **data) -> bool:
    """True if the schema refuses this data (FastAPI would answer 422)."""
    try:
        schema(**data)
    except ValidationError:
        return True
    return False


def test_budget():
    ok = BudgetCreate(department_id=1, year=2026,
                      month=11, amount=Decimal("50000"))
    assert ok.month == 11
    assert rejected(
        BudgetCreate, department_id=1, year=2026, month=13, amount=Decimal("50000")
    )  # no month 13
    assert rejected(
        BudgetCreate, department_id=1, year=2026, month=0, amount=Decimal("50000")
    )  # no month 0
    assert rejected(
        BudgetCreate, department_id=1, year=2026, month=11, amount=Decimal("-5")
    )  # negative budget


def test_expense_limit():
    ok = ExpenseLimitCreate(category_id=1, max_amount=Decimal("500"))
    assert ok.max_amount == Decimal("500")
    assert rejected(
        ExpenseLimitCreate, category_id=1, max_amount=Decimal("0")
    )  # limit must be above 0
    assert rejected(
        ExpenseLimitCreate, category_id=1, max_amount=Decimal("-100")
    )  # negative limit
    assert rejected(
        ExpenseLimitCreate, category_id=1, max_amount=Decimal("10.555")
    )  # max 2 decimal places


def test_department():
    # manager is optional
    assert DepartmentCreate(name="IT").manager_id is None
    assert rejected(DepartmentCreate, name="")  # empty name


if __name__ == "__main__":
    for test in (test_budget, test_expense_limit, test_department):
        test()
        print(f"PASS  {test.__name__}")
