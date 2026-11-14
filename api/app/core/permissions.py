"""Declarative route permissions - the heart of the RBAC system.

HOW IT WORKS
------------
Every protected route declares the permission it needs, once, right on the route:

    @router.get(
        "",
        response_model=Page[UserRead],
        summary="List users",
        **protected("users.list", "List all users", details="Supports search and filters."),
    )
    def list_users(...): ...

`protected()` does three things:
  1. REGISTERS the permission (name + description) in PERMISSION_REGISTRY.
     At startup `PermissionSyncService` upserts the registry into the
     `permissions` table, which generates the permission ids and lets
     `GET /permissions` list everything. No hand-maintained permission list.
  2. ADDS a dependency that checks the caller. This dependency is the ONLY
     place the superuser bypass lives: superusers always pass; everyone else
     must hold the permission through a group or a direct grant. There are
     no separate "admin routes".
  3. DOCUMENTS the requirement in the OpenAPI description, so /docs shows
     "Required permission: `users.list`" under each route.

Routes that need "any one of several" permissions (e.g. view own/department/all)
use `protected_any()`.

Public routes (login, refresh, health) simply don't use `protected()`.
"""
from dataclasses import dataclass
from typing import Any

from app.core.deps import CurrentUser, DbSession
from app.core.exceptions import not_implemented
from fastapi import Depends


@dataclass(frozen=True)
class PermissionSpec:
    """A permission as declared in code."""

    name: str         # stable machine name, e.g. "expenses.create" (convention: "<resource>.<action>")
    description: str  # human description shown in GET /permissions and /docs


# name -> spec. Filled at import time as route modules are imported.
PERMISSION_REGISTRY: dict[str, PermissionSpec] = {}


def register_permission(name: str, description: str) -> PermissionSpec:
    """Record a permission in the registry (idempotent).

    Declaring the same name twice with a different description is a programming
    error: it would make the stored description depend on import order.
    """
    existing = PERMISSION_REGISTRY.get(name)
    if existing is not None and existing.description != description:
        raise ValueError(f"Permission '{name}' is declared twice with different descriptions.")
    spec = existing or PermissionSpec(name=name, description=description)
    PERMISSION_REGISTRY[name] = spec
    return spec


def _build_checker(specs: tuple[PermissionSpec, ...]):
    """Create the dependency that enforces "caller holds at least one of these permissions"."""

    def check_permission(current_user: CurrentUser, db: DbSession) -> None:
        # To implement: if current_user.is_superuser -> return.
        # Otherwise RbacService(db).user_has_any_permission(current_user, [s.name for s in specs])
        # and raise ForbiddenError when it returns False.
        not_implemented()

    return check_permission


def _route_kwargs(
    specs: tuple[PermissionSpec, ...], details: str, responses: dict[int | str, dict[str, Any]] | None
) -> dict[str, Any]:
    """Build the keyword arguments spread into the route decorator via `**`."""
    if len(specs) == 1:
        requirement = f"**Required permission:** `{specs[0].name}` - {specs[0].description}"
    else:
        listed = "\n".join(f"- `{s.name}` - {s.description}" for s in specs)
        requirement = f"**Required permission (any one of):**\n{listed}"
    merged_responses: dict[int | str, dict[str, Any]] = {
        401: {"description": "Missing, invalid or expired access token."},
        403: {"description": "Authenticated, but the user lacks the required permission."},
    }
    merged_responses.update(responses or {})
    return {
        "dependencies": [Depends(_build_checker(specs))],
        "description": f"{details}\n\n{requirement}".strip(),
        "responses": merged_responses,
    }


def protected(
    name: str,
    description: str,
    details: str = "",
    responses: dict[int | str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Protect a route with ONE permission. Spread the result into the decorator: `**protected(...)`.

    Args:
        name: permission name, e.g. "expenses.create".
        description: one-line human description of what the permission allows.
        details: longer explanation of the route's behavior (rendered in /docs).
        responses: extra documented responses, e.g. {404: {"description": "User not found."}}.
    """
    spec = register_permission(name, description)
    return _route_kwargs((spec,), details, responses)


def protected_any(
    permissions: list[tuple[str, str]],
    details: str = "",
    responses: dict[int | str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Protect a route so holding ANY ONE of the listed (name, description) permissions is enough."""
    specs = tuple(register_permission(n, d) for n, d in permissions)
    return _route_kwargs(specs, details, responses)
