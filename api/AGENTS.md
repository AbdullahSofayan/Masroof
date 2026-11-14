# Project context: Expense Management API (backend)

You are helping build the backend of a single-company expense management platform.
Read this fully before writing code. Follow the conventions exactly; consistency matters more than cleverness.

## 1. What the system does

Employees submit **expense requests** (one amount, one category, one attachment). The amount is the
employee's own estimate; nothing is paid beforehand. The request goes through an approval chain:

1. Employee submits -> status `pending_manager`; the employee's manager is emailed.
2. Manager approves (-> `pending_finance`, finance is emailed), rejects (-> `rejected`), or asks for changes (-> `needs_changes`).
3. Finance gives the final decision: approve (-> `approved`) or reject (-> `rejected`).
4. From `needs_changes`, the employee edits and resubmits (-> `pending_manager`).
5. The employee is emailed on every decision.

Other features: users, groups (roles), permissions, departments, categories, department budgets,
per-category policies (allowed? max amount), dashboards (employee / manager / finance), company settings.
AI features (receipt scan, anomaly detection, forecasting) are NOT implemented yet; only the `AIClient`
interface exists in `services/ai_client.py`.

Single company (no multi-tenancy). Currency SAR. Notifications are email-only and are not stored in the database.

## 2. Stack

Python 3.14, FastAPI, SQLAlchemy 2.0 (typed `Mapped[...]` style, sync sessions), MariaDB via PyMySQL,
Alembic (migrations), Pydantic v2 + pydantic-settings, PyJWT (OAuth2 password flow, bearer tokens),
argon2-cffi (password hashing), Resend (email), python-multipart (uploads), httpx (calling the AI service later).
Run with `uvicorn app.main:app --reload`. Interactive docs at `/docs`.
Do not add new dependencies without asking.

## 3. Project layout and responsibilities

```
app/
  main.py          create app, register routers, OpenAPI metadata. No logic.
  seed.py          idempotent initial data (permissions sync, admin, categories, settings)
  core/
    constants.py   ALL fixed values: enums, state-machine table, limits, defaults, error messages
    config.py      env-specific settings via get_settings() (secrets, URLs, API keys)
    database.py    engine, get_db session dependency
    security.py    hashing, JWT, oauth2_scheme, get_current_user
    permissions.py protected()/protected_any(), PERMISSION_REGISTRY
    deps.py        DbSession, CurrentUser, Pagination aliases
    exceptions.py  AppError subclasses + not_implemented()
  models/          SQLAlchemy tables, one file per table (+ associations.py)
  schemas/         Pydantic request/response models, one file per resource
  services/        business logic, one class per file
  routes/          HTTP endpoints, one router file per resource
alembic/           migrations
```

Layer rules (never break these):
- **Routes** declare the contract (path, permission, models, docs) and delegate to a service. No queries, no business rules.
- **Services** hold all logic, take the DB session in `__init__(self, db: Session)`, own commit/rollback, and raise errors from `core/exceptions.py`. Services never import from `routes/`.
- **Models** are tables only: no business logic.
- **Schemas** are the API shapes; never return ORM models or password hashes directly.
- **Constants** live in `core/constants.py`. No magic strings or numbers elsewhere (statuses, limits, messages, etc.). Secrets and per-environment values go in `config.py` / `.env`, never in constants.

## 4. How to define each part

### Constants (`core/constants.py`)
Enums are `class X(str, Enum)`. Error messages go in the `ErrorMessage` class. If a service needs a
permission name to implement a business rule, define its name here; otherwise permission names live on routes.

### Models (`models/`)
- One file per table, SQLAlchemy 2.0 style: `Mapped[...]` + `mapped_column(...)`. Inherit `TimestampMixin, Base`.
- Add `comment=` to non-obvious columns. Use `String(n)` with explicit lengths (MariaDB requires them).
- Enums are stored as strings: `Enum(MyEnum, native_enum=False, length=N, values_callable=lambda e: [m.value for m in e])`.
- Relationship targets are imported under `TYPE_CHECKING` and referenced by string.
- `users` and `departments` reference each other (`users.department_id`, `departments.manager_id`): always pass `foreign_keys=` explicitly on those relationships.
- The groups table is named `permission_groups` ("groups" is reserved in some MySQL versions).
- Every new model must be imported in `models/__init__.py` so Alembic sees it.
- Schema changes require a migration: `alembic revision --autogenerate -m "..."` then `alembic upgrade head`. Review the generated file.

### Schemas (`schemas/`)
- One file per resource. Naming: `XCreate`, `XUpdate`, `XRead`, plus `XBrief` for compact embeds.
- EVERY field uses `Field(description=..., examples=[...] where useful)`; every class has a docstring. This is what the API docs show.
- `XUpdate` is a partial update (all fields optional). `XRead` uses `ConfigDict(from_attributes=True)`.
- Never include passwords or hashes in a Read model. Money is `Decimal` with `max_digits`/`decimal_places` from constants.
- Lists are returned as `Page[XRead]` (`items, total, page, size`) unless the list is short and bounded (e.g. categories).

### Routes (`routes/`)
- One `APIRouter(prefix="/resource", tags=["Resource"])` per file; registered in `main.py` under `/api/v1`. Every tag must exist in `TAGS_METADATA` in `main.py`.
- Every protected route declares its permission INLINE with the spread helper, never with a hand-written dependency:

  ```python
  @router.get(
      "",
      response_model=Page[UserRead],
      summary="List users",
      **protected("users.list", "List and search users", details="Longer explanation shown in the docs."),
  )
  def list_users(db: DbSession, page: Pagination, ...): ...
  ```
  - Permission names are `"<resource>.<action>"` (lowercase, snake_case action). The description is one line.
  - `protected(name, description, details="", responses={...})` registers the permission and adds the check. Do NOT also pass `description=` to the decorator (it conflicts); use `details=`.
  - Use `protected_any([(name, desc), ...])` when holding any one of several permissions is enough.
  - The same permission name must always have the same description everywhere (a mismatch raises at import).
  - Public routes (login, refresh, health) don't use `protected()`.
  - There are NEVER separate routes for admins and non-admins. One route, one permission. The superuser bypass lives only inside the checker built by `protected()`.
- Each route sets `summary`, `response_model`, `status_code` where not 200 (201 create, 204 delete), and documents error cases via `responses={...}`.
- Every parameter is documented: `Annotated[int, Path(ge=1, description="...")]`, `Annotated[... , Query(description="...")]`.
- Use the aliases from `core/deps.py`: `DbSession`, `CurrentUser`, `Pagination`.
- Route body is thin: call a service method and return its result. Only include `current_user` when the service needs the caller.
- REST conventions: `GET` list/detail, `POST` create (and action sub-resources like `/approve`), `PATCH` partial update, `PUT /{id}/<sub-resource>` replaces a whole set, `DELETE`.
- Declare fixed paths (e.g. `/me`, `/pending`) BEFORE `/{id}` paths.
- Do not use `from __future__ import annotations` in route modules or `core/permissions.py` (breaks FastAPI's annotation resolution for dependencies).

### Services (`services/`)
- One class per file, `__init__(self, db: Session)`. Methods have type hints and a docstring stating the rules enforced and the errors raised.
- Raise `NotFoundError`, `ConflictError`, `ForbiddenError`, `UnauthorizedError`, `WorkflowError`, `PolicyViolationError` with messages from `ErrorMessage`. Don't raise bare `HTTPException`.
- Services commit their own transactions (one transaction per use case, so a status change, its Approval row, and similar happen together or not at all).
- Emails are sent via `EmailService` as FastAPI `BackgroundTasks` so email failures never fail the request; log failures, never raise.
- Files go through `FileStorageService` only (opaque `storage_key`, never trust client filenames, prevent path traversal). Validate type and size from constants.
- AI goes through the `AIClient` interface only.

## 5. Business rules you must respect

**Permissions / RBAC**
- Users get permissions from groups (named sets) plus optional direct grants. Code depends on permission names, never on group names.
- The superuser is identified by `User.is_superuser`, never by the username. It bypasses PERMISSION checks only, not workflow rules (it acts on whichever step is currently pending, and status rules still apply).
- Permissions are auto-discovered from routes into a registry and synced to the `permissions` table at startup (new -> insert, changed -> update, missing -> `is_stale=True`, never delete).

**Visibility scope**: `GET /expenses` and expense detail/attachment/history return own / department / all expenses depending on the highest of `expenses.view_own` < `expenses.view_department` < `expenses.view_all` the caller holds. Filters narrow within scope, never widen. Out-of-scope records return 404, not 403.

**Workflow**
- `Expense.status` may be changed ONLY by `ExpenseWorkflowService`, and only along `ALLOWED_STATUS_TRANSITIONS` in constants.
- Every decision appends an `Approval` row (append-only audit trail), changes status, and queues the email, in one transaction.
- Reject and request-changes require a note (`DECISIONS_REQUIRING_NOTE`). Request-changes is manager-step only.
- At the manager step the actor must hold the manager-step permission AND be the requester's manager; at the finance step, hold the finance-step permission.
- Requesters can edit/delete/resubmit only in `EDITABLE_STATUSES`, and only their own requests.
- Policy is validated on submit, edit and resubmit (`PolicyService.validate`). No policy row = allowed, no limit.
- Budgets count APPROVED expenses only, within the budget's period.

## 6. Code style

- Python with full type hints, modern syntax (`str | None`, `list[int]`). Keep functions short and focused.
- Descriptive names, no abbreviations. Comments explain WHY and the rules; docstrings on every class, service method, and route helper.
- No dead code, no commented-out code, no TODOs without an owner. No `print`; use `logging`.
- Never log or return secrets, passwords, tokens or hashes.
- Use SQLAlchemy 2.0 `select(...)` with `db.execute/scalars`, not legacy `Query`. Avoid N+1 queries on list endpoints (use `selectinload`/`joinedload`).
- Validate input in Pydantic schemas first; enforce business rules in services.
- Match existing patterns in neighboring files before inventing new ones.

## 7. Checklist when adding an endpoint

1. Add/extend schemas in `schemas/` (all fields described).
2. Add the service method (signature + docstring first, then logic).
3. Add the route with `**protected("resource.action", "Description", details=...)`, documented params and error responses.
4. If it needs a new column/table: update the model, import it in `models/__init__.py`, generate and review an Alembic migration.
5. If it sends email: add an `EmailEvent` and subject in constants and a method in `EmailService`; call it as a background task.
6. Check `/docs`: the route, its required permission, parameters and schemas all read clearly.

## 8. Things you must not do

- Don't put logic in routes or models. Don't change `Expense.status` outside `ExpenseWorkflowService`.
- Don't hardcode strings/numbers that belong in `constants.py`. Don't check the username `admin` anywhere.
- Don't create separate admin/non-admin routes or hand-write permission dependencies.
- Don't store notifications in the DB, add new dependencies, or implement AI features beyond the `AIClient` interface unless asked.
- Don't edit existing migrations that have been applied; create a new one.
- If a requirement is ambiguous or conflicts with these rules, ask instead of guessing.
