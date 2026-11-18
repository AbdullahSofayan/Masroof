"""Request and response schemas for the expense API."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


# request schema for creating a new expense.
class ExpenseCreate(BaseModel):
    amount: Decimal = Field(
        gt=0,
        max_digits=12,
        decimal_places=2,
        description="Expense amount in SAR, must be greater than zero.",
    )
    category: str = Field(description="Category of the expense.")
    description: str = Field(description="Description of the expense")
    expense_date: date = Field(description="Date when the expense occurred")


# request schema for rejecting an expense.
class ExpenseReject(BaseModel):
    reason: str = Field(min_length=1)


# response schema for expense data.
class ExpenseResponse(BaseModel):
    expense_id: int = Field(description="Unique identifier of the expense")
    amount: Decimal = Field(description="Expense amount in SAR.")
    category: str = Field(description="Category of the expense")
    description: str = Field(description="Description of the expense")
    expense_date: date = Field(description="Date when the expense occurred")
    status: str = Field(
        description="Current expense status: Pending, Approved, or Rejected"
    )
