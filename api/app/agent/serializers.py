from app.agent.context import Scope
from app.models import Expense, UserRole


def serialize_expense(expense: Expense, scope: Scope) -> dict:
    result = {
        "id": expense.id,
        "amount_sar": str(expense.amount),
        "description": expense.description,
        "expense_date": expense.expense_date.isoformat(),
        "status": expense.status.value,
        "category": expense.category.name if expense.category else None,
        "department": expense.department.name if expense.department else None,
    }
    if scope.role in (UserRole.MANAGER, UserRole.FINANCE_ADMIN):
        result["requester_name"] = (
            expense.requester.full_name if expense.requester else None
        )
        result["risk_level"] = (
            expense.risk_level.value if expense.risk_level else None
        )
        result["risk_justification"] = expense.risk_justification or []
        result["manager_note"] = expense.manager_note
    return result
