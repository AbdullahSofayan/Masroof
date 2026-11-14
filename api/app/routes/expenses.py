"""Expense requests: submit, view, edit, attach a file, resubmit.

Approving / rejecting lives in `routes/approvals.py`.
Which expenses a caller SEES is decided by the highest view scope they hold
(`expenses.view_own` < `expenses.view_department` < `expenses.view_all`).
"""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, File, Path, Query, UploadFile, status
from fastapi.responses import FileResponse

from app.core.constants import (
    PERM_EXPENSES_VIEW_ALL,
    PERM_EXPENSES_VIEW_DEPARTMENT,
    PERM_EXPENSES_VIEW_OWN,
    ExpenseStatus,
)
from app.core.deps import CurrentUser, DbSession, Pagination
from app.core.exceptions import not_implemented
from app.core.permissions import protected, protected_any
from app.schemas.approval import ApprovalRead
from app.schemas.common import Page
from app.schemas.expense import AttachmentRead, ExpenseCreate, ExpenseRead, ExpenseUpdate

router = APIRouter(prefix="/expenses", tags=["Expenses"])

ExpenseId = Annotated[int, Path(ge=1, description="ID of the expense request.")]
NOT_FOUND = {404: {"description": "Expense not found, or outside the caller's visibility scope."}}
NOT_EDITABLE = {409: {"description": "The request is no longer editable (already decided or in review by finance)."}}

# The three view-scope permissions are defined in constants.py because the service
# layer needs their names to compute visibility. Descriptions live here, with the routes.
VIEW_SCOPE_PERMISSIONS = [
    (PERM_EXPENSES_VIEW_OWN, "View your own expense requests"),
    (PERM_EXPENSES_VIEW_DEPARTMENT, "View all expense requests in your department"),
    (PERM_EXPENSES_VIEW_ALL, "View every expense request in the company"),
]


@router.get(
    "",
    response_model=Page[ExpenseRead],
    summary="List expenses",
    **protected_any(
        VIEW_SCOPE_PERMISSIONS,
        details=(
            "Returns the expenses the caller is allowed to see: their own, their department's, or everyone's, "
            "depending on the highest `expenses.view_*` permission they hold. Filters narrow the result "
            "inside that scope and can never widen it."
        ),
    ),
)
def list_expenses(
    db: DbSession,
    current_user: CurrentUser,
    page: Pagination,
    status_filter: Annotated[ExpenseStatus | None, Query(alias="status", description="Filter by status.")] = None,
    category_id: Annotated[int | None, Query(description="Filter by category.")] = None,
    date_from: Annotated[date | None, Query(description="Expense date on or after this day.")] = None,
    date_to: Annotated[date | None, Query(description="Expense date on or before this day.")] = None,
    requester_id: Annotated[int | None, Query(description="Only this employee's requests (within scope).")] = None,
):
    # Delegates to ExpenseService.list_expenses(...)
    not_implemented()


@router.post(
    "",
    response_model=ExpenseRead,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an expense request",
    **protected(
        "expenses.create",
        "Submit expense requests",
        details=(
            "Creates a request for the caller. It is checked against company policy, enters the workflow as "
            "`pending_manager`, and the caller's manager is notified by email. Upload the receipt/quote "
            "afterwards with `PUT /expenses/{id}/attachment`."
        ),
        responses={
            422: {"description": "Violates an expense policy (category not allowed / amount above the limit)."},
            400: {"description": "The caller has no manager assigned."},
        },
    ),
)
def create_expense(body: ExpenseCreate, db: DbSession, current_user: CurrentUser):
    # Delegates to ExpenseService.create_expense(...)
    not_implemented()


@router.get(
    "/{expense_id}",
    response_model=ExpenseRead,
    summary="Get an expense",
    **protected_any(
        VIEW_SCOPE_PERMISSIONS,
        details="Full detail of one request, including the latest decision note (rejection / change reason).",
        responses=NOT_FOUND,
    ),
)
def get_expense(expense_id: ExpenseId, db: DbSession, current_user: CurrentUser):
    # Delegates to ExpenseService.get_expense(...)
    not_implemented()


@router.patch(
    "/{expense_id}",
    response_model=ExpenseRead,
    summary="Edit an expense",
    **protected(
        "expenses.update",
        "Edit your own expense requests",
        details="Only the requester, and only while the status is `pending_manager` or `needs_changes`.",
        responses={**NOT_FOUND, **NOT_EDITABLE},
    ),
)
def update_expense(expense_id: ExpenseId, body: ExpenseUpdate, db: DbSession, current_user: CurrentUser):
    # Delegates to ExpenseService.update_expense(...)
    not_implemented()


@router.delete(
    "/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an expense",
    **protected(
        "expenses.delete",
        "Delete your own expense requests",
        details="Only the requester, and only while the status is `pending_manager` or `needs_changes`.",
        responses={**NOT_FOUND, **NOT_EDITABLE},
    ),
)
def delete_expense(expense_id: ExpenseId, db: DbSession, current_user: CurrentUser):
    # Delegates to ExpenseService.delete_expense(...)
    not_implemented()


@router.put(
    "/{expense_id}/attachment",
    response_model=AttachmentRead,
    summary="Upload the attachment",
    **protected(
        "expenses.upload_attachment",
        "Attach a receipt/quote to your expense requests",
        details="Multipart upload. Replaces any existing attachment. Allowed types: JPEG, PNG, PDF (max 5 MB).",
        responses={**NOT_FOUND, **NOT_EDITABLE, 422: {"description": "Unsupported file type or file too large."}},
    ),
)
def upload_attachment(
    expense_id: ExpenseId,
    file: Annotated[UploadFile, File(description="The receipt / quote file (JPEG, PNG or PDF).")],
    db: DbSession,
    current_user: CurrentUser,
):
    # Delegates to ExpenseService.save_attachment(...)
    not_implemented()


@router.get(
    "/{expense_id}/attachment",
    response_class=FileResponse,
    summary="Download the attachment",
    **protected_any(
        VIEW_SCOPE_PERMISSIONS,
        details="Streams the uploaded file. The caller must be able to see the expense.",
        responses={**NOT_FOUND, 200: {"description": "The file.", "content": {"application/octet-stream": {}}}},
    ),
)
def download_attachment(expense_id: ExpenseId, db: DbSession, current_user: CurrentUser):
    # Delegates to ExpenseService.get_attachment_file(...)
    not_implemented()


@router.get(
    "/{expense_id}/approvals",
    response_model=list[ApprovalRead],
    summary="Decision history",
    **protected_any(
        VIEW_SCOPE_PERMISSIONS,
        details="Who approved / rejected / sent back the request at each step, with notes and timestamps (oldest first).",
        responses=NOT_FOUND,
    ),
)
def list_expense_approvals(expense_id: ExpenseId, db: DbSession, current_user: CurrentUser):
    # Delegates to ExpenseService.list_approvals(...)
    not_implemented()


@router.post(
    "/{expense_id}/resubmit",
    response_model=ExpenseRead,
    summary="Resubmit after changes were requested",
    **protected(
        "expenses.resubmit",
        "Resubmit your expense requests after edits",
        details=(
            "Only the requester, only from `needs_changes`. Re-checks policy, returns the request to "
            "`pending_manager` and notifies the manager."
        ),
        responses={**NOT_FOUND, 409: {"description": "The request is not in `needs_changes`."}},
    ),
)
def resubmit_expense(expense_id: ExpenseId, db: DbSession, current_user: CurrentUser):
    # Delegates to ExpenseWorkflowService.resubmit(...)
    not_implemented()
