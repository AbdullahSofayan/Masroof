"""Expense CRUD, visibility scoping and attachments. Status CHANGES live in ExpenseWorkflowService."""
from datetime import date

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.constants import ExpenseStatus
from app.models.approval import Approval
from app.models.attachment import Attachment
from app.models.expense import Expense
from app.models.user import User
from app.schemas.expense import ExpenseCreate, ExpenseUpdate


class ExpenseService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_expenses(
        self,
        user: User,
        page: int,
        size: int,
        status: ExpenseStatus | None,
        category_id: int | None,
        date_from: date | None,
        date_to: date | None,
        requester_id: int | None,
    ) -> tuple[list[Expense], int]:
        """List expenses the user is allowed to see.

        Scope comes from RbacService.resolve_expense_scope(user):
          OWN        -> only requests where requester == user
          DEPARTMENT -> requests of the user's department
          ALL        -> every request
        Filters narrow the result inside that scope; they can never widen it.
        """
        raise NotImplementedError

    def get_expense(self, user: User, expense_id: int) -> Expense:
        """Return the expense if it is inside the user's scope, else NotFoundError (don't reveal existence)."""
        raise NotImplementedError

    def create_expense(self, user: User, data: ExpenseCreate) -> Expense:
        """Create a request for `user` and start the workflow.

        Steps: PolicyService.validate(category, amount) -> save with the user's department ->
        ExpenseWorkflowService.on_submitted(expense) (sets pending_manager + emails the manager).
        Raise AppError(NO_MANAGER_ASSIGNED) if the user has no manager.
        """
        raise NotImplementedError

    def update_expense(self, user: User, expense_id: int, data: ExpenseUpdate) -> Expense:
        """Only the requester, only in EDITABLE_STATUSES. Re-run policy validation on changed amount/category."""
        raise NotImplementedError

    def delete_expense(self, user: User, expense_id: int) -> None:
        """Only the requester, only in EDITABLE_STATUSES. Also removes the stored attachment file."""
        raise NotImplementedError

    def list_approvals(self, user: User, expense_id: int) -> list[Approval]:
        """Decision history of an expense the user can see, oldest first."""
        raise NotImplementedError

    def save_attachment(self, user: User, expense_id: int, upload: UploadFile) -> Attachment:
        """Validate type (ALLOWED_ATTACHMENT_CONTENT_TYPES) and size (MAX_UPLOAD_SIZE_BYTES),
        store through FileStorageService, and replace any existing attachment.
        Same permission rules as update_expense."""
        raise NotImplementedError

    def get_attachment_file(self, user: User, expense_id: int) -> tuple[str, Attachment]:
        """Return (absolute file path, attachment metadata) for download. NotFoundError if none."""
        raise NotImplementedError
