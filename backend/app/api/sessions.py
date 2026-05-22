from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from ..db.session import get_db
from ..models import ChatSession, Message, User, SessionGroup
from .deps import get_current_user
from ..services.audit import log_action

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


class SessionGroupOut(BaseModel):
    id: int
    name: str
    created_at: datetime
    session_count: int = 0

    class Config:
        from_attributes = True


class SessionOut(BaseModel):
    id: int
    agent_id: int
    title: str
    is_pinned: bool = False
    is_archived: bool = False
    group_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SessionUpdateInput(BaseModel):
    title: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_archived: Optional[bool] = None
    group_id: Optional[int] = None


class GroupCreateInput(BaseModel):
    name: str


class GroupUpdateInput(BaseModel):
    name: Optional[str] = None
    delete: Optional[bool] = None


@router.get("", response_model=list[SessionOut])
def list_sessions(
    include_archived: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    query = select(ChatSession).where(ChatSession.user_id == user.id)
    if not include_archived:
        query = query.where(ChatSession.is_archived == False)
    return db.scalars(query.order_by(ChatSession.is_pinned.desc(), ChatSession.updated_at.desc())).all()


@router.get("/{session_id}/messages", response_model=list[MessageOut])
def list_messages(
    session_id: int,
    limit: int = 50,
    before_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = db.get(ChatSession, session_id)
    if not s or s.user_id != user.id:
        raise HTTPException(404)
    from app.models.chat import Message
    from sqlalchemy import select
    q = select(Message).where(Message.session_id == session_id)
    if before_id is not None:
        q = q.where(Message.id < before_id)
    q = q.order_by(Message.id.desc()).limit(limit)
    rows = db.scalars(q).all()
    return list(reversed(rows))


@router.patch("/{session_id}", response_model=SessionOut)
def update_session(
    session_id: int,
    payload: SessionUpdateInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    s = db.get(ChatSession, session_id)
    if not s or s.user_id != user.id:
        raise HTTPException(404)

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(s, k, v)

    s.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(s)
    log_action(db, user_id=user.id, action="session.update", resource_id=session_id)
    return s


@router.get("/groups", response_model=list[SessionGroupOut])
def list_groups(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    groups = db.scalars(select(SessionGroup).where(SessionGroup.user_id == user.id)).all()
    result = []
    for group in groups:
        session_count = db.query(ChatSession).filter(
            and_(
                ChatSession.group_id == group.id,
                ChatSession.is_archived == False
            )
        ).count()
        result.append({
            "id": group.id,
            "name": group.name,
            "created_at": group.created_at,
            "session_count": session_count
        })
    return result


@router.post("/groups", response_model=SessionGroupOut)
def create_group(
    payload: GroupCreateInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    group = SessionGroup(user_id=user.id, name=payload.name)
    db.add(group)
    db.commit()
    db.refresh(group)
    log_action(db, user_id=user.id, action="group.create", resource_id=group.id)
    return {
        "id": group.id,
        "name": group.name,
        "created_at": group.created_at,
        "session_count": 0
    }


@router.patch("/groups/{group_id}", response_model=SessionGroupOut)
def update_group(
    group_id: int,
    payload: GroupUpdateInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    group = db.get(SessionGroup, group_id)
    if not group or group.user_id != user.id:
        raise HTTPException(404)

    if payload.delete:
        db.query(ChatSession).filter(ChatSession.group_id == group_id).update({"group_id": None})
        db.delete(group)
        db.commit()
        log_action(db, user_id=user.id, action="group.delete", resource_id=group_id)
        return {
            "id": group_id,
            "name": group.name,
            "created_at": group.created_at,
            "session_count": 0
        }
    elif payload.name:
        group.name = payload.name
        db.commit()
        log_action(db, user_id=user.id, action="group.update", resource_id=group_id)

    db.refresh(group)
    session_count = db.query(ChatSession).filter(
        and_(
            ChatSession.group_id == group.id,
            ChatSession.is_archived == False
        )
    ).count()
    return {
        "id": group.id,
        "name": group.name,
        "created_at": group.created_at,
        "session_count": session_count
    }


@router.delete("/groups/{group_id}")
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    group = db.get(SessionGroup, group_id)
    if not group or group.user_id != user.id:
        raise HTTPException(404)

    db.query(ChatSession).filter(ChatSession.group_id == group_id).update({"group_id": None})
    db.delete(group)
    db.commit()
    log_action(db, user_id=user.id, action="group.delete", resource_id=group_id)
    return {"ok": True}
