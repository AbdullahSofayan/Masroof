"""Company-wide settings (single-company deployment)."""
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import DEFAULT_COMPANY_NAME, DEFAULT_CURRENCY
from app.models.base import Base, TimestampMixin


class CompanySettings(TimestampMixin, Base):
    """Exactly ONE row (id = 1), created by the seed script. There is no create/delete route."""

    __tablename__ = "company_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_name: Mapped[str] = mapped_column(String(150), default=DEFAULT_COMPANY_NAME)
    currency: Mapped[str] = mapped_column(String(3), default=DEFAULT_CURRENCY, comment="ISO 4217 code, e.g. SAR.")
