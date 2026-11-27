"""Request shapes for the finance API (what the finance admin sends)."""

from decimal import Decimal

from pydantic import BaseModel, Field


class DepartmentCreate(BaseModel):
    name: str = Field(
        min_length=1, max_length=100, description="Department name, must be unique."
    )
    manager_id: int | None = Field(
        default=None, description="User id of the department manager (optional)."
    )


class ExpenseLimitCreate(BaseModel):
    category_id: int = Field(
        description="Category this limit applies to (one limit per category)."
    )
    max_amount: Decimal = Field(
        gt=0,
        max_digits=12,
        decimal_places=2,
        description="Maximum amount per request in SAR.",
    )


class BudgetCreate(BaseModel):
    department_id: int = Field(
        description="Department this budget belongs to.")
    year: int = Field(ge=2000, le=2100, description="Budget year, e.g. 2026.")
    month: int = Field(ge=1, le=12, description="Budget month, from 1 to 12.")
    amount: Decimal = Field(
        ge=0, max_digits=12, decimal_places=2, description="Budget amount in SAR."
    )
