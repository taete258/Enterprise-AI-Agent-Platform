from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from pydantic import BaseModel
from ..db.session import get_db
from ..models import UsageRecord, AuditLog, User, Agent
from ..schemas.auth import UserOut
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
