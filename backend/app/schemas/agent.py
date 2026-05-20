from pydantic import BaseModel


class AgentCreate(BaseModel):
    name: str
    description: str = ""
    system_prompt: str = ""
    model_id: int
    temperature: float = 0.7
    max_tokens: int = 2048
    style_config: str = "{}"
    is_published: bool = False


class AgentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    system_prompt: str | None = None
    model_id: int | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    style_config: str | None = None
    is_published: bool | None = None


class AgentOut(BaseModel):
    id: int
    name: str
    description: str
    system_prompt: str
    model_id: int
    temperature: float
    max_tokens: int
    style_config: str
    owner_id: int
    is_published: bool

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    session_id: int | None = None
    agent_id: int
    message: str


class CitationOut(BaseModel):
    document_id: int
    snippet: str
    score: float

    class Config:
        from_attributes = True


class ChatResponse(BaseModel):
    session_id: int
    message_id: int
    reply: str
    citations: list[CitationOut] = []
    tokens_in: int = 0
    tokens_out: int = 0
