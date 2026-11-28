from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Masroof API"
    environment: str = "development"
    database_url: str = (
        "mysql+pymysql://masroof:change-me@localhost:3306/masroof?charset=utf8mb4"
    )
    jwt_secret_key: str = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_BEFORE_DEPLOYMENT"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:8080,http://localhost:5173"
    ai_service_url: str = "http://localhost:8001"

    # OpenRouter configuration. A key is required only when the assistant is used.
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_chat_model: str = "openai/gpt-4o-mini"
    openrouter_chat_fallback_models: str = "google/gemini-2.0-flash-001"
    openrouter_embedding_model: str = "nvidia/nemotron-3.5-embed-1b:free"

    # Agent settings
    agent_enabled: bool = True
    agent_readonly_database_url: str = ""
    agent_chroma_path: str = "app/agent/data/chroma"
    agent_embedding_dimensions: int = 512
    agent_embed_batch_size: int = 32
    agent_sync_enabled: bool = True
    agent_sync_interval_seconds: int = 300
    agent_index_max_expenses: int = 20000
    agent_max_history_messages: int = 10
    agent_max_tool_calls: int = 6
    agent_request_timeout_seconds: int = 45
    agent_rate_limit_per_minute: int = 20
    usd_to_sar_rate: float = 3.75

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [
            origin.strip() for origin in self.cors_origins.split(",") if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
