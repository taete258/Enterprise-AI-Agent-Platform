from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..db.session import get_db
from ..core.security import encrypt_secret
from ..models import LLMProvider, LLMModel
from ..schemas.llm import ProviderCreate, ProviderUpdate, ProviderTestConfig, ProviderOut, ModelCreate, ModelOut
from ..providers import get_client
from ..providers.openai_client import OpenAIClient
from ..providers.anthropic_client import AnthropicClient
from .deps import require_superuser


def _client_from_config(kind: str, api_key: str, base_url: str):
    k = (kind or "").lower()
    if k in ("openai", "openrouter", "local"):
        return OpenAIClient(api_key=api_key, base_url=base_url)
    if k == "anthropic":
        return AnthropicClient(api_key=api_key, base_url=base_url)
    raise ValueError(f"Unsupported provider kind: {kind}")

router = APIRouter(prefix="/api/llm", tags=["llm"])


@router.get("/providers", response_model=list[ProviderOut])
def list_providers(db: Session = Depends(get_db), _=Depends(require_superuser)):
    return db.scalars(select(LLMProvider)).all()


@router.post("/providers", response_model=ProviderOut)
def create_provider(payload: ProviderCreate, db: Session = Depends(get_db), _=Depends(require_superuser)):
    p = LLMProvider(
        name=payload.name,
        kind=payload.kind,
        base_url=payload.base_url,
        api_key_encrypted=encrypt_secret(payload.api_key) if payload.api_key else "",
    )
    db.add(p); db.commit(); db.refresh(p)
    return p


@router.patch("/providers/{provider_id}", response_model=ProviderOut)
def update_provider(
    provider_id: int, payload: ProviderUpdate,
    db: Session = Depends(get_db), _=Depends(require_superuser),
):
    p = db.get(LLMProvider, provider_id)
    if not p:
        raise HTTPException(404)
    data = payload.model_dump(exclude_unset=True)
    if "api_key" in data:
        new_key = data.pop("api_key")
        if new_key:  # only re-encrypt when a non-empty key is provided
            p.api_key_encrypted = encrypt_secret(new_key)
    for k, v in data.items():
        setattr(p, k, v)
    db.commit(); db.refresh(p)
    return p


@router.delete("/providers/{provider_id}")
def delete_provider(provider_id: int, db: Session = Depends(get_db), _=Depends(require_superuser)):
    p = db.get(LLMProvider, provider_id)
    if not p:
        raise HTTPException(404)
    db.delete(p); db.commit()
    return {"ok": True}


@router.post("/providers/test-config")
def test_config(payload: ProviderTestConfig, _=Depends(require_superuser)):
    """Test credentials without saving — used to validate before adding."""
    try:
        client = _client_from_config(payload.kind, payload.api_key, payload.base_url)
        return {"ok": True, **client.test()}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.post("/providers/{provider_id}/test")
def test_provider(provider_id: int, db: Session = Depends(get_db), _=Depends(require_superuser)):
    p = db.get(LLMProvider, provider_id)
    if not p:
        raise HTTPException(404)
    try:
        client = get_client(p)
        info = client.test()
        return {"ok": True, **info}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.get("/providers/{provider_id}/available-models")
def available_models(provider_id: int, db: Session = Depends(get_db), _=Depends(require_superuser)):
    p = db.get(LLMProvider, provider_id)
    if not p:
        raise HTTPException(404)
    try:
        client = get_client(p)
        return {"ok": True, "models": client.list_models()}
    except Exception as e:
        raise HTTPException(502, f"Provider error: {e}")


@router.get("/models", response_model=list[ModelOut])
def list_models(db: Session = Depends(get_db)):
    return db.scalars(select(LLMModel).where(LLMModel.is_active == True)).all()


@router.post("/models", response_model=ModelOut)
def create_model(payload: ModelCreate, db: Session = Depends(get_db), _=Depends(require_superuser)):
    m = LLMModel(**payload.model_dump())
    db.add(m); db.commit(); db.refresh(m)
    return m


@router.delete("/models/{model_id}")
def delete_model(model_id: int, db: Session = Depends(get_db), _=Depends(require_superuser)):
    m = db.get(LLMModel, model_id)
    if not m:
        raise HTTPException(404, "Model not found")
    m.is_active = False
    db.commit()
    return {"ok": True}

