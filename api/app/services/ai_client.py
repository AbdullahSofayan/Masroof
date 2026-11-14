"""Integration point for YOUR AI model (not part of the MVP routes).

The rest of the app talks only to the `AIClient` interface, so the real model can be
plugged in later without changing any route or service:

    1. Implement `HttpAIClient` against your model's HTTP API (URL from `AI_SERVICE_URL`).
    2. Make `get_ai_client()` return it when `AI_SERVICE_URL` is set.

Until then `StubAIClient` is used. Results are meant to be stored in `Expense.ai_analysis`.
"""
from abc import ABC, abstractmethod
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ReceiptExtraction(BaseModel):
    """What the model read from a receipt image."""

    amount: Decimal | None = Field(default=None, description="Total amount found on the receipt.")
    date: str | None = Field(default=None, description="Receipt date (ISO format) if found.")
    merchant: str | None = Field(default=None, description="Store / vendor name if found.")
    confidence: float = Field(default=0.0, ge=0, le=1, description="Overall extraction confidence, 0-1.")


class AnomalyScore(BaseModel):
    """How unusual an expense looks."""

    risk_level: RiskLevel = Field(description="Low, medium or high.")
    score: float = Field(ge=0, le=1, description="Raw anomaly score, 0-1.")
    reasons: list[str] = Field(default_factory=list, description="Human-readable reasons shown to the manager.")


class SpendForecast(BaseModel):
    """Predicted spending for the next month."""

    department_id: int | None = Field(default=None, description="Department forecast, or null for company-wide.")
    predicted_total: Decimal = Field(description="Expected approved spending next month.")


class AIClient(ABC):
    """Contract every AI backend (stub or real) must follow."""

    @abstractmethod
    def extract_receipt(self, file_path: str) -> ReceiptExtraction:
        """Read amount / date / merchant from a receipt image."""

    @abstractmethod
    def score_anomaly(self, expense_id: int) -> AnomalyScore:
        """Score an expense against the employee's / department's history."""

    @abstractmethod
    def forecast(self, department_id: int | None) -> SpendForecast:
        """Forecast next month's spending."""


class StubAIClient(AIClient):
    """Placeholder used until the real model exists. Should return neutral, clearly-fake results."""

    def extract_receipt(self, file_path: str) -> ReceiptExtraction:
        raise NotImplementedError

    def score_anomaly(self, expense_id: int) -> AnomalyScore:
        raise NotImplementedError

    def forecast(self, department_id: int | None) -> SpendForecast:
        raise NotImplementedError


class HttpAIClient(AIClient):
    """Adapter that calls your own model service over HTTP (base URL = `AI_SERVICE_URL`)."""

    def __init__(self, base_url: str) -> None:
        self.base_url = base_url

    def extract_receipt(self, file_path: str) -> ReceiptExtraction:
        raise NotImplementedError

    def score_anomaly(self, expense_id: int) -> AnomalyScore:
        raise NotImplementedError

    def forecast(self, department_id: int | None) -> SpendForecast:
        raise NotImplementedError


def get_ai_client() -> AIClient:
    """Factory: HttpAIClient when AI_SERVICE_URL is configured, otherwise StubAIClient."""
    raise NotImplementedError
