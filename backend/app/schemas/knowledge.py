from datetime import datetime
from pydantic import BaseModel, computed_field

from ..services.filetype import classify


class DocumentOut(BaseModel):
    id: int
    name: str
    description: str
    content_hash: str
    uploader_id: int
    is_active: bool
    created_at: datetime

    @computed_field
    @property
    def doc_type(self) -> str:
        return classify(self.name)

    class Config:
        from_attributes = True


class DocumentVersionOut(BaseModel):
    id: int
    document_id: int
    version: int
    mime_type: str
    size_bytes: int
    deprecated: bool
    created_at: datetime

    class Config:
        from_attributes = True


class BindKnowledge(BaseModel):
    agent_id: int
    document_id: int
