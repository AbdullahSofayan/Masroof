"""Department budgets and their usage."""
from sqlalchemy.orm import Session

from app.models.budget import Budget
from app.schemas.budget import BudgetCreate, BudgetUpdate, BudgetUsage


class BudgetService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_budgets(self, department_id: int | None, year: int | None, page: int, size: int) -> tuple[list[Budget], int]:
        raise NotImplementedError

    def get_budget(self, budget_id: int) -> Budget:
        raise NotImplementedError

    def create_budget(self, data: BudgetCreate) -> Budget:
        """`month` is required for monthly budgets and must be empty for annual ones.
        One budget per (department, period type, year, month): ConflictError otherwise."""
        raise NotImplementedError

    def update_budget(self, budget_id: int, data: BudgetUpdate) -> Budget:
        raise NotImplementedError

    def delete_budget(self, budget_id: int) -> None:
        raise NotImplementedError

    def get_usage(self, budget_id: int) -> BudgetUsage:
        """Sum APPROVED expenses of the budget's department whose `expense_date` falls in its period."""
        raise NotImplementedError
