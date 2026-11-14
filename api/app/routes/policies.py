"""Expense policies: per-category allow / maximum-amount rules."""
from typing import Annotated

from fastapi import APIRouter, Path, status

from app.core.deps import DbSession
from app.core.exceptions import not_implemented
from app.core.permissions import protected
from app.schemas.policy import PolicyCreate, PolicyRead, PolicyUpdate

router = APIRouter(prefix="/policies", tags=["Policies"])

PolicyId = Annotated[int, Path(ge=1, description="ID of the policy.")]
NOT_FOUND = {404: {"description": "Policy not found."}}


@router.get(
    "",
    response_model=list[PolicyRead],
    summary="List policies",
    **protected(
        "policies.list",
        "List expense policies",
        details="A category with no policy is allowed with no limit.",
    ),
)
def list_policies(db: DbSession):
    # Delegates to PolicyService.list_policies(...)
    not_implemented()


@router.post(
    "",
    response_model=PolicyRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a policy",
    **protected(
        "policies.create",
        "Create expense policies",
        responses={409: {"description": "This category already has a policy."}},
    ),
)
def create_policy(body: PolicyCreate, db: DbSession):
    # Delegates to PolicyService.create_policy(...)
    not_implemented()


@router.get(
    "/{policy_id}",
    response_model=PolicyRead,
    summary="Get a policy",
    **protected("policies.view", "View a policy", responses=NOT_FOUND),
)
def get_policy(policy_id: PolicyId, db: DbSession):
    # Delegates to PolicyService.get_policy(...)
    not_implemented()


@router.patch(
    "/{policy_id}",
    response_model=PolicyRead,
    summary="Update a policy",
    **protected("policies.update", "Edit expense policies", responses=NOT_FOUND),
)
def update_policy(policy_id: PolicyId, body: PolicyUpdate, db: DbSession):
    # Delegates to PolicyService.update_policy(...)
    not_implemented()


@router.delete(
    "/{policy_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a policy",
    **protected(
        "policies.delete",
        "Delete expense policies",
        details="The category becomes allowed with no limit.",
        responses=NOT_FOUND,
    ),
)
def delete_policy(policy_id: PolicyId, db: DbSession):
    # Delegates to PolicyService.delete_policy(...)
    not_implemented()
