from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from pydantic import BaseModel
from ..db.session import get_db
from ..models import UsageRecord, AuditLog, User, Agent, Tool
from ..schemas.auth import UserOut
from ..schemas.tool import ToolCreate, ToolUpdate, ToolOut
from .deps import require_superuser

router = APIRouter(prefix="/api/admin", tags=["admin"])


class CostTotals(BaseModel):
    tokens_in: int
    tokens_out: int
    cost_usd: float


class CostBreakdownRow(BaseModel):
    key: str
    label: str
    tokens_in: int
    tokens_out: int
    cost_usd: float


class CostReport(BaseModel):
    since: datetime
    total: CostTotals
    by_user: list[CostBreakdownRow]
    by_agent: list[CostBreakdownRow]


@router.get("/costs", response_model=CostReport, dependencies=[Depends(require_superuser)])
def costs(db: Session = Depends(get_db), days: int = Query(30, ge=1, le=365)):
    since = datetime.utcnow() - timedelta(days=days)
    base = select(
        func.coalesce(func.sum(UsageRecord.tokens_in), 0),
        func.coalesce(func.sum(UsageRecord.tokens_out), 0),
        func.coalesce(func.sum(UsageRecord.cost_usd), 0.0),
    ).where(UsageRecord.created_at >= since)
    t_in, t_out, t_cost = db.execute(base).one()

    by_user_rows = db.execute(
        select(
            UsageRecord.user_id, User.email,
            func.sum(UsageRecord.tokens_in), func.sum(UsageRecord.tokens_out), func.sum(UsageRecord.cost_usd),
        )
        .join(User, User.id == UsageRecord.user_id)
        .where(UsageRecord.created_at >= since)
        .group_by(UsageRecord.user_id, User.email)
        .order_by(func.sum(UsageRecord.cost_usd).desc())
    ).all()

    by_agent_rows = db.execute(
        select(
            UsageRecord.agent_id, Agent.name,
            func.sum(UsageRecord.tokens_in), func.sum(UsageRecord.tokens_out), func.sum(UsageRecord.cost_usd),
        )
        .join(Agent, Agent.id == UsageRecord.agent_id)
        .where(UsageRecord.created_at >= since)
        .group_by(UsageRecord.agent_id, Agent.name)
        .order_by(func.sum(UsageRecord.cost_usd).desc())
    ).all()

    return CostReport(
        since=since,
        total=CostTotals(tokens_in=int(t_in), tokens_out=int(t_out), cost_usd=float(t_cost)),
        by_user=[CostBreakdownRow(key=str(r[0]), label=r[1], tokens_in=int(r[2]), tokens_out=int(r[3]), cost_usd=float(r[4])) for r in by_user_rows],
        by_agent=[CostBreakdownRow(key=str(r[0]), label=r[1], tokens_in=int(r[2]), tokens_out=int(r[3]), cost_usd=float(r[4])) for r in by_agent_rows],
    )


class AuditEntry(BaseModel):
    id: int
    user_id: int | None
    action: str
    resource_type: str
    resource_id: str
    ip: str
    detail: str
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/audit", response_model=list[AuditEntry], dependencies=[Depends(require_superuser)])
def audit(db: Session = Depends(get_db), limit: int = Query(100, ge=1, le=1000)):
    return db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(limit)).all()


@router.get("/users", response_model=list[UserOut], dependencies=[Depends(require_superuser)])
def list_users(db: Session = Depends(get_db)):
    return db.scalars(select(User).order_by(User.id)).all()


class ToolTestRequest(BaseModel):
    url: str
    method: str = "GET"
    headers: str = "{}"
    parameters: str = "{}"


@router.get("/tools", response_model=list[ToolOut], dependencies=[Depends(require_superuser)])
def list_tools(db: Session = Depends(get_db)):
    return db.scalars(select(Tool).order_by(Tool.id)).all()


@router.post("/tools", response_model=ToolOut, dependencies=[Depends(require_superuser)])
def create_tool(payload: ToolCreate, db: Session = Depends(get_db)):
    if db.scalar(select(Tool).where(Tool.key == payload.key)):
        raise HTTPException(400, "Tool key already exists")
    tool = Tool(**payload.model_dump())
    db.add(tool)
    db.commit()
    db.refresh(tool)
    return tool


@router.patch("/tools/{tool_id}", response_model=ToolOut, dependencies=[Depends(require_superuser)])
def update_tool(tool_id: int, payload: ToolUpdate, db: Session = Depends(get_db)):
    tool = db.get(Tool, tool_id)
    if not tool:
        raise HTTPException(404, "Tool not found")
    if tool.is_system and payload.key is not None and payload.key != tool.key:
        raise HTTPException(400, "Cannot change key of system tools")
    
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(tool, k, v)
        
    db.commit()
    db.refresh(tool)
    return tool


@router.delete("/tools/{tool_id}", dependencies=[Depends(require_superuser)])
def delete_tool(tool_id: int, db: Session = Depends(get_db)):
    tool = db.get(Tool, tool_id)
    if not tool:
        raise HTTPException(404, "Tool not found")
    if tool.is_system:
        raise HTTPException(400, "Cannot delete system tools")
    db.delete(tool)
    db.commit()
    return {"ok": True}


@router.post("/tools/test", dependencies=[Depends(require_superuser)])
def test_tool(payload: ToolTestRequest):
    import json
    import httpx
    
    try:
        headers = json.loads(payload.headers or "{}")
        params = json.loads(payload.parameters or "{}")
    except Exception as e:
        raise HTTPException(400, f"Invalid JSON in headers or parameters: {e}")
        
    method = payload.method.upper()
    url = payload.url
    
    if url.startswith("/api/"):
        url = f"http://localhost:8000{url}"
        
    try:
        with httpx.Client(timeout=10.0) as client:
            if method in ("POST", "PUT", "PATCH"):
                resp = client.request(method, url, headers=headers, json=params)
            else:
                resp = client.request(method, url, headers=headers, params=params)
            
            return {
                "ok": resp.status_code < 400,
                "status": resp.status_code,
                "body": resp.text,
            }
    except Exception as e:
        return {"ok": False, "error": str(e)}

