"""Department budgets."""
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Enum, ForeignKey, Integer, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import MONEY_DECIMAL_PLACES, MONEY_MAX_DIGITS, BudgetPeriod
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.department import Department


class Budget(TimestampMixin, Base):
    """Money a department may spend in one period (a month or a whole year).

    Spending is counted from APPROVED expenses only (final approval consumes budget).
    """

    __tablename__ = "budgets"
    __table_args__ = (
        UniqueConstraint("department_id", "period_type", "year", "month", name="uq_budget_department_period"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id", ondelete="CASCADE"), index=True)
    period_type: Mapped[BudgetPeriod] = mapped_column(
        Enum(BudgetPeriod, native_enum=False, length=20, values_callable=lambda e: [m.value for m in e])
    )
    year: Mapped[int] = mapped_column(Integer)
    month: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="1-12 for monthly budgets; NULL for annual budgets."
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(MONEY_MAX_DIGITS, MONEY_DECIMAL_PLACES))
    last_alert_level: Mapped[int] = mapped_column(
        Integer, default=0, comment="Highest threshold (80/90) already emailed, to avoid repeat alerts. Reserved (post-MVP)."
    )

    department: Mapped["Department"] = relationship(back_populates="budgets")
