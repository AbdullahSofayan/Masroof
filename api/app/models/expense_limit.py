from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class ExpenseLimit(Base):
    __tablename__ = "EXPENSE_LIMITS"
    __table_args__ = (
        UniqueConstraint("category_id", name="uq_expense_limit_category"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("CATEGORIES.id", ondelete="CASCADE"), nullable=False
    )
    max_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    category = relationship("Category", back_populates="expense_limit")
