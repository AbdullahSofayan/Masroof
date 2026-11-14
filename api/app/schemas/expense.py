"""Expense request shapes."""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import MONEY_DECIMAL_PLACES, MONEY_MAX_DIGITS, ExpenseStatus
from app.schemas.category import CategoryRead
from app.schemas.user import UserBrief


class ExpenseCreate(BaseModel):
    """Submit a new request. It enters the workflow as `pending_manager`.

    Upload the receipt/quote afterwards with `PUT /expenses/{id}/attachment`.
    """

    amount: Decimal = Field(
        gt=0,
        max_digits=MONEY_MAX_DIGITS,
        decimal_places=MONEY_DECIMAL_PLACES,
        description="The amount the employee asks to be approved (their own estimate).",
        examples=["250.00"],
    )
    category_id: int = Field(description="Category of the expense.")
    description: str = Field(min_length=3, description="What the money is for.", examples=["Client lunch, Riyadh"])
    expense_date: date = Field(description="Date the expense is for.")


class ExpenseUpdate(BaseModel):
    """Partial update; allowed only while the request is `pending_manager` or `needs_changes`."""

    amount: Decimal | None = Field(default=None, gt=0, max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    category_id: int | None = Field(default=None, description="New category.")
    description: str | None = Field(default=None, min_length=3, description="New description.")
    expense_date: date | None = Field(default=None, description="New expense date.")


class AttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Attachment id.")
    original_filename: str = Field(description="File name as uploaded.", examples=["receipt.jpg"])
    content_type: str = Field(description="MIME type.", examples=["image/jpeg"])
    size_bytes: int = Field(description="File size in bytes.")
    uploaded_at: datetime = Field(description="When it was uploaded.")


class ExpenseSummary(BaseModel):
    """Compact form used in dashboards and activity feeds."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Expense id.")
    description: str = Field(description="What the money is for.")
    amount: Decimal = Field(description="Requested amount.")
    status: ExpenseStatus = Field(description="Current status.")
    updated_at: datetime = Field(description="Last change.")


class ExpenseRead(BaseModel):
    """Full view of an expense request."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Expense id.")
    requester: UserBrief = Field(description="Employee who submitted the request.")
    department_id: int | None = Field(description="Requester's department at submit time.")
    category: CategoryRead = Field(description="Expense category.")
    amount: Decimal = Field(description="Requested amount.")
    currency: str = Field(description="ISO currency code.", examples=["SAR"])
    description: str = Field(description="What the money is for.")
    expense_date: date = Field(description="Date the expense is for.")
    status: ExpenseStatus = Field(description="Where the request is in the approval chain.")
    attachment: AttachmentRead | None = Field(description="Uploaded file, if any.")
    latest_note: str | None = Field(
        default=None,
        description="Note from the most recent decision: the rejection / change-request reason shown to the employee.",
    )
    created_at: datetime = Field(description="When the request was submitted.")
    updated_at: datetime = Field(description="Last change.")
