"""All fixed values used across the application.

Rule of thumb: if a value is a magic string/number, an enum, or a default that
is NOT secret and NOT environment-specific, it lives here. Anything that changes
per environment (DB URL, secrets, API keys) belongs in `config.py` / `.env`.
"""
from enum import Enum

# --------------------------------------------------------------------------- #
# Application
# --------------------------------------------------------------------------- #
APP_NAME = "Expense Management API"
APP_VERSION = "0.1.0"
API_PREFIX = "/api/v1"

# --------------------------------------------------------------------------- #
# Superuser
# --------------------------------------------------------------------------- #
# The seeded superuser. Permission checks ALWAYS pass for it (is_superuser=True).
# The code never checks this username to decide access - only the `is_superuser`
# flag - so nobody can gain bypass rights by registering the name "admin".
# The username is reserved: UserService must refuse to create another user with it.
SUPERUSER_USERNAME = "admin"
SUPERUSER_FULL_NAME = "System Administrator"

# --------------------------------------------------------------------------- #
# Company defaults (used to create the single settings row on first seed)
# --------------------------------------------------------------------------- #
DEFAULT_COMPANY_NAME = "My Company"
DEFAULT_CURRENCY = "SAR"

# --------------------------------------------------------------------------- #
# Expense workflow
# --------------------------------------------------------------------------- #
class ExpenseStatus(str, Enum):
    """Lifecycle of an expense request."""

    PENDING_MANAGER = "pending_manager"  # waiting for the requester's manager
    PENDING_FINANCE = "pending_finance"  # manager approved, waiting for finance
    NEEDS_CHANGES = "needs_changes"      # manager sent it back to the employee
    APPROVED = "approved"                # final: finance approved
    REJECTED = "rejected"                # final: manager or finance rejected


class ApprovalStep(str, Enum):
    """Which stage of the chain an Approval record belongs to."""

    MANAGER = "manager"
    FINANCE = "finance"


class ApprovalDecision(str, Enum):
    """What the approver decided at a step."""

    APPROVED = "approved"
    REJECTED = "rejected"
    CHANGES_REQUESTED = "changes_requested"  # only valid at the manager step


# Single source of truth for the state machine. ExpenseWorkflowService is the ONLY
# place allowed to change `Expense.status`, and it must consult this table.
ALLOWED_STATUS_TRANSITIONS: dict[ExpenseStatus, set[ExpenseStatus]] = {
    ExpenseStatus.PENDING_MANAGER: {
        ExpenseStatus.PENDING_FINANCE,  # manager approves
        ExpenseStatus.REJECTED,         # manager rejects
        ExpenseStatus.NEEDS_CHANGES,    # manager requests changes
    },
    ExpenseStatus.PENDING_FINANCE: {
        ExpenseStatus.APPROVED,         # finance approves
        ExpenseStatus.REJECTED,         # finance rejects
    },
    ExpenseStatus.NEEDS_CHANGES: {
        ExpenseStatus.PENDING_MANAGER,  # employee resubmits
    },
    ExpenseStatus.APPROVED: set(),
    ExpenseStatus.REJECTED: set(),
}

# Which approval step is "current" for each pending status.
STEP_FOR_STATUS: dict[ExpenseStatus, ApprovalStep] = {
    ExpenseStatus.PENDING_MANAGER: ApprovalStep.MANAGER,
    ExpenseStatus.PENDING_FINANCE: ApprovalStep.FINANCE,
}

# The requester may edit or delete their request only in these statuses.
EDITABLE_STATUSES = {ExpenseStatus.PENDING_MANAGER, ExpenseStatus.NEEDS_CHANGES}

# Decisions that require a written note from the approver.
DECISIONS_REQUIRING_NOTE = {ApprovalDecision.REJECTED, ApprovalDecision.CHANGES_REQUESTED}

# --------------------------------------------------------------------------- #
# Permission names the SERVICES must know about
# --------------------------------------------------------------------------- #
# Every route declares its own permission name + description inline (see
# `core/permissions.py`). The handful below are the exception: business rules
# depend on them (not only route access), so they are defined once here.
class ExpenseScope(str, Enum):
    """How much expense data a user may see. Highest scope the user holds wins."""

    OWN = "own"
    DEPARTMENT = "department"
    ALL = "all"


PERM_EXPENSES_VIEW_OWN = "expenses.view_own"
PERM_EXPENSES_VIEW_DEPARTMENT = "expenses.view_department"
PERM_EXPENSES_VIEW_ALL = "expenses.view_all"
EXPENSE_SCOPE_PERMISSIONS: dict[ExpenseScope, str] = {
    ExpenseScope.OWN: PERM_EXPENSES_VIEW_OWN,
    ExpenseScope.DEPARTMENT: PERM_EXPENSES_VIEW_DEPARTMENT,
    ExpenseScope.ALL: PERM_EXPENSES_VIEW_ALL,
}

# Held by whoever may act on the manager / finance step of the approval chain.
PERM_APPROVE_MANAGER_STEP = "approvals.act_manager_step"
PERM_APPROVE_FINANCE_STEP = "approvals.act_finance_step"
PERMISSION_FOR_STEP: dict[ApprovalStep, str] = {
    ApprovalStep.MANAGER: PERM_APPROVE_MANAGER_STEP,
    ApprovalStep.FINANCE: PERM_APPROVE_FINANCE_STEP,
}

# --------------------------------------------------------------------------- #
# Budgets
# --------------------------------------------------------------------------- #
class BudgetPeriod(str, Enum):
    MONTHLY = "monthly"
    ANNUAL = "annual"


# Percent-of-budget levels that trigger an email alert (post-MVP feature; the
# `Budget.last_alert_level` column is reserved so no migration is needed later).
BUDGET_ALERT_THRESHOLDS = (80, 90)

# --------------------------------------------------------------------------- #
# Categories
# --------------------------------------------------------------------------- #
# (name, description) pairs inserted by the seed script.
DEFAULT_CATEGORIES: tuple[tuple[str, str], ...] = (
    ("Food", "Meals, drinks and hospitality."),
    ("Travel", "Flights, hotels and accommodation."),
    ("Transportation", "Taxis, fuel, parking and local transport."),
    ("Office Supplies", "Stationery, small equipment and consumables."),
)

# --------------------------------------------------------------------------- #
# Authentication
# --------------------------------------------------------------------------- #
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"
MIN_PASSWORD_LENGTH = 8

# --------------------------------------------------------------------------- #
# Attachments (receipts / invoices)
# --------------------------------------------------------------------------- #
MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_ATTACHMENT_CONTENT_TYPES = ("image/jpeg", "image/png", "application/pdf")

# --------------------------------------------------------------------------- #
# Pagination
# --------------------------------------------------------------------------- #
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

# --------------------------------------------------------------------------- #
# Money
# --------------------------------------------------------------------------- #
MONEY_MAX_DIGITS = 12
MONEY_DECIMAL_PLACES = 2

# --------------------------------------------------------------------------- #
# Email notifications (MVP events only)
# --------------------------------------------------------------------------- #
class EmailEvent(str, Enum):
    NEW_REQUEST_FOR_MANAGER = "new_request_for_manager"   # -> requester's manager
    REVIEW_NEEDED_FOR_FINANCE = "review_needed_for_finance"  # -> users holding the finance-step permission
    REQUEST_APPROVED = "request_approved"                 # -> requester (final approval)
    REQUEST_REJECTED = "request_rejected"                 # -> requester
    CHANGES_REQUESTED = "changes_requested"               # -> requester
    WELCOME_NEW_USER = "welcome_new_user"                 # -> newly created user


EMAIL_SUBJECTS: dict[EmailEvent, str] = {
    EmailEvent.NEW_REQUEST_FOR_MANAGER: "New expense request awaiting your approval",
    EmailEvent.REVIEW_NEEDED_FOR_FINANCE: "Expense request awaiting finance review",
    EmailEvent.REQUEST_APPROVED: "Your expense request was approved",
    EmailEvent.REQUEST_REJECTED: "Your expense request was rejected",
    EmailEvent.CHANGES_REQUESTED: "Changes requested on your expense request",
    EmailEvent.WELCOME_NEW_USER: "Your account has been created",
}

# --------------------------------------------------------------------------- #
# Error messages (use these instead of inline strings so wording stays consistent)
# --------------------------------------------------------------------------- #
class ErrorMessage:
    NOT_IMPLEMENTED = "This endpoint is defined but not implemented yet."
    INVALID_CREDENTIALS = "Incorrect username or password."
    INVALID_TOKEN = "Could not validate credentials."
    ACCOUNT_DISABLED = "This account is disabled."
    PERMISSION_DENIED = "You do not have the required permission."
    USER_NOT_FOUND = "User not found."
    USERNAME_RESERVED = "This username is reserved."
    DUPLICATE_VALUE = "A record with this value already exists."
    WRONG_CURRENT_PASSWORD = "Current password is incorrect."
    EXPENSE_NOT_FOUND = "Expense request not found."
    EXPENSE_NOT_EDITABLE = "This expense request can no longer be edited."
    INVALID_STATUS_TRANSITION = "This action is not allowed for the request's current status."
    NOTE_REQUIRED = "A note is required for this decision."
    NOT_YOUR_APPROVAL = "You are not the approver for this request."
    POLICY_CATEGORY_NOT_ALLOWED = "This category is not allowed by company policy."
    POLICY_AMOUNT_EXCEEDED = "The amount exceeds the maximum allowed for this category."
    ATTACHMENT_TYPE_NOT_ALLOWED = "Unsupported attachment type."
    ATTACHMENT_TOO_LARGE = "The attachment exceeds the maximum allowed size."
    ATTACHMENT_NOT_FOUND = "This expense request has no attachment."
    NO_MANAGER_ASSIGNED = "The requester has no manager assigned."
    RESOURCE_IN_USE = "This record is referenced by other data and cannot be deleted."
