import math
import time

import httpx

from app.core.config import settings


class OpenRouterEmbeddings:
    """Small explicit OpenRouter embedder; vectors are truncated and re-normalized."""

    def __init__(self):
        if not settings.openrouter_api_key:
            raise RuntimeError("OPENROUTER_API_KEY is not configured")
        self.url = settings.openrouter_base_url.rstrip("/") + "/embeddings"

    def _embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        headers = {
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.openrouter_embedding_model,
            "input": texts,
            "encoding_format": "float",
        }
        last_error = None
        for attempt in range(3):
            try:
                response = httpx.post(
                    self.url,
                    headers=headers,
                    json=payload,
                    timeout=settings.agent_request_timeout_seconds,
                )
                if response.status_code == 429 or response.status_code >= 500:
                    response.raise_for_status()
                response.raise_for_status()
                data = sorted(response.json()["data"], key=lambda item: item["index"])
                vectors = []
                for item in data:
                    vector = [float(value) for value in item["embedding"]][
                        : settings.agent_embedding_dimensions
                    ]
                    norm = math.sqrt(sum(value * value for value in vector))
                    if not norm:
                        raise ValueError("Embedding provider returned a zero vector")
                    vectors.append([value / norm for value in vector])
                return vectors
            except (httpx.HTTPError, KeyError, ValueError) as exc:
                last_error = exc
                if attempt < 2:
                    time.sleep(2**attempt)
        raise RuntimeError(f"Embedding request failed: {last_error}")

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        batch_size = max(1, settings.agent_embed_batch_size)
        output = []
        for start in range(0, len(texts), batch_size):
            output.extend(self._embed(texts[start : start + batch_size]))
        return output

    def embed_query(self, text: str) -> list[float]:
        return self._embed([text])[0]
