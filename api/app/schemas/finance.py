"""Shapes for the finance API: what the finance admin sends, and what we send back."""
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# ---------- Departments ----------
class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120, description="Department name, must be unique.")
    manager_id: int | None = Field(default=None, description="User id of the department manager (optional).")


class DepartmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    manager_id: int | None


# ---------- Category spending limits ----------
class ExpenseLimitCreate(BaseModel):
    category_id: int = Field(description="Category this limit applies to (one limit per category).")
    max_amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2, description="Maximum amount per request in SAR.")


class ExpenseLimitUpdate(BaseModel):
    max_amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2, description="New maximum amount per request in SAR.")


class ExpenseLimitRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    max_amount: Decimal


# ---------- Monthly budgets ----------
class BudgetCreate(BaseModel):
    department_id: int = Field(description="Department this budget belongs to.")
    year: int = Field(ge=2000, le=2100, description="Budget year, e.g. 2026.")
    month: int = Field(ge=1, le=12, description="Budget month, from 1 to 12.")
    amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2, description="Budget amount in SAR.")


class BudgetUpdate(BaseModel):
    amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2, description="New budget amount in SAR.")


class BudgetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    department_id: int
    year: int
    month: int
    amount: Decimal


class BudgetUsageRead(BaseModel):
    budget: Decimal
    spent: Decimal
    remaining: Decimal
    percent: float