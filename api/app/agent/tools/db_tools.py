from datetime import date
from decimal import Decimal

from langchain_core.tools import tool
from sqlalchemy import extract, func, select
from sqlalchemy.orm import joinedload

from app.agent.context import Scope, agent_session, apply_scope
from app.agent.serializers import serialize_expense
from app.models import (
    Budget, Category, Department, Expense, ExpenseLimit, ExpenseStatus, RiskLevel,
    UserRole,
)
from app.services.finance_service import budget_usage


def _expense_query(scope):
    return apply_scope(
        select(Expense).options(
            joinedload(Expense.category),
            joinedload(Expense.department),
            joinedload(Expense.requester),
        ),
        scope,
    )


def build_db_tools(scope: Scope):
    @tool
    def get_expenses(
        status: str = "",
        category: str = "",
        date_from: str = "",
        date_to: str = "",
        limit: int = 20,
    ) -> dict:
        """List expenses visible to the current user, optionally filtered by status, category, and dates."""
        try:
            with agent_session() as db:
                stmt = _expense_query(scope)
                if status:
                    stmt = stmt.where(Expense.status == ExpenseStatus(status))
                if category:
                    stmt = stmt.join(Category).where(Category.name.ilike(f"%{category}%"))
                if date_from:
                    stmt = stmt.where(Expense.expense_date >= date.fromisoformat(date_from))
                if date_to:
                    stmt = stmt.where(Expense.expense_date <= date.fromisoformat(date_to))
                rows = db.scalars(stmt.order_by(Expense.expense_date.desc(), Expense.id.desc()).limit(max(1, min(limit, 50)))).unique().all()
                return {"count": len(rows), "expenses": [serialize_expense(row, scope) for row in rows]}
        except Exception as exc:
            return {"error": str(exc)}

    @tool
    def get_expense_details(expense_id: int) -> dict:
        """Get one expense by ID, only if it is inside the current user's access scope."""
        try:
            with agent_session() as db:
                row = db.scalars(_expense_query(scope).where(Expense.id == expense_id)).unique().first()
                if row is None:
                    return {"error": "Expense not found"}
                result = serialize_expense(row, scope)
                if scope.role in (UserRole.MANAGER, UserRole.FINANCE_ADMIN):
                    result["manager_note"] = row.manager_note
                return result
        except Exception as exc:
            return {"error": str(exc)}

    @tool
    def get_spending_summary(
        group_by: str = "category",
        date_from: str = "",
        date_to: str = "",
    ) -> dict:
        """Summarize approved spending by category, month, or department (department is finance-only)."""
        try:
            if group_by not in {"category", "month", "department"}:
                return {"error": "group_by must be category, month, or department"}
            if group_by == "department" and scope.role != UserRole.FINANCE_ADMIN:
                return {"error": "Department grouping is available to finance administrators only"}
            with agent_session() as db:
                stmt = _expense_query(scope).where(Expense.status == ExpenseStatus.APPROVED)
                if date_from:
                    stmt = stmt.where(Expense.expense_date >= date.fromisoformat(date_from))
                if date_to:
                    stmt = stmt.where(Expense.expense_date <= date.fromisoformat(date_to))
                rows = db.scalars(stmt).unique().all()
                totals = {}
                for row in rows:
                    if group_by == "category":
                        key = row.category.name if row.category else "Uncategorized"
                    elif group_by == "department":
                        key = row.department.name if row.department else "Unassigned"
                    else:
                        key = row.expense_date.strftime("%Y-%m")
                    totals[key] = totals.get(key, Decimal("0")) + row.amount
                return {
                    "status": "Approved",
                    "group_by": group_by,
                    "total_sar": str(sum(totals.values(), Decimal("0"))),
                    "groups": [{"name": key, "amount_sar": str(value)} for key, value in sorted(totals.items())],
                }
        except Exception as exc:
            return {"error": str(exc)}

    @tool
    def get_budget_status(month: str = "", department_id: int = 0) -> dict:
        """Get monthly approved spend and budget remaining. Managers are fixed to their own department; employees are denied."""
        try:
            if scope.role == UserRole.EMPLOYEE:
                return {"error": "Budget information is not available to employees"}
            if scope.role == UserRole.MANAGER:
                if scope.department_id is None:
                    return {"error": "Your account has no department"}
                target_department = scope.department_id
            else:
                target_department = department_id or None
                if target_department is None:
                    return {"error": "Finance must specify a department_id"}
            period = date.fromisoformat((month or date.today().strftime("%Y-%m")) + "-01")
            with agent_session() as db:
                budget = db.scalar(select(Budget).where(
                    Budget.department_id == target_department,
                    Budget.year == period.year,
                    Budget.month == period.month,
                ))
                spent = db.scalar(select(func.coalesce(func.sum(Expense.amount), 0)).where(
                    Expense.department_id == target_department,
                    Expense.status == ExpenseStatus.APPROVED,
                    extract("year", Expense.expense_date) == period.year,
                    extract("month", Expense.expense_date) == period.month,
                )) or Decimal("0")
                department = db.get(Department, target_department)
                if budget is None:
                    return {"department": department.name if department else None, "month": month or period.strftime("%Y-%m"), "error": "No budget is configured for this department and month", "spent_sar": str(spent)}
                return {
                    "department": department.name if department else None,
                    "month": period.strftime("%Y-%m"),
                    **{key: str(value) for key, value in budget_usage(Decimal(spent), Decimal(budget.amount)).items()},
                }
        except Exception as exc:
            return {"error": str(exc)}

    @tool
    def get_category_limits() -> dict:
        """List configured expense limits for all categories."""
        try:
            with agent_session() as db:
                rows = db.execute(select(Category.name, ExpenseLimit.max_amount).join(
                    ExpenseLimit, ExpenseLimit.category_id == Category.id, isouter=True
                ).order_by(Category.name)).all()
                return {"limits": [{"category": name, "max_amount_sar": str(amount) if amount is not None else None} for name, amount in rows]}
        except Exception as exc:
            return {"error": str(exc)}

    @tool
    def get_flagged_requests(risk_level: str = "", limit: int = 20) -> dict:
        """List medium/high risk expenses in the manager's department or organization-wide for finance. Never returns anomaly scores."""
        try:
            if scope.role == UserRole.EMPLOYEE:
                return {"error": "Risk information is not available to employees"}
            stmt = _expense_query(scope).where(Expense.risk_level.is_not(None))
            if risk_level:
                level = RiskLevel(risk_level.lower())
                if level not in (RiskLevel.MEDIUM, RiskLevel.HIGH):
                    return {"error": "risk_level must be medium or high"}
                stmt = stmt.where(Expense.risk_level == level)
            else:
                stmt = stmt.where(Expense.risk_level.in_([RiskLevel.MEDIUM, RiskLevel.HIGH]))
            with agent_session() as db:
                rows = db.scalars(stmt.order_by(Expense.expense_date.desc()).limit(max(1, min(limit, 50)))).unique().all()
                return {"count": len(rows), "requests": [serialize_expense(row, scope) for row in rows]}
        except Exception as exc:
            return {"error": str(exc)}

    return [
        get_expenses, get_expense_details, get_spending_summary,
        get_budget_status, get_category_limits, get_flagged_requests,
    ]
