from sqlalchemy.orm import Session
from sqlalchemy import select
import json
from ..models import Agent, LLMModel, LLMProvider, ChatSession, Message, Citation, AgentTool, Tool
from ..providers import get_client, ChatMessage
from ..utils.pii import mask_pii
from .audit import record_usage
from .retrieval import retrieve, format_context
from .tools import execute_tool


def _to_history(session: ChatSession) -> list[ChatMessage]:
    history = []
    for m in session.messages:
        tool_calls_parsed = None
        if m.tool_calls:
            try:
                tool_calls_parsed = json.loads(m.tool_calls)
            except Exception:
                pass
        history.append(ChatMessage(
            role=m.role,
            content=m.content,
            tool_calls=tool_calls_parsed,
            tool_call_id=m.tool_call_id
        ))
    return history


def run_chat(
    db: Session, *, user_id: int, agent: Agent, session: ChatSession, user_text: str,
    apply_pii_mask: bool = True,
    attachments: list[dict] | None = None,
    images: list[dict] | None = None,
    original_message: str | None = None,
) -> tuple[Message, list]:
    model = db.get(LLMModel, agent.model_id)
    if not model or not model.is_active:
        raise ValueError("Model unavailable")
    provider = db.get(LLMProvider, model.provider_id)
    if not provider or not provider.is_active:
        raise ValueError("Provider unavailable")

    masked_text, pii_hits = (mask_pii(user_text) if apply_pii_mask else (user_text, []))

    persisted_content = original_message if original_message is not None else user_text
    user_msg = Message(
        session_id=session.id,
        role="user",
        content=persisted_content,
        attachments=json.dumps(attachments or []),
    )
    db.add(user_msg)
    db.flush()

    # RAG retrieval against bound knowledge
    hits = retrieve(db, agent_id=agent.id, query=masked_text, top_k=4)
    context_block = format_context(db, hits, agent.id)

    # Fetch all tools enabled for this agent
    agent_tools = db.scalars(
        select(AgentTool).where(AgentTool.agent_id == agent.id, AgentTool.enabled == True)
    ).all()
    
    enabled_tools = []
    configs_by_key = {}
    if agent_tools:
        tool_keys = [at.tool_key for at in agent_tools]
        enabled_tools = db.scalars(select(Tool).where(Tool.key.in_(tool_keys))).all()
        configs_by_key = {at.tool_key: at.config for at in agent_tools}

    history = _to_history(session)
    if history and history[-1].role == "user":
        history[-1].content = masked_text
        if images:
            history[-1].images = images

    msgs: list[ChatMessage] = []
    system_parts = [agent.system_prompt] if agent.system_prompt else []
    if context_block:
        system_parts.append(context_block)
    if system_parts:
        msgs.append(ChatMessage(role="system", content="\n\n".join(system_parts)))
    msgs.extend(history)

    client = get_client(provider)
    
    loop_count = 0
    max_loops = 5
    total_tokens_in = 0
    total_tokens_out = 0

    while loop_count < max_loops:
        loop_count += 1
        completion = client.chat(
            model=model.model_id,
            messages=msgs,
            temperature=agent.temperature,
            max_tokens=agent.max_tokens,
            tools=enabled_tools
        )
        
        total_tokens_in += completion.tokens_in
        total_tokens_out += completion.tokens_out

        if completion.tool_calls:
            # Save intermediate assistant tool call
            tool_calls_str = json.dumps(completion.tool_calls)
            assistant_msg = Message(
                session_id=session.id,
                role="assistant",
                content=completion.content or "",
                tool_calls=tool_calls_str,
                tokens_in=completion.tokens_in,
                tokens_out=completion.tokens_out
            )
            db.add(assistant_msg)
            db.flush()

            msgs.append(ChatMessage(
                role="assistant",
                content=completion.content or "",
                tool_calls=completion.tool_calls
            ))

            # Execute tools
            for tc in completion.tool_calls:
                tc_id = tc["id"]
                func_name = tc["function"]["name"]
                
                # Match clean function key back to exact db tool key
                matched_key = None
                for et in enabled_tools:
                    if et.key.replace(".", "_") == func_name:
                        matched_key = et.key
                        break
                if not matched_key:
                    matched_key = func_name
                
                try:
                    args = json.loads(tc["function"]["arguments"])
                except Exception:
                    args = {}
                
                config_str = configs_by_key.get(matched_key, "{}")
                result_str = execute_tool(db, matched_key, args, config_str)

                # Save tool response message
                tool_msg = Message(
                    session_id=session.id,
                    role="tool",
                    content=result_str,
                    tool_call_id=tc_id
                )
                db.add(tool_msg)
                db.flush()

                msgs.append(ChatMessage(
                    role="tool",
                    content=result_str,
                    tool_call_id=tc_id
                ))
            continue
        else:
            # We reached final text completion
            assistant = Message(
                session_id=session.id,
                role="assistant",
                content=completion.content,
                tokens_in=total_tokens_in,
                tokens_out=total_tokens_out,
            )
            db.add(assistant)
            db.flush()

            record_usage(
                db,
                user_id=user_id,
                agent_id=agent.id,
                model_id=model.id,
                tokens_in=total_tokens_in,
                tokens_out=total_tokens_out,
                input_cost_per_1k=model.input_cost_per_1k,
                output_cost_per_1k=model.output_cost_per_1k,
            )

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

    # Recursion fallback
    assistant = Message(
        session_id=session.id,
        role="assistant",
        content="Tool execution recursion limit reached.",
        tokens_in=total_tokens_in,
        tokens_out=total_tokens_out,
    )
    db.add(assistant)
    db.flush()
    return assistant, []
