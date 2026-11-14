"""Receipt / invoice / quote file attached to an expense request."""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.expense import Expense


class Attachment(Base):
    """Metadata of one uploaded file. The bytes live in file storage (local disk for now)."""

    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    expense_id: Mapped[int] = mapped_column(
        ForeignKey("expenses.id", ondelete="CASCADE"), unique=True, comment="Unique: one attachment per expense."
    )
    original_filename: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(
        String(500), comment="Opaque key handed to FileStorageService (a relative path today, an object key later)."
    )
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    expense: Mapped["Expense"] = relationship(back_populates="attachment")
