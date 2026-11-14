"""Budget shapes."""
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import MONEY_DECIMAL_PLACES, MONEY_MAX_DIGITS, BudgetPeriod


class BudgetCreate(BaseModel):
    department_id: int = Field(description="Department the budget belongs to.")
    period_type: BudgetPeriod = Field(description="`monthly` or `annual`.")
    year: int = Field(ge=2000, le=2100, description="Budget year.", examples=[2026])
    month: int | None = Field(default=None, ge=1, le=12, description="1-12 for monthly budgets; omit for annual.")
    amount: Decimal = Field(gt=0, max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, description="Budget amount.")


class BudgetUpdate(BaseModel):
    """Only the amount can change. To change period/department, delete and recreate."""

    amount: Decimal = Field(gt=0, max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, description="New amount.")


class BudgetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Budget id.")
    department_id: int = Field(description="Department id.")
    period_type: BudgetPeriod = Field(description="monthly or annual.")
    year: int = Field(description="Budget year.")
    month: int | None = Field(description="Month (monthly budgets only).")
    amount: Decimal = Field(description="Budget amount.")


class BudgetUsage(BaseModel):
    """How much of a budget has been consumed (approved expenses dated within the budget's period)."""

    budget_id: int = Field(description="Budget id.")
    budget_amount: Decimal = Field(description="Total budget.")
    spent: Decimal = Field(description="Sum of APPROVED expenses in the period.")
    remaining: Decimal = Field(description="budget_amount minus spent (may be negative if exceeded).")
    percent_used: float = Field(description="spent / budget_amount * 100.", examples=[72.5])
