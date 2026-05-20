from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class ChatMessage:
    role: str  # system | user | assistant | tool
    content: str


@dataclass
class ChatCompletion:
    content: str
    tokens_in: int = 0
    tokens_out: int = 0
    raw: dict = field(default_factory=dict)


class LLMProviderClient(Protocol):
    """Adapter for a single LLM provider instance."""

    def chat(
        self,
        model: str,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> ChatCompletion: ...

    def list_models(self) -> list[dict]: ...

    def test(self) -> dict: ...
