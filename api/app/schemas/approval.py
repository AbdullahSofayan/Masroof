"""Approval shapes."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import ApprovalDecision, ApprovalStep
from app.schemas.user import UserBrief


class ApprovalNote(BaseModel):
    """Body of approve / reject / request-changes. The note is REQUIRED for reject and request-changes."""

    note: str | None = Field(
        default=None,
        max_length=2000,
        description="Reason or comment. Required when rejecting or requesting changes; optional when approving.",
        examples=["Please attach the original receipt."],
    )


class ApprovalRead(BaseModel):
    """One entry in a request's decision history."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Approval id.")
    step: ApprovalStep = Field(description="Which stage of the chain: manager or finance.")
    decision: ApprovalDecision = Field(description="approved, rejected or changes_requested.")
    approver: UserBrief = Field(description="Who made the decision.")
    note: str | None = Field(description="The approver's note, if any.")
    decided_at: datetime = Field(description="When the decision was made.")
