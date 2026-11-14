"""Company settings shapes."""
from pydantic import BaseModel, ConfigDict, Field


class SettingsUpdate(BaseModel):
    """Partial update: send only the fields to change."""

    company_name: str | None = Field(default=None, min_length=2, max_length=150, description="Company display name.")
    currency: str | None = Field(default=None, min_length=3, max_length=3, description="ISO 4217 code.", examples=["SAR"])


class SettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    company_name: str = Field(description="Company display name.")
    currency: str = Field(description="Currency used across the system.", examples=["SAR"])
