"""Dashboard response shapes (one per audience)."""
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.expense import ExpenseSummary


class StatusCounts(BaseModel):
    """Request counts grouped for display."""

    approved: int = Field(description="Requests with status `approved`.")
    rejected: int = Field(description="Requests with status `rejected`.")
    pending: int = Field(description="Requests with status `pending_manager` or `pending_finance`.")
    needs_changes: int = Field(description="Requests with status `needs_changes`.")


class EmployeeDashboard(BaseModel):
    total_requested: Decimal = Field(description="Sum of all amounts the user has requested.")
    counts: StatusCounts = Field(description="The user's requests by status.")
    recent_activity: list[ExpenseSummary] = Field(description="The user's most recently updated requests.")


class ManagerDashboard(BaseModel):
    awaiting_my_approval: int = Field(description="Requests currently waiting for this manager's decision.")
    department_total: Decimal = Field(description="Sum of requested amounts across the department.")
    counts: StatusCounts = Field(description="Department requests by status.")
    budget_percent_used: float | None = Field(
        description="Percent of the department's current budget consumed; null if no budget is set."
    )


class DepartmentTotal(BaseModel):
    department_id: int = Field(description="Department id.")
    department_name: str = Field(description="Department name.")
    total: Decimal = Field(description="Approved spending.")


class MonthlyTotal(BaseModel):
    year: int = Field(description="Year.")
    month: int = Field(description="Month, 1-12.")
    total: Decimal = Field(description="Approved spending in that month.")


class EmployeeSpend(BaseModel):
    user_id: int = Field(description="User id.")
    full_name: str = Field(description="Display name.")
    total: Decimal = Field(description="Approved spending.")


class FinanceDashboard(BaseModel):
    company_total: Decimal = Field(description="Sum of all requested amounts.")
    approved_total: Decimal = Field(description="Sum of approved requests.")
    pending_total: Decimal = Field(description="Sum of requests still in the chain.")
    rejected_total: Decimal = Field(description="Sum of rejected requests.")
    total_budget: Decimal = Field(description="Sum of current-period budgets across departments.")
    remaining_budget: Decimal = Field(description="total_budget minus approved spending in the period.")
    by_department: list[DepartmentTotal] = Field(description="Approved spending per department (for comparison and ranking).")
    monthly: list[MonthlyTotal] = Field(description="Approved spending per month (for the chart).")
    top_employees: list[EmployeeSpend] = Field(description="Highest-spending employees.")
