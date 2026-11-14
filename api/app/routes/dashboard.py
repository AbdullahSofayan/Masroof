"""Dashboards: one endpoint per audience."""
from fastapi import APIRouter

from app.core.deps import CurrentUser, DbSession
from app.core.exceptions import not_implemented
from app.core.permissions import protected
from app.schemas.dashboard import EmployeeDashboard, FinanceDashboard, ManagerDashboard

router = APIRouter(prefix="/dashboard", tags=["Dashboards"])


@router.get(
    "/employee",
    response_model=EmployeeDashboard,
    summary="Employee dashboard",
    **protected(
        "dashboard.view_employee",
        "View your own expense dashboard",
        details="Totals, counts by status and recent activity for the caller's own requests.",
    ),
)
def employee_dashboard(db: DbSession, current_user: CurrentUser):
    # Delegates to DashboardService.employee_dashboard(...)
    not_implemented()


@router.get(
    "/manager",
    response_model=ManagerDashboard,
    summary="Manager dashboard",
    **protected(
        "dashboard.view_manager",
        "View the department manager dashboard",
        details="Requests awaiting the caller's approval, department totals and budget usage.",
    ),
)
def manager_dashboard(db: DbSession, current_user: CurrentUser):
    # Delegates to DashboardService.manager_dashboard(...)
    not_implemented()


@router.get(
    "/finance",
    response_model=FinanceDashboard,
    summary="Finance dashboard",
    **protected(
        "dashboard.view_finance",
        "View the company-wide financial dashboard",
        details="Company totals, budget remaining, department comparison, monthly chart data and top spenders.",
    ),
)
def finance_dashboard(db: DbSession):
    # Delegates to DashboardService.finance_dashboard()
    not_implemented()
