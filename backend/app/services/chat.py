from sqlalchemy.orm import Session
from sqlalchemy import select
from ..models import Agent, LLMModel, LLMProvider, ChatSession, Message, Citation
from ..providers import get_client, ChatMessage
from ..utils.pii import mask_pii
from .audit import record_usage
from .retrieval import retrieve, format_context


def _to_history(session: ChatSession) -> list[ChatMessage]:
    return [ChatMessage(role=m.role, content=m.content) for m in session.messages]


def run_chat(
    db: Session, *, user_id: int, agent: Agent, session: ChatSession, user_text: str,
    apply_pii_mask: bool = True,
) -> tuple[Message, list]:
    model = db.get(LLMModel, agent.model_id)
    if not model or not model.is_active:
        raise ValueError("Model unavailable")
    provider = db.get(LLMProvider, model.provider_id)
    if not provider or not provider.is_active:
        raise ValueError("Provider unavailable")

    masked_text, pii_hits = (mask_pii(user_text) if apply_pii_mask else (user_text, []))

    user_msg = Message(session_id=session.id, role="user", content=user_text)
    db.add(user_msg); db.flush()

    # RAG retrieval against bound knowledge
    hits = retrieve(db, agent_id=agent.id, query=masked_text, top_k=4)
    context_block = format_context(hits)

    history = _to_history(session)
    msgs: list[ChatMessage] = []
    system_parts = [agent.system_prompt] if agent.system_prompt else []
    if context_block:
        system_parts.append(context_block)
    if system_parts:
        msgs.append(ChatMessage(role="system", content="\n\n".join(system_parts)))
    msgs.extend(history)
    msgs.append(ChatMessage(role="user", content=masked_text))

    client = get_client(provider)
    completion = client.chat(
        model=model.model_id,
        messages=msgs,
        temperature=agent.temperature,
        max_tokens=agent.max_tokens,
    )

    assistant = Message(
        session_id=session.id,
        role="assistant",
        content=completion.content,
        tokens_in=completion.tokens_in,
        tokens_out=completion.tokens_out,
    )
    db.add(assistant)
    record_usage(
        db,
        user_id=user_id,
        agent_id=agent.id,
        model_id=model.id,
        tokens_in=completion.tokens_in,
        tokens_out=completion.tokens_out,
        input_cost_per_1k=model.input_cost_per_1k,
        output_cost_per_1k=model.output_cost_per_1k,
    )
    db.flush()

    citations: list[Citation] = []
    for chunk, score in hits:
        c = Citation(
            message_id=assistant.id,
            document_id=chunk.document_id,
            chunk_id=chunk.id,
            snippet=chunk.text[:280],
            score=score,
        )
        db.add(c)
        citations.append(c)
    db.flush()
    return assistant, citations
