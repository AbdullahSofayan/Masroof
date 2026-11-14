"""Expense policy shapes."""
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import MONEY_DECIMAL_PLACES, MONEY_MAX_DIGITS
from app.schemas.category import CategoryRead


class PolicyCreate(BaseModel):
    category_id: int = Field(description="Category this policy applies to (one policy per category).")
    is_allowed: bool = Field(default=True, description="False = this category cannot be requested at all.")
    max_amount: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=MONEY_MAX_DIGITS,
        decimal_places=MONEY_DECIMAL_PLACES,
        description="Maximum amount per request. Omit for no limit.",
    )


class PolicyUpdate(BaseModel):
    """Partial update: send only the fields to change."""

    is_allowed: bool | None = Field(default=None, description="Allow or forbid the category.")
    max_amount: Decimal | None = Field(
        default=None, gt=0, max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, description="New maximum."
    )


class PolicyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Policy id.")
    category: CategoryRead = Field(description="The category the policy governs.")
    is_allowed: bool = Field(description="Whether the category may be requested.")
    max_amount: Decimal | None = Field(description="Maximum per request; null = no limit.")
