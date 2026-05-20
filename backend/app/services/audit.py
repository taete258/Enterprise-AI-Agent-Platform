import json
from sqlalchemy.orm import Session
from ..models import AuditLog, UsageRecord


def log_action(
    db: Session,
    *,
    user_id: int | None,
    action: str,
    resource_type: str = "",
    resource_id: str = "",
    ip: str = "",
    detail: dict | None = None,
) -> None:
    db.add(AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id),
        ip=ip,
        detail=json.dumps(detail or {}, ensure_ascii=False),
    ))


def record_usage(
    db: Session,
    *,
    user_id: int,
    agent_id: int,
    model_id: int,
    tokens_in: int,
    tokens_out: int,
    input_cost_per_1k: float,
    output_cost_per_1k: float,
) -> None:
    cost = (tokens_in / 1000.0) * input_cost_per_1k + (tokens_out / 1000.0) * output_cost_per_1k
    db.add(UsageRecord(
        user_id=user_id,
        agent_id=agent_id,
        model_id=model_id,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        cost_usd=cost,
    ))
