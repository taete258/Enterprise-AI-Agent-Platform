from datetime import datetime
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = ""
    password: str


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    password: str | None = None
    is_active: bool | None = None


class RoleBasic(BaseModel):
    id: int
    name: str
    description: str

    class Config:
        from_attributes = True


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    is_active: bool
    is_superuser: bool
    created_at: datetime | None = None
    roles: list[RoleBasic] = []

    class Config:
        from_attributes = True

    @classmethod
    def from_user(cls, user) -> "UserOut":
        role_list = [RoleBasic(id=ur.role.id, name=ur.role.name, description=ur.role.description) for ur in (user.roles or [])]
        return cls(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            is_superuser=user.is_superuser,
            created_at=user.created_at,
            roles=role_list,
        )
