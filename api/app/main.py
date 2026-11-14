"""Application entrypoint: creates the FastAPI app and wires everything together.

Run:  uvicorn app.main:app --reload
Docs: http://localhost:8000/docs  (Swagger UI)   http://localhost:8000/redoc  (ReDoc)
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.constants import API_PREFIX, APP_NAME, APP_VERSION
from app.routes import (
    approvals,
    auth,
    budgets,
    categories,
    dashboard,
    departments,
    expenses,
    groups,
    permissions,
    policies,
    settings,
    users,
)

API_DESCRIPTION = """
Backend for a **single-company expense management platform**.

## How it works
1. An **employee** submits an *expense request* (one amount, one category, one attachment).
2. Their **manager** is emailed and approves, rejects, or asks for changes.
3. After manager approval, **finance** gives the final approve / reject.
4. The employee is emailed about every decision.

Statuses: `pending_manager` -> `pending_finance` -> `approved`, or `rejected` / `needs_changes` along the way.

## Authentication
OAuth2 password flow with JWT bearer tokens. Use **Authorize** (top right) after calling `POST /auth/login`.
All routes except login/refresh/health require a token.

## Permissions (RBAC)
* Every protected route lists its **required permission** in its description below.
* Permissions are bundled into **groups**; users get permissions through their groups and/or direct grants.
* The seeded `admin` superuser passes every permission check (permissions only - workflow rules still apply).
* The full catalogue is available at `GET /permissions`.

## Conventions
* Lists are paginated with `?page=&size=` and return `{items, total, page, size}`.
* `PATCH` is a partial update; `PUT` on a sub-resource replaces the whole set.
* Errors return `{"detail": "..."}`.
* `501 Not Implemented` means the route is defined but its logic has not been written yet.
"""

TAGS_METADATA = [
    {"name": "Authentication", "description": "Log in, refresh tokens, change your own password."},
    {"name": "Users", "description": "Create and manage user accounts, their groups and direct permissions."},
    {"name": "Groups", "description": "Named sets of permissions (roles) that can be assigned to users."},
    {"name": "Permissions", "description": "Read-only catalogue of permissions, synced automatically from the routes."},
    {"name": "Departments", "description": "Organizational units, their managers and employees."},
    {"name": "Categories", "description": "Expense categories (Food, Travel, ...)."},
    {"name": "Expenses", "description": "Submit and manage expense requests and their attachments."},
    {"name": "Approvals", "description": "Manager and finance decisions on requests."},
    {"name": "Budgets", "description": "Monthly / annual department budgets and their usage."},
    {"name": "Policies", "description": "Per-category rules: allowed or not, maximum amount."},
    {"name": "Dashboards", "description": "Summary data for the employee, manager and finance screens."},
    {"name": "Settings", "description": "Company-wide settings (name, currency)."},
    {"name": "System", "description": "Health check."},
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hook.

    TODO(team) once the services are implemented, on startup:
        with SessionLocal() as db:
            PermissionSyncService(db).sync_permissions()
    By this point every route module has been imported, so PERMISSION_REGISTRY is complete.
    """
    yield


app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description=API_DESCRIPTION,
    openapi_tags=TAGS_METADATA,
    lifespan=lifespan,
    swagger_ui_parameters={"persistAuthorization": True, "displayRequestDuration": True},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (
    auth,
    users,
    groups,
    permissions,
    departments,
    categories,
    expenses,
    approvals,
    budgets,
    policies,
    dashboard,
    settings,
):
    app.include_router(module.router, prefix=API_PREFIX)


@app.get("/health", tags=["System"], summary="Health check")
def health() -> dict[str, str]:
    """Liveness probe. **Public route.** Returns `{"status": "ok"}` when the app is running."""
    return {"status": "ok"}
