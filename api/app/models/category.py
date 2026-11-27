from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Category(Base):
    __tablename__ = "CATEGORIES"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    expenses = relationship("Expense", back_populates="category")
    expense_limit = relationship(
        "ExpenseLimit",
        back_populates="category",
        uselist=False,
        cascade="all, delete-orphan",
    )
