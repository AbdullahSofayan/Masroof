from datetime import datetime, timezone
from logging import getLogger

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models import Budget, Category, Expense, ExpenseLimit, ExpenseStatus, RiskLevel, User, UserRole
from app.routes.finance import approved_spent
from app.schemas.expenses import (ExpenseAnomalyAnalysis, ExpenseApprove, ExpenseCreate, ExpenseListResponse,
ExpenseReference, ExpenseReject, ExpenseResponse, ExpenseUpdate)
from app.services.decision_engine import evaluate_expense
from app.services.receipt_service import read_receipt_upload, receipt_file, receipt_types, save_receipt
from app.services.anomaly_service import score_saved_expense

router = APIRouter(tags=["Expenses"])
expense_router = APIRouter(prefix="/expenses")
logger = getLogger(__name__)


##=-=-=-=-=-=- Expense helpers =-=-=-=-=-=-

##turn the MySQL expense row into the response sent to the frontend
def expense_response(expense: Expense, current_user: User) -> ExpenseResponse:
    ##prepare the saved risk level and reasons for the manager's review page
    ai_analysis = None
    if (
        current_user.role == UserRole.MANAGER
        and current_user.department_id == expense.department_id
        and expense.risk_level is not None
    ):
        ai_analysis = ExpenseAnomalyAnalysis(
            risk_level=expense.risk_level.value,
            reasons=expense.risk_justification or [],
        )
    return ExpenseResponse(
        id=expense.id,
        amount=expense.amount,
        category_id=expense.category_id,
        description=expense.description,
        expense_date=expense.expense_date,
        status=expense.status.value.lower(),
        manager_note=expense.manager_note,
        requester_id=expense.requester_id,
        department_id=expense.department_id,
        requester={"id": expense.requester_id, "full_name": expense.requester.full_name},
        department={"id": expense.department_id, "name": expense.department.name},
        category={"id": expense.category_id, "name": expense.category.name},
        created_at=expense.created_at,
        reviewed_at=expense.reviewed_at,
        reviewer_name=expense.reviewer.full_name if expense.reviewer else None,
        attachment_url=f"/expenses/{expense.id}/attachment" if expense.receipt_path else None,
        warnings=expense.warnings or [],
        ai_analysis=ai_analysis,
    )


##check the category limit and the budget for the expense month
def expense_warnings(db: Session, expense: Expense) -> list[str]:
    year = expense.expense_date.year
    month = expense.expense_date.month
    category_limit = db.scalar(
        select(ExpenseLimit.max_amount).where(ExpenseLimit.category_id == expense.category_id)
    )
    monthly_budget = db.scalar(
        select(Budget.amount).where(
            Budget.department_id == expense.department_id,
            Budget.year == year,
            Budget.month == month,
        )
    )
    evaluation = evaluate_expense(
        amount=expense.amount,
        category_limit=category_limit,
        monthly_spent=approved_spent(db, expense.department_id, year, month),
        monthly_budget=monthly_budget,
    )
    return evaluation["warnings"]





##=-=-=-=-=-=- Categories =-=-=-=-=-=-
##return the categories the employee can select in the expense form
@router.get("/categories", response_model=list[ExpenseReference])
def get_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    categories = db.scalars(select(Category).order_by(Category.id)).all()
    return [ExpenseReference(id=category.id, name=category.name) for category in categories]






##=-=-=-=-=-=- Create expenses =-=-=-=-=-=-
##save a new pending expense with its warnings and the employee's department
@expense_router.post("", status_code=201, response_model=ExpenseResponse)
def create_expense(
    expense: ExpenseCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.EMPLOYEE:
        raise HTTPException(status_code=403, detail="Only employees can create expenses.")
    if current_user.department_id is None:
        raise HTTPException(status_code=403, detail="Employee has no department.")
    if db.get(Category, expense.category_id) is None:
        raise HTTPException(status_code=404, detail="Expense category not found.")

    new_expense = Expense(
        **expense.model_dump(),
        requester_id=current_user.id,
        department_id=current_user.department_id,
        status=ExpenseStatus.PENDING,
    )
    new_expense.warnings = expense_warnings(db, new_expense)
    db.add(new_expense)
    db.commit()
    db.refresh(new_expense)
    background_tasks.add_task(score_saved_expense, new_expense.id)
    return expense_response(new_expense, current_user)






##=-=-=-=-=-=- Read expenses =-=-=-=-=-=-

##show employees their own requests and managers requests from their department
def visible_expenses_query(current_user: User):
    query = select(Expense)
    if current_user.role == UserRole.EMPLOYEE:
        return query.where(Expense.requester_id == current_user.id)
    if current_user.role == UserRole.MANAGER:
        if current_user.department_id is None:
            raise HTTPException(status_code=403, detail="Manager has no department.")
        return query.where(Expense.department_id == current_user.department_id)
    raise HTTPException(status_code=403, detail="Insufficient permissions.")


##return the expenses the user can see, one page at a time
@expense_router.get("", response_model=ExpenseListResponse)
def get_expenses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=100, ge=1, le=100),
    status: str | None = Query(default=None),
):
    # finance uses the company-wide list to calculate spending across departments
    query = (
        select(Expense)
        if current_user.role == UserRole.FINANCE_ADMIN
        else visible_expenses_query(current_user)
    )
    if status is not None:
        try:
            expense_status = ExpenseStatus(status.strip().capitalize())
        except ValueError as error:
            raise HTTPException(status_code=422, detail="Invalid expense status.") from error
        query = query.where(Expense.status == expense_status)

    ## put higher-risk requests first in the manager's pending queue
    ordering = [Expense.id.desc()]
    if current_user.role == UserRole.MANAGER:
        pending = Expense.status == ExpenseStatus.PENDING
        risk_order = case(
            (Expense.risk_level == RiskLevel.HIGH, 0),
            (Expense.risk_level == RiskLevel.MEDIUM, 1),
            (Expense.risk_level == RiskLevel.LOW, 2),
            else_=3,
        )
        ordering = [
            case((pending, 0), else_=1),
            case((pending, risk_order)),
            case((pending, Expense.created_at)).asc(),
            case((pending, Expense.id)).asc(),
            Expense.id.desc(),
        ]

    ##count all matching expenses before taking one page
    total = db.scalar(query.with_only_columns(func.count(), maintain_column_froms=True))
    rows = db.scalars(
        query.options(
            selectinload(Expense.requester),
            selectinload(Expense.department),
            selectinload(Expense.category),
            selectinload(Expense.reviewer),
        ).order_by(*ordering).offset((page - 1) * size).limit(size)
    ).all()
    return ExpenseListResponse(
        items=[expense_response(row, current_user) for row in rows],
        total=total,
        page=page,
        size=size,
    )






##return one expense if it matches the user's permissions
@expense_router.get("/{expense_id}", response_model=ExpenseResponse)
def get_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = visible_expenses_query(current_user).where(Expense.id == expense_id)
    row = db.scalar(query)
    if row is None:
        raise HTTPException(status_code=404, detail="Expense not found.")
    return expense_response(row, current_user)






##=-=-=-=-=-=- Edit pending expenses =-=-=-=-=-=-

##let the employee update their own pending expense and refresh its warnings
@expense_router.patch("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: int,
    data: ExpenseUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.EMPLOYEE:
        raise HTTPException(status_code=403, detail="Only employees can edit expenses.")


    ##lock the request so the manager cannot review it during the edit
    query = visible_expenses_query(current_user).where(Expense.id == expense_id)
    expense = db.scalar(query.with_for_update())
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found.")
    if expense.status != ExpenseStatus.PENDING:
        raise HTTPException(status_code=409, detail="Only Pending expenses can be edited.")


    ##update only the fields that changed
    changes = {
        field: value
        for field, value in data.model_dump(exclude_unset=True).items()
        if getattr(expense, field) != value
    }
    if "category_id" in changes and db.get(Category, changes["category_id"]) is None:
        raise HTTPException(status_code=404, detail="Expense category not found.")
    previous_date = expense.expense_date
    for field, value in changes.items():
        setattr(expense, field, value)


    ##recalculate warnings when the amount, category, or date changes
    if changes.keys() & {"amount", "category_id", "expense_date"}:
        expense.warnings = expense_warnings(db, expense)

    ##clear the old AI results when the expense details change
    if changes:
        expense.risk_level = None
        expense.anomaly_score = None
        expense.risk_justification = None

    response = expense_response(expense, current_user)
    db.commit()

    ## score the expense again after saving the changes
    if changes:
        background_tasks.add_task(score_saved_expense, expense_id, previous_date)

    return response






##=-=-=-=-=-=- Approve and reject expenses =-=-=-=-=-=-

##save the manager's decision, note, and review time for a pending request
def review_expense(
    expense_id: int,
    current_user: User,
    db: Session,
    decision: ExpenseStatus,
    note: str | None,
) -> ExpenseResponse:
    if current_user.role != UserRole.MANAGER:
        raise HTTPException(status_code=403, detail="Only managers can review expenses.")

    query = visible_expenses_query(current_user).where(Expense.id == expense_id)
    ##lock the request so two review decisions cannot be saved
    expense = db.scalar(query.with_for_update())
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found.")
    if expense.status != ExpenseStatus.PENDING:
        raise HTTPException(status_code=409, detail="Only Pending expenses can be reviewed.")

    if decision == ExpenseStatus.APPROVED and not expense.receipt_path:
        raise HTTPException(status_code=409, detail="Attach a receipt before approving.")

    expense.status = decision
    expense.reviewed_by = current_user.id
    expense.reviewed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    expense.manager_note = note or None
    response = expense_response(expense, current_user)
    db.commit()
    return response




##approve a pending request after checking that it has a receipt
@expense_router.post("/{expense_id}/approve", response_model=ExpenseResponse)
def approve_expense(
    expense_id: int,
    data: ExpenseApprove | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return review_expense(
        expense_id, current_user, db, ExpenseStatus.APPROVED, data.note if data else None
    )



##reject a pending request and save the manager's reason
@expense_router.post("/{expense_id}/reject", response_model=ExpenseResponse)
def reject_expense(
    expense_id: int,
    data: ExpenseReject,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return review_expense(
        expense_id, current_user, db, ExpenseStatus.REJECTED, data.reason
    )





##=-=-=-=-=-=- Expense receipts =-=-=-=-=-=-


##validate the receipt and save its file reference on the pending expense
@expense_router.post("/{expense_id}/attachment", response_model=ExpenseResponse)
def upload_receipt(
    expense_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.EMPLOYEE:
        raise HTTPException(status_code=403, detail="Only employees can upload receipts.")

    query = visible_expenses_query(current_user).where(Expense.id == expense_id)
    expense = db.scalar(query.with_for_update())
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found.")
    if expense.status != ExpenseStatus.PENDING:
        raise HTTPException(status_code=409, detail="Only Pending expenses can receive a receipt.")

    content, extension = read_receipt_upload(file)
    response = expense_response(expense, current_user)
    old_filename = expense.receipt_path
    expense.receipt_path = save_receipt(content, extension)
    db.commit()


    ##remove the old file after MySQL saves the new receipt reference
    if old_filename:
        try:
            receipt_file(old_filename).unlink(missing_ok=True)
        except (HTTPException, OSError):
            logger.warning("Could not remove the previous receipt for expense %s", expense_id)

    response.attachment_url = f"/expenses/{expense_id}/attachment"
    return response



##only the employee who submitted it or a manager in the same department can view it
@expense_router.get("/{expense_id}/attachment")
def get_receipt(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in (UserRole.EMPLOYEE, UserRole.MANAGER):
        raise HTTPException(status_code=403, detail="Insufficient permissions.")


    ##keep the receipt from being replaced while we read it
    query = visible_expenses_query(current_user).where(Expense.id == expense_id)
    expense = db.scalar(query.with_for_update())
    if expense is None or not expense.receipt_path:
        raise HTTPException(status_code=404, detail="Receipt not found.")

    path = receipt_file(expense.receipt_path)
    try:
        content = path.read_bytes()
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Receipt not found.") from error

    return Response(
        content=content,
        media_type=receipt_types[path.suffix],
        headers={
            "Content-Disposition": f'attachment; filename="receipt-{expense_id}{path.suffix}"',
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


router.include_router(expense_router)
