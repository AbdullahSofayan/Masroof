from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from app.core.dependencies import get_current_user, require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models import Department, User, UserRole
from app.schemas.users import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])
_admin = require_roles(UserRole.FINANCE_ADMIN)

@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db), _: User = Depends(_admin)):
    if db.scalar(select(User).where(or_(User.username == payload.username, User.email == str(payload.email)))):
        raise HTTPException(status_code=409, detail="Username or email is already registered")
    if payload.department_id is not None and db.get(Department, payload.department_id) is None:
        raise HTTPException(status_code=404, detail="Department not found")
    user = User(username=payload.username, email=str(payload.email).lower(), full_name=payload.full_name,
                password_hash=hash_password(payload.password), role=payload.role, department_id=payload.department_id)
    db.add(user); db.commit(); db.refresh(user)
    return user

@router.get("", response_model=list[UserRead])
def list_users(skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500),
               db: Session = Depends(get_db), _: User = Depends(_admin)):
    return list(db.scalars(select(User).order_by(User.id).offset(skip).limit(limit)).all())

@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.role != UserRole.FINANCE_ADMIN and current.id != user_id:
        raise HTTPException(status_code=403, detail="You can only view your own user profile")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.patch("/{user_id}", response_model=UserRead)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.role != UserRole.FINANCE_ADMIN and current.id != user_id:
        raise HTTPException(status_code=403, detail="You can only update your own profile")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    changes = payload.model_dump(exclude_unset=True)
    if current.role != UserRole.FINANCE_ADMIN and ({"role", "department_id"} & changes.keys()):
        raise HTTPException(status_code=403, detail="Only finance admins can change roles or departments")
    if "username" in changes or "email" in changes:
        username = changes.get("username", user.username)
        email = str(changes.get("email", user.email)).lower()
        duplicate = db.scalar(select(User).where(User.id != user_id, or_(User.username == username, User.email == email)))
        if duplicate:
            raise HTTPException(status_code=409, detail="Username or email is already in use")
    if changes.get("department_id") is not None and db.get(Department, changes["department_id"]) is None:
        raise HTTPException(status_code=404, detail="Department not found")
    if "password" in changes:
        changes["password_hash"] = hash_password(changes.pop("password"))
    if "email" in changes:
        changes["email"] = str(changes["email"]).lower()
    for key, value in changes.items():
        setattr(user, key, value)
    db.commit(); db.refresh(user)
    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), current: User = Depends(_admin)):
    if current.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own admin account")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user); db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
