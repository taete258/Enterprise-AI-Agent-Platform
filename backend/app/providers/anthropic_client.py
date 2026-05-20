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

    def chat(self, model, messages, temperature=0.7, max_tokens=2048):
        system = "\n\n".join(m.content for m in messages if m.role == "system")
        convo = [
            {"role": "user" if m.role == "user" else "assistant", "content": m.content}
            for m in messages if m.role in ("user", "assistant")
        ]
        resp = self._c.messages.create(
            model=model,
            system=system or None,
            messages=convo,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
        u = resp.usage
        return ChatCompletion(
            content=text,
            tokens_in=getattr(u, "input_tokens", 0) or 0,
            tokens_out=getattr(u, "output_tokens", 0) or 0,
            raw=resp.model_dump() if hasattr(resp, "model_dump") else {},
        )
