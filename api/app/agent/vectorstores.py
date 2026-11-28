from pathlib import Path

import chromadb

from app.core.config import settings

_client = None
_knowledge = None
_expenses = None


def get_client():
    global _client
    if _client is None:
        path = Path(settings.agent_chroma_path)
        path.mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=str(path))
    return _client


def get_knowledge_collection():
    global _knowledge
    if _knowledge is None:
        _knowledge = get_client().get_or_create_collection(
            "masroof_knowledge", metadata={"hnsw:space": "cosine"}
        )
    return _knowledge


def get_expense_collection():
    global _expenses
    if _expenses is None:
        _expenses = get_client().get_or_create_collection(
            "masroof_expenses", metadata={"hnsw:space": "cosine"}
        )
    return _expenses
