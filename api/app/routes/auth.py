from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from app.core.dependencies import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models import Department, User, UserRole
from app.schemas.users import LoginRequest, TokenResponse, UserRead, UserRegister

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    # Public registration always creates an employee; clients cannot self-assign privileged roles.
    exists = db.scalar(select(User).where(or_(User.username == payload.username, User.email == str(payload.email))))
    if exists:
        raise HTTPException(status_code=409, detail="Username or email is already registered")
    if payload.department_id is not None and db.get(Department, payload.department_id) is None:
        raise HTTPException(status_code=404, detail="Department not found")
    user = User(username=payload.username, email=str(payload.email).lower(), full_name=payload.full_name,
                password_hash=hash_password(payload.password), role=UserRole.EMPLOYEE,
                department_id=payload.department_id)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(or_(User.username == payload.username, User.email == payload.username.lower())))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username/email or password", headers={"WWW-Authenticate": "Bearer"})
    return TokenResponse(access_token=create_access_token(str(user.id)))

@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return current_user
