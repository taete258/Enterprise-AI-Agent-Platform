from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime
from ..db.session import get_db
from ..models import ChatSession, Message, User
from .deps import get_current_user

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class CitationOut(BaseModel):
    document_id: int
    snippet: str
    score: float

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    attachments: str = "[]"
    tool_calls: str | None = None
    tool_call_id: str | None = None
    tokens_in: int = 0
    tokens_out: int = 0
    citations: list[CitationOut] = []
    created_at: datetime

    class Config:
        from_attributes = True


class SessionOut(BaseModel):
    id: int
    agent_id: int
    title: str
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=list[SessionOut])
def list_sessions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(select(ChatSession).where(ChatSession.user_id == user.id).order_by(ChatSession.id.desc())).all()


@router.get("/{session_id}/messages", response_model=list[MessageOut])
def list_messages(session_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.get(ChatSession, session_id)
    if not s or s.user_id != user.id:
        raise HTTPException(404)
    return s.messages
