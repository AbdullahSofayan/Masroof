import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.agent.agent import run_chat
from app.agent.context import build_scope
from app.agent.ratelimit import rate_limit_dependency
from app.agent.schemas import ChatRequest, ChatResponse
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/agent", tags=["AI Assistant"])


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, user=Depends(rate_limit_dependency)):
    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The assistant is not configured. Set OPENROUTER_API_KEY.",
        )
    try:
        return run_chat(build_scope(user), payload.messages)
    except Exception:
        logger.exception("Masroof assistant request failed for user_id=%s", user.id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The assistant is temporarily unavailable. Please try again.",
        )
