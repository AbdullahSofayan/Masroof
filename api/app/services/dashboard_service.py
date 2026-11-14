"""Aggregations behind the three dashboards."""
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.dashboard import EmployeeDashboard, FinanceDashboard, ManagerDashboard


class DashboardService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def employee_dashboard(self, user: User) -> EmployeeDashboard:
        """Totals, status counts and latest activity for the user's own requests."""
        raise NotImplementedError

    def manager_dashboard(self, user: User) -> ManagerDashboard:
        """Pending count for this manager, department totals/counts and budget usage."""
        raise NotImplementedError

    def finance_dashboard(self) -> FinanceDashboard:
        """Company-wide totals, budgets, per-department comparison, monthly series, top spenders."""
        raise NotImplementedError
