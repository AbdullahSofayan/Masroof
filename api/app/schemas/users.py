from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator
from app.models.enums import UserRole

class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=80, pattern=r"^[A-Za-z0-9_.-]+$")
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=160)
    password: str = Field(min_length=8, max_length=72)
    department_id: int | None = None

class UserCreate(UserRegister):
    role: UserRole = UserRole.EMPLOYEE

class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=80, pattern=r"^[A-Za-z0-9_.-]+$")
    email: EmailStr | None = None
    full_name: str | None = Field(default=None, min_length=1, max_length=160)
    password: str | None = Field(default=None, min_length=8, max_length=72)
    role: UserRole | None = None
    department_id: int | None = None

class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: EmailStr
    full_name: str
    role: UserRole
    department_id: int | None
    created_at: datetime

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
