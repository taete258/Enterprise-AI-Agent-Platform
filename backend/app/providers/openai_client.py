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

    def chat(self, model, messages, temperature=0.7, max_tokens=2048):
        resp = self._c.chat.completions.create(
            model=model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        u = resp.usage
        return ChatCompletion(
            content=resp.choices[0].message.content or "",
            tokens_in=getattr(u, "prompt_tokens", 0) or 0,
            tokens_out=getattr(u, "completion_tokens", 0) or 0,
            raw=resp.model_dump() if hasattr(resp, "model_dump") else {},
        )
