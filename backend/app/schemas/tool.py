from datetime import datetime
from pydantic import BaseModel, Field


class ToolCreate(BaseModel):
    name: str = Field(..., max_length=128)
    key: str = Field(..., max_length=128, pattern=r"^[a-zA-Z0-9_-]+$")  # Alphanumeric & underscores only
    description: str
    type: str = Field("api", max_length=32)
    url: str | None = Field(None, max_length=512)
    method: str | None = Field("GET", max_length=16)
    headers: str = "{}"
    schema_json: str = "{}"
    is_system: bool = False


class ToolUpdate(BaseModel):
    name: str | None = Field(None, max_length=128)
    key: str | None = Field(None, max_length=128, pattern=r"^[a-zA-Z0-9_-]+$")
    description: str | None = None
    type: str | None = Field(None, max_length=32)
    url: str | None = Field(None, max_length=512)
    method: str | None = Field(None, max_length=16)
    headers: str | None = None
    schema_json: str | None = None
    is_system: bool | None = None


class ToolOut(BaseModel):
    id: int
    name: str
    key: str
    description: str
    type: str
    url: str | None
    method: str | None
    headers: str
    schema_json: str
    is_system: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AgentToolOut(BaseModel):
    id: int
    tool_key: str
    enabled: bool
    config: str
    name: str | None = None
    description: str | None = None
    type: str | None = None
    schema_json: str | None = None

    class Config:
        from_attributes = True


class AgentToolUpdate(BaseModel):
    tool_key: str
    enabled: bool
    config: str = "{}"
