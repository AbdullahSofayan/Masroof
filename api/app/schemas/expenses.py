"""Request and response schemas for the expense API."""

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, StringConstraints, field_validator
from decimal import Decimal
from datetime import date, datetime
from typing import Annotated



# fields the employee sends when creating an expense
class ExpenseCreate(BaseModel):
    amount: Decimal = Field(
        gt=0,
        max_digits = 12,
        decimal_places=2,
        description="Expense amount in SAR, must be greater than zero."

    )
    category_id: int = Field(gt=0, description="ID of the expense category.")
    description: str = Field(max_length=1000, description="Description of the expense")
    expense_date: date = Field(description="Date when the expense occurred")



# fields the employee can edit while the request is pending
class ExpenseUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    category_id: int | None = Field(default=None, gt=0)
    description: str | None = Field(default=None, max_length=1000)
    expense_date: date | None = None

    # omitted fields stay unchanged and explicit null values are rejected
    @field_validator("amount", "category_id", "description", "expense_date")
    @classmethod
    def reject_null_fields(cls, value):
        if value is None:
            raise ValueError("Expense fields cannot be null.")
        return value




# rejection requires a note
class ExpenseReject(BaseModel):
    reason: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)
    ] = Field(validation_alias=AliasChoices("reason", "note"))




# approval can include a note
class ExpenseApprove(BaseModel):
    note: Annotated[
        str, StringConstraints(strip_whitespace=True, max_length=1000)
    ] | None = None


# ---------- Expense response ----------
class ExpenseReference(BaseModel):
    id: int
    name: str


class ExpenseRequester(BaseModel):
    id: int
    full_name: str


class ExpenseResponse(BaseModel):
    id: int = Field(description="Unique identifier of the expense")
    amount: Decimal = Field(description="Expense amount in SAR.")
    category_id: int = Field(gt=0, description="ID of the expense category.")
    description: str = Field(description="Description of the expense")
    expense_date: date = Field(description="Date when the expense occurred")
    status: str = Field(description="Current expense status: pending, approved, or rejected")
    manager_note: str | None = None
    requester_id: int
    department_id: int
    requester: ExpenseRequester
    department: ExpenseReference
    category: ExpenseReference
    created_at: datetime
    reviewed_at: datetime | None = None
    reviewer_name: str | None = None
    attachment_url: str | None = None
    warnings: list[str] = Field(default_factory=list)
    risk_level: str | None = None
    anomaly_score: float | None = None
    ai_analysis: dict | None = None




# ---------- Expense list response ----------
class ExpenseListResponse(BaseModel):
    items: list[ExpenseResponse]
    total: int
    page: int
    size: int
