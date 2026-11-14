"""Expense policies (per-category allow/limit rules)."""
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.policy import Policy
from app.schemas.policy import PolicyCreate, PolicyUpdate


class PolicyService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_policies(self) -> list[Policy]:
        raise NotImplementedError

    def get_policy(self, policy_id: int) -> Policy:
        raise NotImplementedError

    def create_policy(self, data: PolicyCreate) -> Policy:
        """One policy per category: ConflictError if it already has one."""
        raise NotImplementedError

    def update_policy(self, policy_id: int, data: PolicyUpdate) -> Policy:
        raise NotImplementedError

    def delete_policy(self, policy_id: int) -> None:
        """Removing a policy means the category becomes allowed with no limit."""
        raise NotImplementedError

    def validate(self, category_id: int, amount: Decimal) -> None:
        """Check a request against policy. Called on submit, edit and resubmit.

        Raise PolicyViolationError(POLICY_CATEGORY_NOT_ALLOWED) when the category is forbidden
        (or inactive), and PolicyViolationError(POLICY_AMOUNT_EXCEEDED) when amount > max_amount.
        No policy row = allowed, no limit.
        """
        raise NotImplementedError
