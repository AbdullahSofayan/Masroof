"""The central table: expense requests."""
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import JSON, Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import DEFAULT_CURRENCY, MONEY_DECIMAL_PLACES, MONEY_MAX_DIGITS, ExpenseStatus
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.approval import Approval
    from app.models.attachment import Attachment
    from app.models.category import Category
    from app.models.department import Department
    from app.models.user import User


class Expense(TimestampMixin, Base):
    """One expense request: an employee asks to be approved for ONE amount in ONE category.

    The amount is the employee's own estimate (nothing is paid before approval).
    Only `ExpenseWorkflowService` may change `status`.
    """

    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    department_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("departments.id"),
        nullable=True,
        index=True,
        comment="Copy of the requester's department at submit time, so history survives transfers.",
    )
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)

    amount: Mapped[Decimal] = mapped_column(Numeric(MONEY_MAX_DIGITS, MONEY_DECIMAL_PLACES))
    currency: Mapped[str] = mapped_column(String(3), default=DEFAULT_CURRENCY)
    description: Mapped[str] = mapped_column(Text)
    expense_date: Mapped[date] = mapped_column(Date, index=True, comment="Date the expense is for.")

    status: Mapped[ExpenseStatus] = mapped_column(
        Enum(ExpenseStatus, native_enum=False, length=30, values_callable=lambda e: [m.value for m in e]),
        default=ExpenseStatus.PENDING_MANAGER,
        index=True,
    )

    ai_analysis: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON, nullable=True, comment="Reserved for the AI integration (scan result, anomaly score). Unused in the MVP."
    )

    requester: Mapped["User"] = relationship(foreign_keys=[requester_id])
    department: Mapped[Optional["Department"]] = relationship()
    category: Mapped["Category"] = relationship()
    attachment: Mapped[Optional["Attachment"]] = relationship(
        back_populates="expense", uselist=False, cascade="all, delete-orphan"
    )
    approvals: Mapped[list["Approval"]] = relationship(
        back_populates="expense", cascade="all, delete-orphan", order_by="Approval.decided_at"
    )
