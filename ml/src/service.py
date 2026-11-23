"""
Masroof ML service — anomaly scoring over HTTP.

Run from the ML folder:
    uvicorn src.service:app --port 8001 --reload

Backend .env:
    AI_SERVICE_URL=http://localhost:8001

Docs (Swagger): http://localhost:8001/docs
"""

from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

from src.predict import (CATEGORIES, MODEL_VERSION, REASONS, history_info, reason_detail,
                         score_request, use_added_file)

# Requests scored by the service are kept here (git-ignored, data/ is never committed), so a restart
# doesn't forget them. Delete the file to go back to the training history only.
use_added_file(Path(__file__).resolve().parent.parent / "data" / "service" / "added_requests.csv")

CategoryName = Literal[
    "Food", "Travel", "Transportation", "Office Supplies",
    "IT & Telecom", "Equipment & Maintenance",
]
assert list(CategoryName.__args__) == CATEGORIES  # keep the two lists in sync


class SameDayRequest(BaseModel):
    expense_id: int
    category: CategoryName
    amount: Decimal = Field(gt=0)


class ScoreRequest(BaseModel):
    expense_id: int = Field(description="Expense being scored.")
    requester_id: int = Field(description="users.id of the employee.")
    department_id: int | None = Field(description="expenses.department_id (may be null).")
    category: CategoryName = Field(description="categories.name, exactly.")
    amount: Decimal = Field(gt=0, description="Requested amount in SAR.")
    expense_date: date = Field(description="Date the expense is for.")
    same_day_requests: list[SameDayRequest] = Field(
        default_factory=list,
        description="The requester's OTHER requests with the same expense_date (any status). Empty if none.",
    )
    category_limit: Decimal | None = Field(
        default=None, gt=0,
        description="Current max_amount for this category (expense_limits). Optional: missing → ML's copy (contract v0.4.5).",
    )


class ReasonDetail(BaseModel):
    code: str
    text_en: str
    text_ar: str


class ScoreResponse(BaseModel):
    expense_id: int
    score: float = Field(ge=0, le=1, description="0-1, higher = more unusual. For sorting, not for display.")
    risk_level: Literal["low", "medium", "high"]
    is_flagged: bool = Field(description="True when risk_level is medium or high.")
    reasons: list[str] = Field(description="English reason texts (fits the backend's AnomalyScore.reasons).")
    reason_details: list[ReasonDetail] = Field(description="Same reasons with code + English + Arabic.")
    model_version: str


class BatchRequest(BaseModel):
    items: list[ScoreRequest] = Field(max_length=500, description="Up to 500 requests per call.")


class BatchResponse(BaseModel):
    results: list[ScoreResponse] = Field(description="One result per item, in the same order.")


app = FastAPI(
    title="Masroof ML Service",
    version=MODEL_VERSION,
    description="Anomaly scoring for expense requests. See docs/ml_contract.md.",
)


@app.get("/health")
def health():
    """Status, model version, and how many requests the service compares new ones with."""
    return {"status": "ok", "model_version": MODEL_VERSION, "history": history_info()}


@app.get("/anomaly/categories", response_model=list[str])
def categories():
    """Category names the model accepts."""
    return CATEGORIES


@app.get("/anomaly/reasons", response_model=list[ReasonDetail])
def reasons():
    """Every reason code with its English and Arabic text (for the frontend)."""
    return [reason_detail(c) for c in REASONS]


@app.post("/anomaly/score", response_model=ScoreResponse)
def score(req: ScoreRequest):
    """Score one expense request."""
    expense = req.model_dump(mode="json", exclude={"same_day_requests"})
    same_day = [r.model_dump(mode="json") for r in req.same_day_requests]
    return score_request(expense, same_day)


@app.post("/anomaly/score-batch", response_model=BatchResponse)
def score_batch(req: BatchRequest):
    """Score up to 500 requests in one call (re-scoring, seed history)."""
    return {"results": [score(item) for item in req.items]}


# ---------- Forecasting (Abdullah, ml/forecasting) ----------
# Agreed 23 Nov: the forecasting routes (e.g. POST /forecast/predict, using src/forecast.py) go
# below this line, so the two parts of the service don't edit the same lines.
