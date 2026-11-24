"""Shapes for the finance API: what the finance admin sends, and what we send back."""
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# ---------- Departments ----------
class DepartmentCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=120, description="Department name, must be unique.")
    manager_id: int | None = Field(default=None, description="User id of the department manager (optional).")


class DepartmentUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=120, description="New name (optional).")
    manager_id: int | None = Field(
        default=None, description="New manager user id. Send null to remove the manager."
    )


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


# ---------- Finance dashboard: unusual requests (ML contract C9) ----------
class RiskCounts(BaseModel):
    high: int
    medium: int
    low: int
    not_scored: int


class DepartmentRisk(BaseModel):
    department_id: int | None
    department_name: str
    flagged: int = Field(description="Requests with risk medium or high.")
    total: int = Field(description="All scored requests.")
    flagged_percent: float = Field(description="flagged / total x 100.")


class ReasonCount(BaseModel):
    code: str
    text_en: str
    text_ar: str
    count: int = Field(description="How many flagged requests have this reason.")


class AnomalySummary(BaseModel):
    counts: RiskCounts
    by_department: list[DepartmentRisk] = Field(description="Highest flagged_percent first.")
    top_reasons: list[ReasonCount] = Field(description="Top 5 among flagged requests.")


# ---------- Spending forecast (same shape as the finance frontend) ----------
class WeekActual(BaseModel):
    week_start: date = Field(description="Sunday that starts the week.")
    actual: Decimal | None = Field(
        description="Approved spending that week. null means the department had no history yet."
    )


class WeekPredicted(BaseModel):
    week_start: date = Field(description="Sunday that starts the week.")
    predicted: Decimal = Field(description="Predicted spending that week in SAR.")


class ForecastRead(BaseModel):
    department_id: int
    model: str = Field(description="Name of the forecasting model.")
    generated_for_week: date = Field(description="Sunday of the first predicted week (the current week).")
    history: list[WeekActual] = Field(description="Last 8 completed weeks, oldest first.")
    weeks: list[WeekPredicted] = Field(description="Next 4 weeks, starting with the current week.")
    baseline_last_week: Decimal = Field(description="Last completed week's total, the simple baseline.")