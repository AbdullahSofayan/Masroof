"""Department budgets."""
from typing import Annotated

from fastapi import APIRouter, Path, Query, status

from app.core.deps import DbSession, Pagination
from app.core.exceptions import not_implemented
from app.core.permissions import protected
from app.schemas.budget import BudgetCreate, BudgetRead, BudgetUpdate, BudgetUsage
from app.schemas.common import Page

router = APIRouter(prefix="/budgets", tags=["Budgets"])

BudgetId = Annotated[int, Path(ge=1, description="ID of the budget.")]
NOT_FOUND = {404: {"description": "Budget not found."}}


@router.get(
    "",
    response_model=Page[BudgetRead],
    summary="List budgets",
    **protected("budgets.list", "List department budgets"),
)
def list_budgets(
    db: DbSession,
    page: Pagination,
    department_id: Annotated[int | None, Query(description="Only this department's budgets.")] = None,
    year: Annotated[int | None, Query(description="Only budgets of this year.")] = None,
):
    # Delegates to BudgetService.list_budgets(...)
    not_implemented()


@router.post(
    "",
    response_model=BudgetRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a budget",
    **protected(
        "budgets.create",
        "Create department budgets",
        details="`month` is required for monthly budgets and must be omitted for annual ones.",
        responses={409: {"description": "A budget for this department and period already exists."}},
    ),
)
def create_budget(body: BudgetCreate, db: DbSession):
    # Delegates to BudgetService.create_budget(...)
    not_implemented()


@router.get(
    "/{budget_id}",
    response_model=BudgetRead,
    summary="Get a budget",
    **protected("budgets.view", "View a budget", responses=NOT_FOUND),
)
def get_budget(budget_id: BudgetId, db: DbSession):
    # Delegates to BudgetService.get_budget(...)
    not_implemented()


@router.patch(
    "/{budget_id}",
    response_model=BudgetRead,
    summary="Update a budget amount",
    **protected("budgets.update", "Change a budget's amount", responses=NOT_FOUND),
)
def update_budget(budget_id: BudgetId, body: BudgetUpdate, db: DbSession):
    # Delegates to BudgetService.update_budget(...)
    not_implemented()


@router.delete(
    "/{budget_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a budget",
    **protected("budgets.delete", "Delete budgets", responses=NOT_FOUND),
)
def delete_budget(budget_id: BudgetId, db: DbSession):
    # Delegates to BudgetService.delete_budget(...)
    not_implemented()


@router.get(
    "/{budget_id}/usage",
    response_model=BudgetUsage,
    summary="Budget usage",
    **protected(
        "budgets.view_usage",
        "See how much of a budget has been consumed",
        details="Spending counts APPROVED expenses of the department dated within the budget's period.",
        responses=NOT_FOUND,
    ),
)
def get_budget_usage(budget_id: BudgetId, db: DbSession):
    # Delegates to BudgetService.get_usage(...)
    not_implemented()
