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


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    is_active: bool
    is_superuser: bool

    class Config:
        from_attributes = True
