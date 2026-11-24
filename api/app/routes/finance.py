"""Finance API: departments, category spending limits, monthly budgets, and the AI summary.

Only finance admins can create or change departments, budgets, and limits.
"""
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_roles
from app.db.session import get_db
from app.models.budget import Budget
from app.models.category import Category
from app.models.department import Department
from app.models.enums import ExpenseStatus, UserRole
from app.models.expense import Expense
from app.models.expense_limit import ExpenseLimit
from app.models.user import User
from app.schemas.finance import (
    AnomalySummary,
    BudgetCreate,
    BudgetRead,
    BudgetUpdate,
    BudgetUsageRead,
    DepartmentCreate,
    DepartmentRead,
    DepartmentUpdate,
    ExpenseLimitCreate,
    ExpenseLimitRead,
    ExpenseLimitUpdate,
)
from app.services.finance_service import budget_usage

router = APIRouter(tags=["Finance"])
_finance = require_roles(UserRole.FINANCE_ADMIN)


def approved_spent(db: Session, department_id: int, year: int, month: int) -> Decimal:
    """Total of approved expenses for one department in one month."""
    total = db.scalar(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.department_id == department_id,
            Expense.status == ExpenseStatus.APPROVED,
            extract("year", Expense.expense_date) == year,
            extract("month", Expense.expense_date) == month,
        )
    )
    return Decimal(total)


def check_department_name(db: Session, name: str, department_id: int | None = None) -> None:
    """Stop with 409 if another department already uses this name."""
    query = select(Department).where(Department.name == name)
    if department_id is not None:
        query = query.where(Department.id != department_id)
    if db.scalar(query):
        raise HTTPException(status_code=409, detail="A department with this name already exists")


def check_manager(db: Session, manager_id: int, department_id: int | None = None) -> None:
    """Stop if the user is missing, is not a manager, or already manages another department."""
    user = db.get(User, manager_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Manager user not found")
    if user.role != UserRole.MANAGER:
        raise HTTPException(status_code=400, detail="This user does not have the manager role")
    query = select(Department).where(Department.manager_id == manager_id)
    if department_id is not None:
        query = query.where(Department.id != department_id)
    if db.scalar(query):
        raise HTTPException(status_code=409, detail="This manager already manages another department")


# ---------- Departments ----------
@router.get("/departments", response_model=list[DepartmentRead])
def list_departments(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return list(db.scalars(select(Department).order_by(Department.name)).all())


@router.post("/departments", response_model=DepartmentRead, status_code=status.HTTP_201_CREATED)
def create_department(payload: DepartmentCreate, db: Session = Depends(get_db), _: User = Depends(_finance)):
    check_department_name(db, payload.name)
    if payload.manager_id is not None:
        check_manager(db, payload.manager_id)
    department = Department(name=payload.name, manager_id=payload.manager_id)
    db.add(department)
    db.commit()
    db.refresh(department)
    return department


@router.patch("/departments/{department_id}", response_model=DepartmentRead)
def update_department(
    department_id: int, payload: DepartmentUpdate, db: Session = Depends(get_db), _: User = Depends(_finance)
):
    department = db.get(Department, department_id)
    if department is None:
        raise HTTPException(status_code=404, detail="Department not found")
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("name") is not None:
        check_department_name(db, changes["name"], department_id)
        department.name = changes["name"]
    if "manager_id" in changes:
        if changes["manager_id"] is not None:
            check_manager(db, changes["manager_id"], department_id)
        department.manager_id = changes["manager_id"]
    db.commit()
    db.refresh(department)
    return department


# ---------- Monthly budgets ----------
@router.get("/budgets", response_model=list[BudgetRead])
def list_budgets(
    year: int | None = Query(None, ge=2000, le=2100),
    month: int | None = Query(None, ge=1, le=12),
    db: Session = Depends(get_db),
    _: User = Depends(_finance),
):
    query = select(Budget).order_by(Budget.year, Budget.month, Budget.department_id)
    if year is not None:
        query = query.where(Budget.year == year)
    if month is not None:
        query = query.where(Budget.month == month)
    return list(db.scalars(query).all())


@router.post("/budgets", response_model=BudgetRead, status_code=status.HTTP_201_CREATED)
def create_budget(payload: BudgetCreate, db: Session = Depends(get_db), _: User = Depends(_finance)):
    if db.get(Department, payload.department_id) is None:
        raise HTTPException(status_code=404, detail="Department not found")
    duplicate = db.scalar(
        select(Budget).where(
            Budget.department_id == payload.department_id,
            Budget.year == payload.year,
            Budget.month == payload.month,
        )
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="This department already has a budget for that month")
    budget = Budget(**payload.model_dump())
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


@router.patch("/budgets/{budget_id}", response_model=BudgetRead)
def update_budget(
    budget_id: int, payload: BudgetUpdate, db: Session = Depends(get_db), _: User = Depends(_finance)
):
    budget = db.get(Budget, budget_id)
    if budget is None:
        raise HTTPException(status_code=404, detail="Budget not found")
    budget.amount = payload.amount
    db.commit()
    db.refresh(budget)
    return budget


@router.delete("/budgets/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(budget_id: int, db: Session = Depends(get_db), _: User = Depends(_finance)):
    budget = db.get(Budget, budget_id)
    if budget is None:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(budget)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/budgets/{budget_id}/usage", response_model=BudgetUsageRead)
def get_budget_usage(budget_id: int, db: Session = Depends(get_db), _: User = Depends(_finance)):
    budget = db.get(Budget, budget_id)
    if budget is None:
        raise HTTPException(status_code=404, detail="Budget not found")
    spent = approved_spent(db, budget.department_id, budget.year, budget.month)
    return budget_usage(spent, budget.amount)


# ---------- Category spending limits ----------
@router.get("/expense-limits", response_model=list[ExpenseLimitRead])
def list_expense_limits(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return list(db.scalars(select(ExpenseLimit).order_by(ExpenseLimit.category_id)).all())


@router.post("/expense-limits", response_model=ExpenseLimitRead, status_code=status.HTTP_201_CREATED)
def create_expense_limit(
    payload: ExpenseLimitCreate, db: Session = Depends(get_db), _: User = Depends(_finance)
):
    if db.get(Category, payload.category_id) is None:
        raise HTTPException(status_code=404, detail="Category not found")
    duplicate = db.scalar(select(ExpenseLimit).where(ExpenseLimit.category_id == payload.category_id))
    if duplicate:
        raise HTTPException(status_code=409, detail="This category already has a limit. Edit it instead")
    limit = ExpenseLimit(**payload.model_dump())
    db.add(limit)
    db.commit()
    db.refresh(limit)
    return limit


@router.patch("/expense-limits/{limit_id}", response_model=ExpenseLimitRead)
def update_expense_limit(
    limit_id: int, payload: ExpenseLimitUpdate, db: Session = Depends(get_db), _: User = Depends(_finance)
):
    limit = db.get(ExpenseLimit, limit_id)
    if limit is None:
        raise HTTPException(status_code=404, detail="Expense limit not found")
    limit.max_amount = payload.max_amount
    db.commit()
    db.refresh(limit)
    return limit


@router.delete("/expense-limits/{limit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense_limit(limit_id: int, db: Session = Depends(get_db), _: User = Depends(_finance)):
    limit = db.get(ExpenseLimit, limit_id)
    if limit is None:
        raise HTTPException(status_code=404, detail="Expense limit not found")
    db.delete(limit)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Finance dashboard: unusual requests (ML contract C9) ----------
@router.get("/dashboard/finance/anomalies", response_model=AnomalySummary)
def anomaly_summary(
    year: int | None = Query(None, ge=2000, le=2100),
    month: int | None = Query(None, ge=1, le=12),
    db: Session = Depends(get_db),
    _: User = Depends(_finance),
):
    """How many requests the AI marked high / medium / low in one month (this month by default)."""
    today = date.today()
    year = year or today.year
    month = month or today.month
    expenses = db.scalars(
        select(Expense).where(
            extract("year", Expense.expense_date) == year,
            extract("month", Expense.expense_date) == month,
        )
    ).all()

    counts = {"high": 0, "medium": 0, "low": 0, "not_scored": 0}
    departments = {}
    reasons = {}
    for expense in expenses:
        level = getattr(expense.risk_level, "value", expense.risk_level)
        if level is None:
            counts["not_scored"] += 1
            continue
        level = level.lower()
        counts[level] += 1

        row = departments.setdefault(
            expense.department_id,
            {
                "department_id": expense.department_id,
                "department_name": expense.department.name if expense.department else "Unassigned",
                "flagged": 0,
                "total": 0,
            },
        )
        row["total"] += 1
        if level in ("medium", "high"):
            row["flagged"] += 1
            for reason in expense.risk_justification or []:
                item = reasons.setdefault(reason["code"], {**reason, "count": 0})
                item["count"] += 1

    by_department = []
    for row in departments.values():
        row["flagged_percent"] = round(row["flagged"] / row["total"] * 100, 1)
        by_department.append(row)
    by_department.sort(key=lambda row: row["flagged_percent"], reverse=True)
    top_reasons = sorted(reasons.values(), key=lambda item: item["count"], reverse=True)[:5]
    return {"counts": counts, "by_department": by_department, "top_reasons": top_reasons}