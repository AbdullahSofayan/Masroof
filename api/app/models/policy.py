"""Expense policies."""
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import MONEY_DECIMAL_PLACES, MONEY_MAX_DIGITS
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.category import Category


class Policy(TimestampMixin, Base):
    """Company rule for ONE category: is it allowed, and what is the maximum amount per request.

    A category with no policy row is allowed with no limit.
    Checked by PolicyService when a request is submitted or resubmitted.
    """

    __tablename__ = "policies"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), unique=True, comment="Unique: one policy per category."
    )
    is_allowed: Mapped[bool] = mapped_column(Boolean, default=True, comment="False = category can't be requested at all.")
    max_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(MONEY_MAX_DIGITS, MONEY_DECIMAL_PLACES), nullable=True, comment="Maximum per request. NULL = no limit."
    )

    category: Mapped["Category"] = relationship()
