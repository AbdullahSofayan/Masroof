"""Departments."""
from sqlalchemy.orm import Session

from app.models.department import Department
from app.models.user import User
from app.schemas.department import DepartmentCreate, DepartmentUpdate


class DepartmentService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_departments(self, page: int, size: int) -> tuple[list[Department], int]:
        raise NotImplementedError

    def get_department(self, department_id: int) -> Department:
        """Return the department or raise NotFoundError."""
        raise NotImplementedError

    def create_department(self, data: DepartmentCreate) -> Department:
        """Name must be unique; `manager_id`, when given, must be an existing user."""
        raise NotImplementedError

    def update_department(self, department_id: int, data: DepartmentUpdate) -> Department:
        raise NotImplementedError

    def delete_department(self, department_id: int) -> None:
        """Raise ConflictError(RESOURCE_IN_USE) if employees or expenses still reference it."""
        raise NotImplementedError

    def list_employees(self, department_id: int, page: int, size: int) -> tuple[list[User], int]:
        """Users that belong to the department."""
        raise NotImplementedError
