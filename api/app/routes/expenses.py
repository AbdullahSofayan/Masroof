from itertools import count

from fastapi import APIRouter, HTTPException

from app.schemas.expenses import ExpenseCreate, ExpenseReject, ExpenseResponse

# expense API router.
router = APIRouter(prefix="/expenses", tags=["Expenses"])

# temporary storage (will be replaced with mysql integration.)
expenses = []

# temporary expense id generator (mysql AUTO_INCREMENT will handle the generation later)
expense_id_count = count(1)


# Helper function to find an expense by its id (will use a database query instead)
def find_expense(expense_id: int):
    for expense in expenses:
        if expense["expense_id"] == expense_id:
            return expense

    raise HTTPException(status_code=404, detail="expense not found!")


# =-=-=-=-=-=-=-Employee=-=-=-=-=-=-=-=


# create a new expense request.


# Later:
# -Save the expense in MySQL.
# -Associate the expense with the authenticated employee.
@router.post("", status_code=201, response_model=ExpenseResponse)
def create_expense(expense: ExpenseCreate):
    new_expense = {
        "expense_id": next(expense_id_count),
        **expense.model_dump(mode="json"),
        "status": "Pending",
    }

    expenses.append(new_expense)
    return new_expense


# retrieve all expenses from temporary storage.


# Later:
# - Fetch expenses from MySQL.
# - Apply role-based access and employee/department filtering.
@router.get("", response_model=list[ExpenseResponse])
def get_expenses():
    return expenses


# retrieve a specific expense by id.


# Later :
# -Fetch the expense from MySQL.
# -Verify the current user's permission to view it.
@router.get("/{expense_id}", response_model=ExpenseResponse)
def get_expense(expense_id: int):
    return find_expense(expense_id)


# =-=-=-=-=-=-=-Finance Admin=-=-=-=-=-=-=-


# approve an expense request.

# Later:
# -Restrict this endpoint to authorized managers.
# -Verify that the expense belongs to the manager's department.
# -Persist the approval decision in MySQL.


@router.post("/{expense_id}/approve")
def approve_expense(expense_id: int):
    expense = find_expense(expense_id)
    if expense["status"] != "Pending":
        raise HTTPException(
            status_code=409, detail="only Pending expense can be approved"
        )
    expense["status"] = "Approved"
    return expense


# reject an expense request with a reason.
# Later:
# -Restrict this endpoint to authorized managers.
# -Verify that the expense belongs to the manager's department.
# -Save the rejection reason and updated status in MySQL.
@router.post("/{expense_id}/reject")
def reject_expense(expense_id: int, data: ExpenseReject):
    expense = find_expense(expense_id)
    if expense["status"] != "Pending":
        raise HTTPException(
            status_code=409, detail="only Pending expense can be rejected"
        )
    expense["status"] = "Rejected"
    expense["reason"] = data.reason
    return expense
