from anthropic import Anthropic
from .base import ChatMessage, ChatCompletion


class AnthropicClient:
    def __init__(self, api_key: str, base_url: str = ""):
        kwargs = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        self._c = Anthropic(**kwargs)

    # Anthropic SDK 0.34 does not expose models.list(); fall back to a curated catalogue.
    _CATALOG = [
        "claude-opus-4-20250514",
        "claude-sonnet-4-20250514",
        "claude-3-7-sonnet-20250219",
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "claude-3-opus-20240229",
    ]

    def list_models(self) -> list[dict]:
        return [{"id": m, "display": m} for m in self._CATALOG]

    def test(self) -> dict:
        # Cheapest probe: send 1 token to Haiku
        resp = self._c.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=1,
            messages=[{"role": "user", "content": "ping"}],
        )
        return {"ok": True, "probe_model": resp.model, "stop_reason": resp.stop_reason}

    def chat(self, model, messages, temperature=0.7, max_tokens=2048, tools=None):
        import json
        system = "\n\n".join(m.content for m in messages if m.role == "system")
        
        convo = []
        for m in messages:
            if m.role == "system":
                continue
            if m.role == "user":
                if m.images:
                    blocks: list = []
                    for img in m.images:
                        mime = img.get("mime") or "image/png"
                        b64 = img.get("b64") or ""
                        if not b64:
                            continue
                        blocks.append({
                            "type": "image",
                            "source": {"type": "base64", "media_type": mime, "data": b64},
                        })
                    if m.content:
                        blocks.append({"type": "text", "text": m.content})
                    convo.append({"role": "user", "content": blocks or m.content})
                else:
                    convo.append({"role": "user", "content": m.content})
            elif m.role == "assistant":
                content_blocks = []
                if m.content:
                    content_blocks.append({"type": "text", "text": m.content})
                if m.tool_calls:
                    for tc in m.tool_calls:
                        try:
                            args_dict = json.loads(tc["function"]["arguments"])
                        except Exception:
                            args_dict = {}
                        content_blocks.append({
                            "type": "tool_use",
                            "id": tc["id"],
                            "name": tc["function"]["name"],
                            "input": args_dict
                        })
                if content_blocks:
                    convo.append({"role": "assistant", "content": content_blocks})
                else:
                    convo.append({"role": "assistant", "content": " "})
            elif m.role == "tool":
                tool_result_block = {
                    "type": "tool_result",
                    "tool_use_id": m.tool_call_id,
                    "content": m.content
                }
                # Group consecutive tool results in the same user message
                if convo and convo[-1]["role"] == "user" and isinstance(convo[-1]["content"], list):
                    convo[-1]["content"].append(tool_result_block)
                else:
                    convo.append({"role": "user", "content": [tool_result_block]})

        anthropic_tools = []
        if tools:
            for t in tools:
                try:
                    schema = json.loads(t.schema_json)
                except Exception:
                    schema = {"type": "object", "properties": {}}
                clean_key = t.key.replace(".", "_")
                anthropic_tools.append({
                    "name": clean_key,
                    "description": t.description,
                    "input_schema": schema
                })

        kwargs = {
            "model": model,
            "system": system or None,
            "messages": convo,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if anthropic_tools:
            kwargs["tools"] = anthropic_tools

        resp = self._c.messages.create(**kwargs)
        
        text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
        u = resp.usage
        
        # Parse tool calls
        raw_tool_calls = None
        tool_use_blocks = [b for b in resp.content if getattr(b, "type", "") == "tool_use"]
        if tool_use_blocks:
            raw_tool_calls = []
            for b in tool_use_blocks:
                raw_tool_calls.append({
                    "id": b.id,
                    "type": "function",
                    "function": {
                        "name": b.name,
                        "arguments": json.dumps(b.input)
                    }
                })

        return ChatCompletion(
            content=text,
            tokens_in=getattr(u, "input_tokens", 0) or 0,
            tokens_out=getattr(u, "output_tokens", 0) or 0,
            tool_calls=raw_tool_calls,
            raw=resp.model_dump() if hasattr(resp, "model_dump") else {},
        )
