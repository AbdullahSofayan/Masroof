from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (JSON, Date, DateTime, Enum, Float, ForeignKey, Index,
                        Integer, Numeric, String, func)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.enums import ExpenseStatus, RiskLevel


class Expense(Base):
    __tablename__ = "EXPENSE"
    __table_args__ = (
        Index("ix_expense_requester_date", "requester_id", "expense_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    requester_id: Mapped[int] = mapped_column(
        ForeignKey("USERS.id", ondelete="RESTRICT"), nullable=False
    )
    department_id: Mapped[int] = mapped_column(
        ForeignKey("DEPARTMENT.id", ondelete="RESTRICT"), nullable=False
    )
    category_id: Mapped[int] = mapped_column(
        ForeignKey("CATEGORIES.id", ondelete="RESTRICT"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[str] = mapped_column(String(1000), nullable=False)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[ExpenseStatus] = mapped_column(
        Enum(
            ExpenseStatus,
            values_callable=lambda e: [x.value for x in e],
            name="expense_status",
        ),
        default=ExpenseStatus.PENDING,
        nullable=False,
    )
    reviewed_by: Mapped[int | None] = mapped_column(
        ForeignKey("USERS.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True)
    manager_note: Mapped[str | None] = mapped_column(
        String(1000), nullable=True)
    receipt_path: Mapped[str | None] = mapped_column(
        String(500), nullable=True)
    anomaly_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    risk_level: Mapped[RiskLevel | None] = mapped_column(
        Enum(
            RiskLevel, values_callable=lambda e: [x.value for x in e], name="risk_level"
        ),
        nullable=True,
    )
    risk_justification: Mapped[list[dict[str, str]] | None] = mapped_column(
        JSON, nullable=True
    )
    warnings: Mapped[list[Any]] = mapped_column(
        JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    requester = relationship(
        "User", back_populates="requested_expenses", foreign_keys=[requester_id]
    )
    reviewer = relationship(
        "User", back_populates="reviewed_expenses", foreign_keys=[reviewed_by]
    )
    department = relationship("Department", back_populates="expenses")
    category = relationship("Category", back_populates="expenses")
