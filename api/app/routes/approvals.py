"""Approval chain: manager step, then finance step.

One set of routes serves both steps. Which step applies is decided by the expense's CURRENT status
(`pending_manager` -> manager step, `pending_finance` -> finance step), and the service checks the
caller holds the permission for that step. The `admin` superuser can act on either step.

The `{expense_id}` in these paths is the id of the expense request being decided.
"""
from typing import Annotated

from fastapi import APIRouter, Path

from app.core.constants import PERM_APPROVE_FINANCE_STEP, PERM_APPROVE_MANAGER_STEP
from app.core.deps import CurrentUser, DbSession, Pagination
from app.core.exceptions import not_implemented
from app.core.permissions import protected, protected_any
from app.schemas.approval import ApprovalNote, ApprovalRead
from app.schemas.common import Page
from app.schemas.expense import ExpenseRead

router = APIRouter(prefix="/approvals", tags=["Approvals"])

ExpenseId = Annotated[int, Path(ge=1, description="ID of the expense request being decided.")]

# Names live in constants.py (the workflow service needs them); descriptions live here.
STEP_PERMISSIONS = [
    (PERM_APPROVE_MANAGER_STEP, "Decide on requests at the manager step (your direct reports' requests)"),
    (PERM_APPROVE_FINANCE_STEP, "Decide on requests at the finance step"),
]
DECISION_ERRORS = {
    404: {"description": "Expense not found."},
    403: {"description": "Caller lacks the permission for the request's current step, or is not its approver."},
    409: {"description": "The request is not waiting for a decision (wrong status)."},
}


@router.get(
    "/pending",
    response_model=Page[ExpenseRead],
    summary="My pending approvals",
    **protected_any(
        STEP_PERMISSIONS,
        details=(
            "Requests waiting for a decision from the caller: their direct reports' `pending_manager` requests "
            "(manager step) and/or all `pending_finance` requests (finance step), depending on the permissions held."
        ),
    ),
)
def list_pending_approvals(db: DbSession, current_user: CurrentUser, page: Pagination):
    # Delegates to ExpenseWorkflowService.list_pending(...)
    not_implemented()


@router.post(
    "/{expense_id}/approve",
    response_model=ApprovalRead,
    summary="Approve a request",
    **protected_any(
        STEP_PERMISSIONS,
        details=(
            "Manager step: moves the request to `pending_finance` and notifies finance. "
            "Finance step: final approval - status becomes `approved` and the employee is notified."
        ),
        responses=DECISION_ERRORS,
    ),
)
def approve_expense(expense_id: ExpenseId, body: ApprovalNote, db: DbSession, current_user: CurrentUser):
    # Delegates to ExpenseWorkflowService.approve(...)
    not_implemented()


@router.post(
    "/{expense_id}/reject",
    response_model=ApprovalRead,
    summary="Reject a request",
    **protected_any(
        STEP_PERMISSIONS,
        details="Final: status becomes `rejected` and the employee is emailed. A `note` explaining why is REQUIRED.",
        responses={**DECISION_ERRORS, 422: {"description": "Missing note."}},
    ),
)
def reject_expense(expense_id: ExpenseId, body: ApprovalNote, db: DbSession, current_user: CurrentUser):
    # Delegates to ExpenseWorkflowService.reject(...)
    not_implemented()


@router.post(
    "/{expense_id}/request-changes",
    response_model=ApprovalRead,
    summary="Ask the employee to change a request",
    **protected(
        PERM_APPROVE_MANAGER_STEP,
        "Decide on requests at the manager step (your direct reports' requests)",
        details=(
            "Manager step only. Status becomes `needs_changes` and the employee is emailed. A `note` saying "
            "what to fix is REQUIRED. The employee edits and resubmits via `POST /expenses/{id}/resubmit`."
        ),
        responses={**DECISION_ERRORS, 422: {"description": "Missing note."}},
    ),
)
def request_expense_changes(expense_id: ExpenseId, body: ApprovalNote, db: DbSession, current_user: CurrentUser):
    # Delegates to ExpenseWorkflowService.request_changes(...)
    not_implemented()
