from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://aiagent:changeme@localhost:5432/aiagent"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    encryption_key: str = ""
    cors_origins: str = "http://localhost:3000"

    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # MinIO
    minio_endpoint: str = "minio:9000"
    minio_public_endpoint: str = "http://localhost:9000"
    minio_root_user: str = "minio"
    minio_root_password: str = "changeme-minio"
    minio_use_ssl: bool = False
    minio_bucket_docs: str = "docs"
    minio_bucket_attachments: str = "chat-attachments"
    minio_bucket_images: str = "images"
    minio_presign_expiry: int = 3600

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
