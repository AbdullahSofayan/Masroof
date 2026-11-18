from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Department(Base):
    __tablename__ = "DEPARTMENT"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    manager_id: Mapped[int | None] = mapped_column(
        ForeignKey("USERS.id", ondelete="SET NULL"), nullable=True, unique=True
    )
    users = relationship(
        "User", back_populates="department", foreign_keys="User.department_id"
    )
    manager = relationship(
        "User",
        back_populates="managed_department",
        foreign_keys=[manager_id],
        post_update=True,
    )
    expenses = relationship("Expense", back_populates="department")
    budgets = relationship(
        "Budget", back_populates="department", cascade="all, delete-orphan"
    )
