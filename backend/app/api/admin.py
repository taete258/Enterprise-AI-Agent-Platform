from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from pydantic import BaseModel
from ..db.session import get_db
from ..models import UsageRecord, AuditLog, User, Agent, Tool, Role, UserRole
from ..schemas.auth import UserOut
from ..schemas.role import RoleCreate, RoleUpdate, RoleOut
from ..schemas.tool import ToolCreate, ToolUpdate, ToolOut
from ..core.permissions import PERMISSIONS_BY_RESOURCE
from ..services.acl import get_user_permissions
from ..services.audit import log_action
from .deps import require_superuser, get_current_user

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


class DailyCostRow(BaseModel):
    day: str
    tokens_in: int
    tokens_out: int
    cost_usd: float


class CostReport(BaseModel):
    since: datetime
    total: CostTotals
    by_user: list[CostBreakdownRow]
    by_agent: list[CostBreakdownRow]
    daily: list[DailyCostRow]


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
            UsageRecord.user_id, User.email, User.full_name,
            func.sum(UsageRecord.tokens_in), func.sum(UsageRecord.tokens_out), func.sum(UsageRecord.cost_usd),
        )
        .join(User, User.id == UsageRecord.user_id)
        .where(UsageRecord.created_at >= since)
        .group_by(UsageRecord.user_id, User.email, User.full_name)
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

    daily_rows = db.execute(
        select(
            func.date(UsageRecord.created_at),
            func.sum(UsageRecord.tokens_in),
            func.sum(UsageRecord.tokens_out),
            func.sum(UsageRecord.cost_usd)
        )
        .where(UsageRecord.created_at >= since)
        .group_by(func.date(UsageRecord.created_at))
        .order_by(func.date(UsageRecord.created_at))
    ).all()

    daily_data = []
    for r in daily_rows:
        day_val = r[0]
        day_str = day_val.strftime("%Y-%m-%d") if hasattr(day_val, "strftime") else str(day_val)
        daily_data.append(
            DailyCostRow(
                day=day_str,
                tokens_in=int(r[1]),
                tokens_out=int(r[2]),
                cost_usd=float(r[3])
            )
        )

    return CostReport(
        since=since,
        total=CostTotals(tokens_in=int(t_in), tokens_out=int(t_out), cost_usd=float(t_cost)),
        by_user=[CostBreakdownRow(key=str(r[0]), label=f"{r[2]} ({r[1]})" if r[2] else r[1], tokens_in=int(r[3]), tokens_out=int(r[4]), cost_usd=float(r[5])) for r in by_user_rows],
        by_agent=[CostBreakdownRow(key=str(r[0]), label=r[1], tokens_in=int(r[2]), tokens_out=int(r[3]), cost_usd=float(r[4])) for r in by_agent_rows],
        daily=daily_data,
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


class AuditListResponse(BaseModel):
    items: list[AuditEntry]
    total: int
    skip: int
    limit: int


@router.get("/audit/filters", dependencies=[Depends(require_superuser)])
def audit_filters(db: Session = Depends(get_db)):
    actions = db.scalars(select(AuditLog.action).distinct().order_by(AuditLog.action)).all()
    resource_types = db.scalars(select(AuditLog.resource_type).distinct().order_by(AuditLog.resource_type)).all()
    return {
        "actions": [a for a in actions if a],
        "resource_types": [r for r in resource_types if r],
    }


@router.get("/audit", response_model=AuditListResponse, dependencies=[Depends(require_superuser)])
def audit(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: str = Query("", min_length=0),
    action: str = Query("", min_length=0),
    resource_type: str = Query("", min_length=0),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
):
    query = select(AuditLog)

    if search:
        search_term = f"%{search}%"
        query = query.where(
            (AuditLog.user_id == search if search.isdigit() else False)
            | AuditLog.action.ilike(search_term)
            | AuditLog.resource_type.ilike(search_term)
            | AuditLog.resource_id.ilike(search_term)
            | AuditLog.detail.ilike(search_term)
        )

    if action:
        query = query.where(AuditLog.action == action)

    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)

    if date_from:
        query = query.where(AuditLog.created_at >= date_from)

    if date_to:
        query = query.where(AuditLog.created_at <= date_to)

    count_query = select(func.count()).select_from(AuditLog)
    if query.whereclause is not None:
        count_query = count_query.where(query.whereclause)
    total = db.scalar(count_query)

    items = db.scalars(
        query.order_by(AuditLog.id.desc()).offset(skip).limit(limit)
    ).all()

    return AuditListResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/users", response_model=list[UserOut], dependencies=[Depends(require_superuser)])
def list_users(db: Session = Depends(get_db)):
    users = db.scalars(select(User).order_by(User.id)).all()
    return [UserOut.from_user(u) for u in users]


@router.get("/users/{user_id}/permissions", dependencies=[Depends(require_superuser)])
def get_user_perms(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return {"user_id": user_id, "permissions": get_user_permissions(user)}


@router.post("/users/{user_id}/roles", dependencies=[Depends(require_superuser)])
def assign_role(user_id: int, role_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(404, "Role not found")
    existing = db.scalar(select(UserRole).where(UserRole.user_id == user_id, UserRole.role_id == role_id))
    if existing:
        raise HTTPException(409, "User already has this role")
    db.add(UserRole(user_id=user_id, role_id=role_id))
    db.commit()
    log_action(db, user_id=current_user.id, action="role.assign", resource_type="user", resource_id=str(user_id), detail={"role_id": role_id})
    return {"ok": True}


@router.delete("/users/{user_id}/roles/{role_id}", dependencies=[Depends(require_superuser)])
def remove_role(user_id: int, role_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ur = db.scalar(select(UserRole).where(UserRole.user_id == user_id, UserRole.role_id == role_id))
    if not ur:
        raise HTTPException(404, "User does not have this role")
    db.delete(ur)
    db.commit()
    log_action(db, user_id=current_user.id, action="role.remove", resource_type="user", resource_id=str(user_id), detail={"role_id": role_id})
    return {"ok": True}


# --- Permission Registry ---

@router.get("/permissions", dependencies=[Depends(require_superuser)])
def list_permissions():
    return {"permissions": PERMISSIONS_BY_RESOURCE}


# --- Role Management ---

@router.get("/roles", response_model=list[RoleOut], dependencies=[Depends(require_superuser)])
def list_roles(db: Session = Depends(get_db)):
    return db.scalars(select(Role).order_by(Role.id)).all()


@router.post("/roles", response_model=RoleOut, dependencies=[Depends(require_superuser)])
def create_role(payload: RoleCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if db.scalar(select(Role).where(Role.name == payload.name)):
        raise HTTPException(409, "Role name already exists")
    role = Role(name=payload.name, description=payload.description)
    role.permissions = payload.permissions
    db.add(role)
    db.commit()
    db.refresh(role)
    log_action(db, user_id=current_user.id, action="role.create", resource_type="role", resource_id=str(role.id))
    return role


@router.get("/roles/{role_id}", response_model=RoleOut, dependencies=[Depends(require_superuser)])
def get_role(role_id: int, db: Session = Depends(get_db)):
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(404, "Role not found")
    return role


@router.patch("/roles/{role_id}", response_model=RoleOut, dependencies=[Depends(require_superuser)])
def update_role(role_id: int, payload: RoleUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(404, "Role not found")
    if payload.description is not None:
        role.description = payload.description
    if payload.permissions is not None:
        role.permissions = payload.permissions
    db.commit()
    db.refresh(role)
    log_action(db, user_id=current_user.id, action="role.update", resource_type="role", resource_id=str(role_id))
    return role


@router.delete("/roles/{role_id}", dependencies=[Depends(require_superuser)])
def delete_role(role_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(404, "Role not found")
    db.delete(role)
    db.commit()
    log_action(db, user_id=current_user.id, action="role.delete", resource_type="role", resource_id=str(role_id))
    return {"ok": True}


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

