from openai import OpenAI
from .base import ChatMessage, ChatCompletion


class OpenAIClient:
    def __init__(self, api_key: str, base_url: str = ""):
        kwargs = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        self._c = OpenAI(**kwargs)

    def list_models(self) -> list[dict]:
        resp = self._c.models.list()
        return [{"id": m.id, "display": m.id} for m in resp.data]

    def test(self) -> dict:
        resp = self._c.models.list()
        return {"ok": True, "model_count": len(resp.data)}

    def chat(self, model, messages, temperature=0.7, max_tokens=2048, tools=None):
        import json
        openai_msgs = []
        for m in messages:
            if m.role == "user" and m.images:
                parts: list[dict] = []
                if m.content:
                    parts.append({"type": "text", "text": m.content})
                for img in m.images:
                    mime = img.get("mime") or "image/png"
                    b64 = img.get("b64") or ""
                    if not b64:
                        continue
                    parts.append({
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{b64}"},
                    })
                msg_dict = {"role": m.role, "content": parts or m.content}
            else:
                msg_dict = {"role": m.role, "content": m.content}
            if m.tool_calls:
                msg_dict["tool_calls"] = m.tool_calls
            if m.role == "tool" and m.tool_call_id:
                msg_dict["tool_call_id"] = m.tool_call_id
            openai_msgs.append(msg_dict)

        openai_tools = []
        if tools:
            for t in tools:
                try:
                    schema = json.loads(t.schema_json)
                except Exception:
                    schema = {"type": "object", "properties": {}}
                clean_key = t.key.replace(".", "_")
                openai_tools.append({
                    "type": "function",
                    "function": {
                        "name": clean_key,
                        "description": t.description,
                        "parameters": schema
                    }
                })

        kwargs = {
            "model": model,
            "messages": openai_msgs,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if openai_tools:
            kwargs["tools"] = openai_tools

        resp = self._c.chat.completions.create(**kwargs)
        u = resp.usage
        
        # Parse tool calls
        raw_tool_calls = None
        choice_msg = resp.choices[0].message
        if getattr(choice_msg, "tool_calls", None):
            raw_tool_calls = []
            for tc in choice_msg.tool_calls:
                raw_tool_calls.append({
                    "id": tc.id,
                    "type": tc.type,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments
                    }
                })

        return ChatCompletion(
            content=choice_msg.content or "",
            tokens_in=getattr(u, "prompt_tokens", 0) or 0,
            tokens_out=getattr(u, "completion_tokens", 0) or 0,
            tool_calls=raw_tool_calls,
            raw=resp.model_dump() if hasattr(resp, "model_dump") else {},
        )
