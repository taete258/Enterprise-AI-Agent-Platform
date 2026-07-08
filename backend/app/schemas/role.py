from pydantic import BaseModel, field_validator
from ..core.permissions import validate_permissions


class RoleCreate(BaseModel):
    name: str
    description: str = ""
    permissions: list[str] = []

    @field_validator("permissions")
    @classmethod
    def validate_perms(cls, v: list[str]) -> list[str]:
        return validate_permissions(v)


class RoleUpdate(BaseModel):
    description: str | None = None
    permissions: list[str] | None = None

    @field_validator("permissions")
    @classmethod
    def validate_perms(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        return validate_permissions(v)


class RoleOut(BaseModel):
    id: int
    name: str
    description: str
    permissions: list[str]

    class Config:
        from_attributes = True
