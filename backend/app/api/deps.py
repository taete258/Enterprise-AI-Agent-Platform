from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..db.session import get_db
from ..core.security import decode_token
from ..models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = db.scalar(select(User).where(User.id == user_id))
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    return user


def require_superuser(user: User = Depends(get_current_user)) -> User:
    if not user.is_superuser:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Superuser required")
    return user


def require_permission(permission: str):
    """Dependency factory: require a specific role-based permission or superuser."""
    def _check(user: User = Depends(get_current_user)) -> User:
        if user.is_superuser:
            return user
        from ..services.acl import user_has_role_permission
        if not user_has_role_permission(user, permission):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Permission required: {permission}",
            )
        return user
    return _check
