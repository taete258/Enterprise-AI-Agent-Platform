from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..db.session import get_db
from ..core.security import hash_password, verify_password, create_access_token
from ..models import User
from ..schemas.auth import LoginRequest, TokenResponse, UserCreate, UserUpdate, UserOut
from .deps import get_current_user, require_superuser
from ..services.audit import log_action

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Inactive user")
    token = create_access_token(str(user.id), {"email": user.email, "su": user.is_superuser})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut.from_user(user)


@router.get("/me/permissions")
def me_permissions(user: User = Depends(get_current_user)):
    from ..services.acl import get_user_permissions
    return {"permissions": get_user_permissions(user)}


@router.post("/users", response_model=UserOut, dependencies=[Depends(require_superuser)])
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(409, "Email already exists")
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserOut, dependencies=[Depends(require_superuser)])
def update_user(user_id: int, payload: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    if payload.email and payload.email != user.email:
        if db.scalar(select(User).where(User.email == payload.email)):
            raise HTTPException(409, "Email already exists")

    for k, v in payload.model_dump(exclude_unset=True).items():
        if k == "password" and v:
            setattr(user, "password_hash", hash_password(v))
        else:
            setattr(user, k, v)

    db.commit()
    db.refresh(user)
    log_action(db, user_id=current_user.id, action="user.update", resource_type="user", resource_id=str(user.id))
    return user


@router.delete("/users/{user_id}", dependencies=[Depends(require_superuser)])
def delete_user(user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    if user.id == current_user.id:
        raise HTTPException(400, "Cannot delete your own user account")

    log_action(db, user_id=current_user.id, action="user.delete", resource_type="user", resource_id=str(user_id))
    db.delete(user)
    db.commit()
    return {"ok": True}
