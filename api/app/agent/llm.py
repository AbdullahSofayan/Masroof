import os

from langchain_openrouter import ChatOpenRouter

from app.core.config import settings


def get_chat_model(model_name: str):
    if not settings.openrouter_api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")
    # Pydantic settings do not automatically populate os.environ.
    os.environ.setdefault("OPENROUTER_API_KEY", settings.openrouter_api_key)
    return ChatOpenRouter(
        model=model_name,
        temperature=0.2,
        max_tokens=800,
        max_retries=1,
        base_url=settings.openrouter_base_url,
    )


def chat_model_names() -> list[str]:
    fallbacks = [
        item.strip()
        for item in settings.openrouter_chat_fallback_models.split(",")
        if item.strip()
    ]
    return list(dict.fromkeys([settings.openrouter_chat_model, *fallbacks]))
