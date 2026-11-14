"""Approval history."""
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import ApprovalDecision, ApprovalStep
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.expense import Expense
    from app.models.user import User


class Approval(Base):
    """One decision made on an expense at one step of the chain.

    Append-only: rows are never edited or deleted, so this table is the audit
    trail of "who approved/rejected what, when, and why". The latest row's `note`
    is what the employee sees as the rejection / change-request reason.
    """

    __tablename__ = "approvals"

    id: Mapped[int] = mapped_column(primary_key=True)
    expense_id: Mapped[int] = mapped_column(ForeignKey("expenses.id", ondelete="CASCADE"), index=True)
    step: Mapped[ApprovalStep] = mapped_column(
        Enum(ApprovalStep, native_enum=False, length=20, values_callable=lambda e: [m.value for m in e])
    )
    decision: Mapped[ApprovalDecision] = mapped_column(
        Enum(ApprovalDecision, native_enum=False, length=30, values_callable=lambda e: [m.value for m in e])
    )
    approver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="Required for reject / request-changes.")
    decided_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    expense: Mapped["Expense"] = relationship(back_populates="approvals")
    approver: Mapped["User"] = relationship()
