# Backend TODO

Work top to bottom: each phase depends on the one before it and ends with something you can check in `/docs`.

Track what is left with:

```
grep -rn "not_implemented()\|NotImplementedError" app
```

The backend is done when it finds nothing.

## Phase 0: Baseline
- [ ] Migration applied, tables exist in MariaDB
- [ ] `uvicorn` starts and `/docs` lists all routes (all return 501)

## Phase 1: Auth foundation (everything else depends on this)
- [ ] `security.py`: `hash_password`, `verify_password`, token creation and decoding, `get_current_user` (rejects wrong token type and disabled users)
- [ ] `RbacService` permission evaluation: `get_effective_permission_names`, `user_has_permission`, `user_has_any_permission`
- [ ] The checker inside `core/permissions.py` (superuser bypass, otherwise a permission lookup, 403 on failure)
- [ ] `PermissionSyncService`, and call it in `main.py` startup
- [ ] `seed.py`: permissions sync, `admin` superuser, default categories, settings row
- [ ] `AuthService` and routes: login, refresh, change-password
- [ ] `GET /users/me`
- [ ] **Check:** log in as `admin` through Authorize, `/users/me` works, and the `permissions` table is filled

## Phase 2: Users, groups and permissions
- [ ] `RbacService` group CRUD and `set_group_permissions`, plus the groups routes
- [ ] `GET /permissions`, including `include_stale`
- [ ] `UserService`: create (reserved username, uniqueness), list, get, update, delete, reset-password, set groups, set direct permissions, plus the users routes
- [ ] Seed default groups (Employee, Manager, Finance, System Admin) with their permissions
- [ ] **Check:** create a non-admin user, log in as them, confirm a missing permission gives 403

## Phase 3: Organization data
- [ ] `DepartmentService` and routes, including employees list and manager assignment
- [ ] `CategoryService` and routes
- [ ] Settings routes (read and update the single row)

## Phase 4: Money rules
- [ ] `PolicyService`: CRUD plus `validate` (allowed category, maximum amount) and routes
- [ ] `BudgetService`: CRUD with the monthly/annual validation and routes (usage comes in Phase 7)

## Phase 5: Expense core
- [ ] `EmailService`, with logging when `EMAIL_ENABLED=false` and Resend when on
- [ ] `FileStorageService` (safe paths, type and size checks)
- [ ] `RbacService.resolve_expense_scope`
- [ ] `ExpenseService`: create (with policy check and manager required), list with scope and filters, get, update, delete (editable statuses only), attachment upload and download, and the expenses routes
- [ ] `ExpenseWorkflowService.on_submitted` (sets the status and emails the manager)
- [ ] **Check:** an employee submits and uploads a file, and sees only their own requests

## Phase 6: Approval chain (riskiest, test thoroughly)
- [ ] `ExpenseWorkflowService`: `approve`, `reject`, `request_changes`, `resubmit`, `list_pending`. Enforce the transition table, the step permission, the manager-identity check and the required notes, and write the `Approval` row, status change and email in one transaction
- [ ] Approvals routes plus `GET /expenses/{id}/approvals`
- [ ] **Check:** run the full flow (submit, manager approves, finance approves) and the branches (reject, request changes then resubmit). Confirm the admin can act at either step but still can't skip statuses.

## Phase 7: Reporting
- [ ] `BudgetService.get_usage`
- [ ] `DashboardService`: employee, manager and finance dashboards, plus routes

## Phase 8: Hardening and handover
- [ ] Automated tests for permissions, scope, the workflow transitions and policy validation (needs adding `pytest`, to be agreed first)
- [ ] Review for N+1 queries on list endpoints
- [ ] Production config: strong JWT secret, `EMAIL_ENABLED=true`, CORS origins
- [ ] Update the README and AI context file to match anything that changed
