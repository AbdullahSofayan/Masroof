from datetime import datetime
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base
from app.models.enums import UserRole

class User(Base):
    __tablename__ = "USERS"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, values_callable=lambda e: [x.value for x in e], name="user_role"), nullable=False, default=UserRole.EMPLOYEE)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("DEPARTMENT.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    department = relationship("Department", back_populates="users", foreign_keys=[department_id])
    managed_department = relationship("Department", back_populates="manager", foreign_keys="Department.manager_id", uselist=False)
    requested_expenses = relationship("Expense", back_populates="requester", foreign_keys="Expense.requester_id")
    reviewed_expenses = relationship("Expense", back_populates="reviewer", foreign_keys="Expense.reviewed_by")
