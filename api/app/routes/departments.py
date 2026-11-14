"""Departments."""
from typing import Annotated

from fastapi import APIRouter, Path, status

from app.core.deps import DbSession, Pagination
from app.core.exceptions import not_implemented
from app.core.permissions import protected
from app.schemas.common import Page
from app.schemas.department import DepartmentCreate, DepartmentRead, DepartmentUpdate
from app.schemas.user import UserRead

router = APIRouter(prefix="/departments", tags=["Departments"])

DepartmentId = Annotated[int, Path(ge=1, description="ID of the department.")]
NOT_FOUND = {404: {"description": "Department not found."}}


@router.get(
    "",
    response_model=Page[DepartmentRead],
    summary="List departments",
    **protected("departments.list", "List departments"),
)
def list_departments(db: DbSession, page: Pagination):
    # Delegates to DepartmentService.list_departments(...)
    not_implemented()


@router.post(
    "",
    response_model=DepartmentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a department",
    **protected(
        "departments.create",
        "Create departments",
        responses={409: {"description": "A department with this name already exists."}},
    ),
)
def create_department(body: DepartmentCreate, db: DbSession):
    # Delegates to DepartmentService.create_department(...)
    not_implemented()


@router.get(
    "/{department_id}",
    response_model=DepartmentRead,
    summary="Get a department",
    **protected("departments.view", "View a department", responses=NOT_FOUND),
)
def get_department(department_id: DepartmentId, db: DbSession):
    # Delegates to DepartmentService.get_department(...)
    not_implemented()


@router.patch(
    "/{department_id}",
    response_model=DepartmentRead,
    summary="Update a department",
    **protected(
        "departments.update",
        "Edit departments and assign their manager",
        details="Partial update. Setting `manager_id` assigns the department's manager.",
        responses=NOT_FOUND,
    ),
)
def update_department(department_id: DepartmentId, body: DepartmentUpdate, db: DbSession):
    # Delegates to DepartmentService.update_department(...)
    not_implemented()


@router.delete(
    "/{department_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a department",
    **protected(
        "departments.delete",
        "Delete departments",
        responses={**NOT_FOUND, 409: {"description": "Department still has employees or expenses."}},
    ),
)
def delete_department(department_id: DepartmentId, db: DbSession):
    # Delegates to DepartmentService.delete_department(...)
    not_implemented()


@router.get(
    "/{department_id}/employees",
    response_model=Page[UserRead],
    summary="List a department's employees",
    **protected("departments.view_employees", "List the employees of a department", responses=NOT_FOUND),
)
def list_department_employees(department_id: DepartmentId, db: DbSession, page: Pagination):
    # Delegates to DepartmentService.list_employees(...)
    not_implemented()
