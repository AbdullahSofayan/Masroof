"""Email notifications through Resend. Notifications are email-only (not stored in the database).

Routes call these methods as FastAPI BackgroundTasks, so a Resend outage never blocks or fails
a user's request. Failures should be logged, not raised.
When `EMAIL_ENABLED=false`, messages are logged instead of sent (local development).
"""
from typing import Any

from app.core.constants import EmailEvent
from app.models.approval import Approval
from app.models.expense import Expense
from app.models.user import User


class EmailService:
    def send(self, event: EmailEvent, recipients: list[str], context: dict[str, Any]) -> None:
        """Low-level send: pick the subject from EMAIL_SUBJECTS, render the body, call Resend."""
        raise NotImplementedError

    def notify_new_request(self, expense: Expense) -> None:
        """NEW_REQUEST_FOR_MANAGER -> the requester's manager."""
        raise NotImplementedError

    def notify_finance_review_needed(self, expense: Expense, recipients: list[User]) -> None:
        """REVIEW_NEEDED_FOR_FINANCE -> users holding the finance-step permission (resolved by the workflow)."""
        raise NotImplementedError

    def notify_decision(self, expense: Expense, approval: Approval) -> None:
        """REQUEST_APPROVED / REQUEST_REJECTED / CHANGES_REQUESTED -> the requester, including the approver's note."""
        raise NotImplementedError

    def notify_welcome(self, user: User) -> None:
        """WELCOME_NEW_USER -> the new user. Never include the password in the email."""
        raise NotImplementedError
