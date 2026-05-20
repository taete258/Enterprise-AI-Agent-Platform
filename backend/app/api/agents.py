from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import select, delete
from ..db.session import get_db
from ..models import Agent, ChatSession, User, AgentTool, Tool
from ..schemas.agent import AgentCreate, AgentUpdate, AgentOut, ChatRequest, ChatResponse, CitationOut
from ..schemas.tool import AgentToolOut, AgentToolUpdate
from ..services.chat import run_chat
from ..services.audit import log_action
from ..services.acl import user_has_permission
from .deps import get_current_user

router = APIRouter(prefix="/api/agents", tags=["agents"])


def _visible(db: Session, user: User, agent: Agent, required: str = "use") -> bool:
    if user.is_superuser or agent.owner_id == user.id:
        return True
    if agent.is_published and required == "use":
        return True
    return user_has_permission(db, user, "agent", agent.id, required)


@router.get("", response_model=list[AgentOut])
def list_agents(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(select(Agent)).all()
    return [a for a in rows if _visible(db, user, a, "use")]


@router.post("", response_model=AgentOut)
def create_agent(
    payload: AgentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    agent = Agent(**payload.model_dump(), owner_id=user.id)
    db.add(agent); db.flush()
    log_action(db, user_id=user.id, action="agent.create", resource_type="agent", resource_id=str(agent.id))
    db.commit(); db.refresh(agent)
    return agent


@router.get("/{agent_id}", response_model=AgentOut)
def get_agent(agent_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agent = db.get(Agent, agent_id)
    if not agent or not _visible(db, user, agent, "view"):
        raise HTTPException(404)
    return agent


@router.patch("/{agent_id}", response_model=AgentOut)
def update_agent(
    agent_id: int, payload: AgentUpdate,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404)
    if not (user.is_superuser or agent.owner_id == user.id or user_has_permission(db, user, "agent", agent.id, "edit")):
        raise HTTPException(403)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(agent, k, v)
    log_action(db, user_id=user.id, action="agent.update", resource_type="agent", resource_id=str(agent.id))
    db.commit(); db.refresh(agent)
    return agent


@router.delete("/{agent_id}")
def delete_agent(agent_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404)
    if not (user.is_superuser or agent.owner_id == user.id):
        raise HTTPException(403)
    db.delete(agent)
    log_action(db, user_id=user.id, action="agent.delete", resource_type="agent", resource_id=str(agent_id))
    db.commit()
    return {"ok": True}


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest, request: Request,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    agent = db.get(Agent, payload.agent_id)
    if not agent or not _visible(db, user, agent, "use"):
        raise HTTPException(404, "Agent not found or not accessible")

    if payload.session_id:
        session = db.get(ChatSession, payload.session_id)
        if not session or session.user_id != user.id:
            raise HTTPException(404, "Session not found")
    else:
        session = ChatSession(user_id=user.id, agent_id=agent.id, title=payload.message[:60] or "New chat")
        db.add(session); db.flush()

    try:
        assistant, citations = run_chat(db, user_id=user.id, agent=agent, session=session, user_text=payload.message)
    except Exception as e:
        db.rollback()
        raise HTTPException(502, f"LLM error: {e}")

    log_action(
        db, user_id=user.id, action="chat.send",
        resource_type="agent", resource_id=str(agent.id),
        ip=request.client.host if request.client else "",
        detail={"session_id": session.id, "tokens_in": assistant.tokens_in, "tokens_out": assistant.tokens_out},
    )
    db.commit()
    return ChatResponse(
        session_id=session.id,
        message_id=assistant.id,
        reply=assistant.content,
        citations=[CitationOut(document_id=c.document_id, snippet=c.snippet, score=c.score) for c in citations],
        tokens_in=assistant.tokens_in,
        tokens_out=assistant.tokens_out,
    )


@router.get("/{agent_id}/tools", response_model=list[AgentToolOut])
def get_agent_tools(
    agent_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    agent = db.get(Agent, agent_id)
    if not agent or not _visible(db, user, agent, "view"):
        raise HTTPException(404)
        
    tools = db.scalars(select(Tool).order_by(Tool.id)).all()
    agent_tools = db.scalars(select(AgentTool).where(AgentTool.agent_id == agent_id)).all()
    
    mapping = {at.tool_key: at for at in agent_tools}
    
    result = []
    for tool in tools:
        if tool.key in mapping:
            result.append(AgentToolOut(
                id=mapping[tool.key].id,
                tool_key=tool.key,
                enabled=mapping[tool.key].enabled,
                config=mapping[tool.key].config,
                name=tool.name,
                description=tool.description,
                type=tool.type,
                schema_json=tool.schema_json
            ))
        else:
            result.append(AgentToolOut(
                id=-1,
                tool_key=tool.key,
                enabled=False,
                config="{}",
                name=tool.name,
                description=tool.description,
                type=tool.type,
                schema_json=tool.schema_json
            ))
            
    return result


@router.put("/{agent_id}/tools")
def update_agent_tools(
    agent_id: int, payload: list[AgentToolUpdate],
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404)
    if not (user.is_superuser or agent.owner_id == user.id or user_has_permission(db, user, "agent", agent.id, "edit")):
        raise HTTPException(403)
        
    # Delete current mapping
    db.execute(delete(AgentTool).where(AgentTool.agent_id == agent_id))
    
    # Insert new mapping
    for item in payload:
        db.add(AgentTool(
            agent_id=agent_id,
            tool_key=item.tool_key,
            enabled=item.enabled,
            config=item.config
        ))
        
    log_action(db, user_id=user.id, action="agent.tools.update", resource_type="agent", resource_id=str(agent_id))
    db.commit()
    return {"ok": True}

