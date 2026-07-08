from sqlalchemy.orm import Session
from sqlalchemy import select
from ..models import ResourceACL, UserGroup, UserRole, User

_ORDER = {"view": 1, "use": 2, "edit": 3, "admin": 4}


def user_has_permission(
    db: Session, user: User, resource_type: str, resource_id: int, required: str
) -> bool:
    if user.is_superuser:
        return True
    role_ids = [ur.role_id for ur in user.roles]
    group_ids = [ug.group_id for ug in user.groups]
    acls = db.scalars(
        select(ResourceACL).where(
            ResourceACL.resource_type == resource_type,
            ResourceACL.resource_id == resource_id,
        )
    ).all()
    need = _ORDER[required]
    for a in acls:
        if (a.subject_type == "user" and a.subject_id == user.id) \
           or (a.subject_type == "role" and a.subject_id in role_ids) \
           or (a.subject_type == "group" and a.subject_id in group_ids):
            if _ORDER.get(a.permission, 0) >= need:
                return True
    return False


def get_user_permissions(user: User) -> list[str]:
    """Return effective permission keys for a user based on assigned roles."""
    if user.is_superuser:
        from ..core.permissions import ALL_PERMISSIONS
        return ALL_PERMISSIONS
    perms: set[str] = set()
    for ur in user.roles:
        for perm in ur.role.permissions:
            perms.add(perm)
    return sorted(perms)


def user_has_role_permission(user: User, permission: str) -> bool:
    """Check if user has a role-based permission key (e.g. 'agent:create')."""
    if user.is_superuser:
        return True
    for ur in user.roles:
        if permission in ur.role.permissions:
            return True
    return False
