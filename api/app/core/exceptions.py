"""Shared error types.

All of them are `HTTPException` subclasses, so raising one anywhere (route or
service) produces the right HTTP status and a `{"detail": "..."}` body with no
extra handler registration.
"""
from typing import NoReturn

from fastapi import HTTPException, status

from app.core.constants import ErrorMessage


class AppError(HTTPException):
    """Base class. Subclasses set `status_code` and a default message."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Bad request."

    def __init__(self, detail: str | None = None) -> None:
        super().__init__(status_code=self.status_code, detail=detail or self.default_detail)


class UnauthorizedError(AppError):
    """401 - missing/invalid/expired credentials."""

    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = ErrorMessage.INVALID_TOKEN

    def __init__(self, detail: str | None = None) -> None:
        super().__init__(detail)
        self.headers = {"WWW-Authenticate": "Bearer"}


class ForbiddenError(AppError):
    """403 - authenticated but lacking the permission / not allowed to act."""

    status_code = status.HTTP_403_FORBIDDEN
    default_detail = ErrorMessage.PERMISSION_DENIED


class NotFoundError(AppError):
    """404 - record does not exist (or is outside the caller's visibility scope)."""

    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "Resource not found."


class ConflictError(AppError):
    """409 - duplicate value, or record still referenced elsewhere."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = ErrorMessage.DUPLICATE_VALUE


class WorkflowError(AppError):
    """409 - action not valid for the expense's current status."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = ErrorMessage.INVALID_STATUS_TRANSITION


class PolicyViolationError(AppError):
    """422 - the request breaks a company expense policy."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_detail = "The request violates an expense policy."


def not_implemented(detail: str = ErrorMessage.NOT_IMPLEMENTED) -> NoReturn:
    """Placeholder used by every route body until the team implements it (HTTP 501)."""
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=detail)
