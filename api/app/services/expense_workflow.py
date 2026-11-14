"""The approval state machine. The ONLY place that may change `Expense.status`.

    submit -> PENDING_MANAGER --approve--> PENDING_FINANCE --approve--> APPROVED
                    |    \\--request changes--> NEEDS_CHANGES --resubmit--> PENDING_MANAGER
                    \\--reject--> REJECTED          PENDING_FINANCE --reject--> REJECTED

Rules every method must enforce:
  1. The transition must exist in ALLOWED_STATUS_TRANSITIONS (else WorkflowError).
  2. The actor must hold the permission for the CURRENT step (PERMISSION_FOR_STEP), AND be the
     right person: the requester's manager at the manager step; anyone with the finance-step
     permission at the finance step.
  3. The superuser bypasses ONLY the permission check - not the status rules. When the admin acts,
     it acts on whatever step is currently pending.
  4. Reject / request-changes require a note (DECISIONS_REQUIRING_NOTE).
  5. Every decision appends an Approval row, changes status, and queues the matching email -
     in one database transaction.
"""
from sqlalchemy.orm import Session

from app.models.approval import Approval
from app.models.expense import Expense
from app.models.user import User


class ExpenseWorkflowService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def on_submitted(self, expense: Expense) -> None:
        """Called once after a request is created: set PENDING_MANAGER and email the manager."""
        raise NotImplementedError

    def list_pending(self, user: User, page: int, size: int) -> tuple[list[Expense], int]:
        """Requests waiting for a decision FROM THIS USER.

        - manager-step permission: PENDING_MANAGER requests of the user's direct reports.
        - finance-step permission: all PENDING_FINANCE requests.
        - both: the union. Superuser: everything pending.
        """
        raise NotImplementedError

    def approve(self, actor: User, expense_id: int, note: str | None) -> Approval:
        """Manager step: -> PENDING_FINANCE (email finance). Finance step: -> APPROVED (email requester)."""
        raise NotImplementedError

    def reject(self, actor: User, expense_id: int, note: str) -> Approval:
        """Either step: -> REJECTED. Note required. Email the requester."""
        raise NotImplementedError

    def request_changes(self, actor: User, expense_id: int, note: str) -> Approval:
        """Manager step only: -> NEEDS_CHANGES. Note required. Email the requester."""
        raise NotImplementedError

    def resubmit(self, requester: User, expense_id: int) -> Expense:
        """Requester only, from NEEDS_CHANGES: re-validate policy, go back to PENDING_MANAGER, email the manager."""
        raise NotImplementedError
