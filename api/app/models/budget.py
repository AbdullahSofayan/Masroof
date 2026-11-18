from decimal import Decimal
from sqlalchemy import CheckConstraint, ForeignKey, Integer, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base

class Budget(Base):
    __tablename__ = "BUDGET"
    __table_args__ = (UniqueConstraint("department_id", "year", "month", name="uq_budget_department_year_month"), CheckConstraint("month BETWEEN 1 AND 12", name="ck_budget_month"))
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("DEPARTMENT.id", ondelete="CASCADE"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    department = relationship("Department", back_populates="budgets")
