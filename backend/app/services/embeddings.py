"""Embedding service. Uses the first active OpenAI-compatible provider's embeddings endpoint."""
from sqlalchemy.orm import Session
from sqlalchemy import select
from openai import OpenAI
from ..core.security import decrypt_secret
from ..models import LLMProvider

EMBEDDING_DIM = 1536
EMBEDDING_MODEL = "text-embedding-3-small"


def _client(db: Session) -> tuple[OpenAI, str]:
    provider = db.scalar(
        select(LLMProvider)
        .where(LLMProvider.is_active == True, LLMProvider.kind.in_(("openai", "openrouter", "local")))
        .order_by(LLMProvider.id)
    )
    if not provider:
        raise RuntimeError("No OpenAI-compatible provider configured for embeddings")
    api_key = decrypt_secret(provider.api_key_encrypted) if provider.api_key_encrypted else ""
    kwargs = {"api_key": api_key}
    if provider.base_url:
        kwargs["base_url"] = provider.base_url
    return OpenAI(**kwargs), EMBEDDING_MODEL


def embed_texts(db: Session, texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    client, model = _client(db)
    # OpenAI API allows batched inputs
    resp = client.embeddings.create(model=model, input=texts)
    return [d.embedding for d in resp.data]


def embed_one(db: Session, text: str) -> list[float]:
    return embed_texts(db, [text])[0]
