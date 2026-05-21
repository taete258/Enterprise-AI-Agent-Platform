from pydantic import BaseModel


class ProviderCreate(BaseModel):
    name: str
    kind: str  # openai | anthropic | gemini | openrouter | local
    base_url: str = ""
    api_key: str = ""


class ProviderUpdate(BaseModel):
    name: str | None = None
    base_url: str | None = None
    api_key: str | None = None  # empty string → keep existing; non-empty → re-encrypt
    is_active: bool | None = None


class ProviderTestConfig(BaseModel):
    kind: str
    base_url: str = ""
    api_key: str = ""


class ProviderOut(BaseModel):
    id: int
    name: str
    kind: str
    base_url: str
    is_active: bool

    class Config:
        from_attributes = True


class ModelCreate(BaseModel):
    provider_id: int
    model_id: str
    display_name: str = ""
    context_window: int = 8192
    input_cost_per_1k: float = 0.0
    output_cost_per_1k: float = 0.0
    supports_vision: bool = False
    supports_image_generation: bool = False


class ModelUpdate(BaseModel):
    display_name: str | None = None
    context_window: int | None = None
    input_cost_per_1k: float | None = None
    output_cost_per_1k: float | None = None
    supports_vision: bool | None = None
    supports_image_generation: bool | None = None


class ModelOut(BaseModel):
    id: int
    provider_id: int
    model_id: str
    display_name: str
    context_window: int
    input_cost_per_1k: float
    output_cost_per_1k: float
    supports_vision: bool
    supports_image_generation: bool
    is_active: bool

    class Config:
        from_attributes = True
