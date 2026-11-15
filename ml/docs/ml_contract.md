# ML Contract — Masroof Anomaly Detection

**Owner:** ML (Jassar) · **For:** Backend (`api/` on `main`) and Frontend
**Version:** v0.3 — stub service works now; the real model (Step 9) keeps the same endpoints and fields

Everything the backend and frontend need from ML is in this file.
If something here needs to change, tell ML first, so the stub and the real model stay in sync.

| Part | For | Contents |
|---|---|---|
| A | Everyone | What the model does, how it fits in, who sees what |
| B | Backend | The ML service API |
| C | Backend | Integration code, ready to paste |
| D | Frontend | Badges, reasons, screens, texts, mock data |
| E | Backend | Seed data format (files come from ML in Step 4) |
| F | Everyone | Testing with the stub, what changes later, open questions |

---

# Part A — Overview (everyone)

## A1. What the model does

When an employee submits an expense request, the model checks how **unusual** it is compared to
that employee's history, their department, and the category. It returns a risk level
(low / medium / high) and up to 3 reasons. **It never approves or rejects anything**: it's a hint
for the manager and finance.

What it looks for:
- An amount much higher than this employee usually requests (overall and in this category)
- An amount much higher than usual for the department
- A category this employee rarely uses
- Several requests in the same category for the same day (splitting to stay under a policy limit)
- The same amount requested twice for the same day
- Many requests for the same day
- Weekend dates (Friday–Saturday) and round amounts

## A2. How it fits in

```
Employee submits / edits / resubmits a request
        │
        ▼
Backend saves it (status unchanged) and returns the response immediately
        │
        └──► background task: AnomalyService.score_expense_in_background(expense_id)
                 1. load the expense + the requester's other requests for the same expense_date
                 2. POST {AI_SERVICE_URL}/anomaly/score
                 3. save the result on the expense (ai_analysis, ai_risk_level, ai_score)
                 4. re-score the other same-day requests that are still pending
        │
        ▼
Manager / finance open their queue → see the risk badge and reasons
```

Rules:
- **The ML service never connects to the database.** The backend sends what the model needs.
- **The frontend never calls the ML service.** It only reads what the backend returns.
- **Scoring never blocks the workflow.** If the ML service is down, the request is saved with no AI
  result and scored later (`python -m app.rescore_ai`).

## A3. Who sees what

| User | Sees | Does not see |
|---|---|---|
| Employee (requester) | Nothing about AI, on their own requests | Risk, reasons, score |
| Manager (`approvals.act_manager_step`) | Risk badge + reasons on their reports' requests | Raw score |
| Finance (`approvals.act_finance_step`) | Risk badge + reasons on all requests they can see | Raw score |
| Department / company viewers (`expenses.view_department` / `view_all`) | Risk badge + reasons | Raw score |
| Finance dashboard | Counts by risk, flagged share per department, top reasons | — |

**Nobody sees the AI result on their own request**, even a manager who submits one.

## A4. Ports

| Service | Port |
|---|---|
| Backend (`api/`) | 8000 |
| ML service (`ml/`) | 8001 |
| Frontend | 5173 |
| MariaDB | 3306 |

---

# Part B — ML service API (backend)

## B1. Running it

From the `ml/` folder:

```bash
pip install -r requirements.txt
uvicorn src.service:app --port 8001 --reload
```

Swagger docs: **http://localhost:8001/docs**

Backend `.env`:

```
AI_SERVICE_URL=http://localhost:8001
```

Optional Docker (add to `api/docker-compose.yml` under `services:`):

```yaml
  ml:
    build: ../ml
    container_name: expense-ml
    ports:
      - "8001:8001"
```

## B2. Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | `{"status": "ok", "model_version": "..."}` |
| POST | `/anomaly/score` | Score one request |
| POST | `/anomaly/score-batch` | Score up to 500 requests in one call (re-scoring, seed history) |
| GET | `/anomaly/categories` | The category names the model accepts |
| GET | `/anomaly/reasons` | Every reason code with English + Arabic text |

Paths start with `/anomaly/` so forecasting and receipt reading can be added to the same
service later under their own prefix, behind the same `AI_SERVICE_URL`.

## B3. `POST /anomaly/score` — request

```json
{
  "expense_id": 123,
  "requester_id": 45,
  "department_id": 7,
  "category": "Office Supplies",
  "amount": "450.00",
  "expense_date": "2026-03-15",
  "same_day_requests": [
    {"expense_id": 120, "category": "Office Supplies", "amount": "1900.00"}
  ]
}
```

| Field | Type | From | Notes |
|---|---|---|---|
| `expense_id` | int | `expenses.id` | |
| `requester_id` | int | `expenses.requester_id` | |
| `department_id` | int or null | `expenses.department_id` | Null allowed |
| `category` | string | `categories.name` | **One of the 6 below, spelled exactly** |
| `amount` | decimal > 0 | `expenses.amount` | SAR |
| `expense_date` | `YYYY-MM-DD` | `expenses.expense_date` | |
| `same_day_requests` | list | query in C4 | The requester's **other** requests with the same `expense_date`, **any status**, **not including this one**. `[]` if none |

Rejected requests are included on purpose: someone who splits a request and gets one part
rejected is still splitting.

**Categories the model accepts** (must match `categories.name` exactly):

```
Food, Travel, Transportation, Office Supplies, IT & Telecom, Equipment & Maintenance
```

There is **no "Other" category**: the model is trained only on these 6.
**If a category is renamed or added, tell ML first.** The model has to be retrained for it.

## B4. `POST /anomaly/score` — response

```json
{
  "expense_id": 123,
  "score": 0.871,
  "risk_level": "high",
  "is_flagged": true,
  "reasons": [
    "Several requests in the same category for the same day (possible split to stay under a limit)"
  ],
  "reason_details": [
    {
      "code": "possible_split_request",
      "text_en": "Several requests in the same category for the same day (possible split to stay under a limit)",
      "text_ar": "عدة طلبات في نفس الفئة لنفس اليوم (احتمال تجزئة الطلب للبقاء تحت الحد المسموح)"
    }
  ],
  "model_version": "stub-0.2"
}
```

| Field | Meaning |
|---|---|
| `score` | 0–1, higher = more unusual. **For sorting only, never shown to users** |
| `risk_level` | `low` / `medium` / `high` |
| `is_flagged` | `true` when medium or high |
| `reasons` | English texts, 0–3, most important first. Empty when low |
| `reason_details` | The same reasons with `code`, `text_en`, `text_ar` |
| `model_version` | Which model produced this result |

## B5. `POST /anomaly/score-batch`

Request: `{"items": [ <same body as /anomaly/score>, ... ]}` (max 500)
Response: `{"results": [ <same response as /anomaly/score>, ... ]}` (same order)

## B6. Errors

| Status | When | What the backend does |
|---|---|---|
| 422 | Invalid body (unknown category, amount ≤ 0, more than 500 batch items) | Bug: log it, save no AI result |
| 5xx / timeout / connection refused | ML service down or busy | Log a warning, save no AI result, re-score later |

## B7. Reason codes

Drafts. Final texts in Step 8; the list may get shorter after Step 6.

| Code | English | Arabic |
|---|---|---|
| `amount_high_for_employee` | Amount is much higher than this employee's usual requests | المبلغ أعلى بكثير من معدل طلبات هذا الموظف |
| `amount_high_for_employee_category` | Amount is much higher than this employee usually requests in this category | المبلغ أعلى بكثير مما يطلبه هذا الموظف عادةً في هذه الفئة |
| `amount_high_for_department` | Amount is much higher than usual for this department | المبلغ أعلى بكثير من المعتاد في هذا القسم |
| `large_amount` | Very large amount | مبلغ كبير جداً |
| `unusual_category_for_employee` | This employee rarely submits requests in this category | نادراً ما يقدّم هذا الموظف طلبات في هذه الفئة |
| `weekend_expense` | Expense date falls on a weekend (Friday–Saturday) | تاريخ المصروف في عطلة نهاية الأسبوع (الجمعة–السبت) |
| `round_amount` | Round amount (e.g. 500 or 1,000) | المبلغ رقم مقرّب (مثل 500 أو 1,000) |
| `duplicate_request` | Same amount in the same category requested more than once for the same day | نفس المبلغ في نفس الفئة طُلب أكثر من مرة لنفس اليوم |
| `possible_split_request` | Several requests in the same category for the same day (possible split to stay under a limit) | عدة طلبات في نفس الفئة لنفس اليوم (احتمال تجزئة الطلب للبقاء تحت الحد المسموح) |
| `many_requests_same_day` | Unusually many requests by this employee for the same day | عدد طلبات غير معتاد من هذا الموظف لنفس اليوم |

---

# Part C — Backend integration (paste-ready)

`httpx` is already in `api/requirements.txt`. Nothing new to install.

## C1. `app/services/ai_client.py`

**Keep** `RiskLevel`, `ReceiptExtraction` and `SpendForecast` as they are.
**Replace** `AnomalyScore`, `AIClient`, `StubAIClient`, `HttpAIClient` and `get_ai_client` with the code below,
and add the new imports at the top of the file.

```python
from datetime import date
from typing import TYPE_CHECKING

import httpx

from app.core.config import get_settings

if TYPE_CHECKING:
    from app.models.expense import Expense


class ReasonDetail(BaseModel):
    """One reason, in both languages."""

    code: str = Field(description="Stable reason code, e.g. possible_split_request.")
    text_en: str = Field(description="English text.")
    text_ar: str = Field(description="Arabic text.")


class AnomalyScore(BaseModel):
    """How unusual an expense looks. Same shape as the ML service's response."""

    expense_id: int | None = Field(default=None, description="Expense that was scored.")
    risk_level: RiskLevel = Field(description="Low, medium or high.")
    score: float = Field(ge=0, le=1, description="Raw anomaly score, 0-1. For sorting only, never shown to users.")
    is_flagged: bool = Field(default=False, description="True when risk_level is medium or high.")
    reasons: list[str] = Field(default_factory=list, description="English reason texts.")
    reason_details: list[ReasonDetail] = Field(default_factory=list, description="Reasons with code + English + Arabic.")
    model_version: str = Field(default="", description="Model that produced this result.")


class AIClient(ABC):
    """Contract every AI backend (stub or real) must follow."""

    @abstractmethod
    def extract_receipt(self, file_path: str) -> ReceiptExtraction:
        """Read amount / date / merchant from a receipt image."""

    @abstractmethod
    def score_anomaly(self, expense: "Expense", same_day: list["Expense"]) -> AnomalyScore:
        """Score one expense. `same_day` = the requester's OTHER requests with the same expense_date."""

    def score_anomaly_batch(self, pairs: list[tuple["Expense", list["Expense"]]]) -> list[AnomalyScore]:
        """Score many expenses. Default: one call each. HttpAIClient overrides it with one request."""
        return [self.score_anomaly(expense, same_day) for expense, same_day in pairs]

    @abstractmethod
    def forecast(self, department_id: int | None) -> SpendForecast:
        """Forecast next month's spending."""


class StubAIClient(AIClient):
    """Used when AI_SERVICE_URL is empty. Neutral, clearly fake results."""

    def extract_receipt(self, file_path: str) -> ReceiptExtraction:
        raise NotImplementedError

    def score_anomaly(self, expense: "Expense", same_day: list["Expense"]) -> AnomalyScore:
        return AnomalyScore(expense_id=expense.id, risk_level=RiskLevel.LOW, score=0.0, model_version="none")

    def forecast(self, department_id: int | None) -> SpendForecast:
        raise NotImplementedError


class HttpAIClient(AIClient):
    """Calls the ML service (base URL = AI_SERVICE_URL)."""

    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    @staticmethod
    def _payload(expense: "Expense", same_day: list["Expense"]) -> dict:
        return {
            "expense_id": expense.id,
            "requester_id": expense.requester_id,
            "department_id": expense.department_id,
            "category": expense.category.name,
            "amount": str(expense.amount),
            "expense_date": expense.expense_date.isoformat(),
            "same_day_requests": [
                {"expense_id": e.id, "category": e.category.name, "amount": str(e.amount)}
                for e in same_day
            ],
        }

    def score_anomaly(self, expense: "Expense", same_day: list["Expense"]) -> AnomalyScore:
        r = httpx.post(f"{self.base_url}/anomaly/score", json=self._payload(expense, same_day), timeout=3.0)
        r.raise_for_status()
        return AnomalyScore.model_validate(r.json())

    def score_anomaly_batch(self, pairs: list[tuple["Expense", list["Expense"]]]) -> list[AnomalyScore]:
        body = {"items": [self._payload(expense, same_day) for expense, same_day in pairs]}
        r = httpx.post(f"{self.base_url}/anomaly/score-batch", json=body, timeout=30.0)
        r.raise_for_status()
        return [AnomalyScore.model_validate(x) for x in r.json()["results"]]

    def extract_receipt(self, file_path: str) -> ReceiptExtraction:
        raise NotImplementedError  # not provided by the anomaly service (see F3)

    def forecast(self, department_id: int | None) -> SpendForecast:
        raise NotImplementedError  # not provided by the anomaly service (see F3)


def get_ai_client() -> AIClient:
    """HttpAIClient when AI_SERVICE_URL is configured, otherwise StubAIClient."""
    url = get_settings().ai_service_url
    return HttpAIClient(url) if url else StubAIClient()
```

## C2. `app/models/expense.py` — three columns next to `ai_analysis`

`ai_analysis` keeps the full JSON. These columns make filtering, sorting and the dashboard
simple SQL instead of JSON queries.

Add to the imports at the top:

```python
from datetime import datetime
from sqlalchemy import DateTime, Float
```

Add inside `class Expense`, under `ai_analysis`:

```python
    ai_risk_level: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True, index=True, comment="low / medium / high from the ML service. Null = not scored yet."
    )
    ai_score: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True, comment="0-1 anomaly score, for sorting. Never shown to users."
    )
    ai_scored_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="When it was last scored.")
```

Then: `alembic revision --autogenerate -m "add ai columns"` and `alembic upgrade head`.

## C3. New file `app/services/anomaly_service.py`

```python
"""Runs anomaly scoring and stores the result on the expense. Never raises into the workflow."""
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.constants import ExpenseStatus
from app.core.database import SessionLocal
from app.models.expense import Expense
from app.services.ai_client import AnomalyScore, get_ai_client

log = logging.getLogger(__name__)

PENDING_STATUSES = {ExpenseStatus.PENDING_MANAGER, ExpenseStatus.PENDING_FINANCE, ExpenseStatus.NEEDS_CHANGES}


def same_day_requests(db: Session, expense: Expense) -> list[Expense]:
    """The requester's OTHER requests with the same expense_date, any status."""
    return (
        db.query(Expense)
        .filter(
            Expense.requester_id == expense.requester_id,
            Expense.expense_date == expense.expense_date,
            Expense.id != expense.id,
        )
        .all()
    )


def save_result(expense: Expense, result: AnomalyScore) -> None:
    expense.ai_analysis = result.model_dump(mode="json")
    expense.ai_risk_level = result.risk_level.value
    expense.ai_score = result.score
    expense.ai_scored_at = datetime.now(timezone.utc).replace(tzinfo=None)


def score_expense_in_background(expense_id: int) -> None:
    """Run as a FastAPI BackgroundTask AFTER the expense is committed.

    Also re-scores the requester's other pending requests for the same day: when a third
    split request arrives, the first two become suspicious too.
    """
    db = SessionLocal()
    try:
        expense = db.get(Expense, expense_id)
        if expense is None:
            return
        client = get_ai_client()
        siblings = same_day_requests(db, expense)
        save_result(expense, client.score_anomaly(expense, siblings))
        for other in siblings:
            if other.status in PENDING_STATUSES:
                others_same_day = [e for e in siblings if e.id != other.id] + [expense]
                save_result(other, client.score_anomaly(other, others_same_day))
        db.commit()
    except Exception as exc:  # ML down, timeout, bad response: never break the workflow
        db.rollback()
        log.warning("Anomaly scoring failed for expense %s: %s", expense_id, exc)
    finally:
        db.close()
```

## C4. Where to call it — `app/routes/expenses.py`

Add `BackgroundTasks` to the three routes that create or change a request:

```python
from fastapi import BackgroundTasks
from app.services.anomaly_service import score_expense_in_background

def create_expense(body: ExpenseCreate, db: DbSession, current_user: CurrentUser, background_tasks: BackgroundTasks):
    expense = ExpenseService(db).create_expense(current_user, body)
    background_tasks.add_task(score_expense_in_background, expense.id)
    return expense

def update_expense(expense_id: ExpenseId, body: ExpenseUpdate, db: DbSession, current_user: CurrentUser,
                   background_tasks: BackgroundTasks):
    expense = ExpenseService(db).update_expense(current_user, expense_id, body)
    background_tasks.add_task(score_expense_in_background, expense.id)
    return expense

def resubmit_expense(expense_id: ExpenseId, db: DbSession, current_user: CurrentUser, background_tasks: BackgroundTasks):
    expense = ExpenseWorkflowService(db).resubmit(current_user, expense_id)
    background_tasks.add_task(score_expense_in_background, expense.id)
    return expense
```

Background tasks run after the response is sent, so the employee never waits for the model.
They use their own session (`SessionLocal()`), because the request's session is closed by then.

## C5. Re-scoring — new file `app/rescore_ai.py`

For requests that were saved while the ML service was down, for the seed history, and after a
new model version.

```python
"""Score expenses with the ML service.

    python -m app.rescore_ai          # only expenses with no AI result yet
    python -m app.rescore_ai --all    # every expense (e.g. after a new model version)
"""
import sys
from collections import defaultdict

from app.core.database import SessionLocal
from app.models.expense import Expense
from app.services.ai_client import get_ai_client
from app.services.anomaly_service import save_result

BATCH_SIZE = 500


def run(rescore_all: bool) -> None:
    db = SessionLocal()
    try:
        everything = db.query(Expense).all()
        by_day = defaultdict(list)
        for e in everything:
            by_day[(e.requester_id, e.expense_date)].append(e)

        targets = everything if rescore_all else [e for e in everything if e.ai_risk_level is None]
        client = get_ai_client()
        for start in range(0, len(targets), BATCH_SIZE):
            chunk = targets[start:start + BATCH_SIZE]
            pairs = [(e, [o for o in by_day[(e.requester_id, e.expense_date)] if o.id != e.id]) for e in chunk]
            for expense, result in zip(chunk, client.score_anomaly_batch(pairs)):
                save_result(expense, result)
            db.commit()
            print(f"Scored {start + len(chunk)}/{len(targets)}")
    finally:
        db.close()


if __name__ == "__main__":
    run(rescore_all="--all" in sys.argv)
```

## C6. Showing it to the right people — `app/schemas/expense.py`

```python
from typing import Literal
from app.services.ai_client import ReasonDetail


class AnomalyView(BaseModel):
    """What approvers see. The raw score is never included."""

    risk_level: Literal["low", "medium", "high"] = Field(description="Badge to show.")
    is_flagged: bool = Field(description="True when medium or high.")
    reasons: list[str] = Field(description="English reason texts, most important first.")
    reason_details: list[ReasonDetail] = Field(description="Reasons with code + English + Arabic.")
    model_version: str = Field(description="Model that produced this result.")
```

Add to `ExpenseRead`:

```python
    ai: AnomalyView | None = Field(
        default=None,
        description="AI risk check. Null for the requester, for users without approver/department/company scope, "
                    "and when the request hasn't been scored yet.",
    )
```

Fill it when building the response (`ai` isn't a column, so set it after `model_validate`):

```python
from app.core.constants import (PERM_APPROVE_FINANCE_STEP, PERM_APPROVE_MANAGER_STEP,
                                PERM_EXPENSES_VIEW_ALL, PERM_EXPENSES_VIEW_DEPARTMENT)
from app.services.rbac_service import RbacService

AI_VIEW_PERMISSIONS = [PERM_APPROVE_MANAGER_STEP, PERM_APPROVE_FINANCE_STEP,
                       PERM_EXPENSES_VIEW_DEPARTMENT, PERM_EXPENSES_VIEW_ALL]


def ai_view_for(db, user, expense) -> AnomalyView | None:
    if expense.ai_analysis is None or user.id == expense.requester_id:
        return None
    if user.is_superuser or RbacService(db).user_has_any_permission(user, AI_VIEW_PERMISSIONS):
        return AnomalyView.model_validate(expense.ai_analysis)
    return None


def to_expense_read(db, user, expense) -> ExpenseRead:
    read = ExpenseRead.model_validate(expense)
    read.ai = ai_view_for(db, user, expense)
    return read
```

Use `to_expense_read` in every route that returns `ExpenseRead` (list, get, create, update,
resubmit, pending approvals).

## C7. Filtering and sorting

`GET /expenses` — add a filter:

```python
risk_level: Annotated[Literal["low", "medium", "high"] | None,
                      Query(description="Only requests with this AI risk level.")] = None
# in the query:  if risk_level: q = q.filter(Expense.ai_risk_level == risk_level)
```

`GET /approvals/pending` — **riskiest first**, then oldest first:

```python
from sqlalchemy import case

risk_order = case({"high": 0, "medium": 1, "low": 2}, value=Expense.ai_risk_level, else_=3)
q = q.order_by(risk_order, Expense.created_at)
```

## C8. Dashboards — `app/schemas/dashboard.py`

```python
class RiskCounts(BaseModel):
    high: int = Field(description="Requests with AI risk high.")
    medium: int = Field(description="Requests with AI risk medium.")
    low: int = Field(description="Requests with AI risk low.")
    not_scored: int = Field(description="Requests with no AI result yet.")


class DepartmentRisk(BaseModel):
    department_id: int = Field(description="Department id.")
    department_name: str = Field(description="Department name.")
    flagged: int = Field(description="Requests with risk medium or high.")
    total: int = Field(description="All scored requests.")
    flagged_percent: float = Field(description="flagged / total x 100.")


class ReasonCount(BaseModel):
    code: str = Field(description="Reason code.")
    text_en: str = Field(description="English text.")
    text_ar: str = Field(description="Arabic text.")
    count: int = Field(description="How many flagged requests have this reason.")


class AnomalySummary(BaseModel):
    counts: RiskCounts = Field(description="Requests by AI risk level.")
    by_department: list[DepartmentRisk] = Field(description="Flagged share per department, highest first.")
    top_reasons: list[ReasonCount] = Field(description="Most common reasons among flagged requests (top 5).")
```

Add `anomalies: AnomalySummary` to `FinanceDashboard`, and
`flagged_awaiting_my_approval: int` to `ManagerDashboard`.
`top_reasons` is computed by counting `ai_analysis["reason_details"][*]["code"]` over flagged requests.

---

# Part D — Frontend

## D1. Where the data comes from

From the backend only: the **`ai`** field on every expense (`ExpenseRead.ai`) and
`anomalies` on the finance dashboard. **Never call the ML service directly.**

`ai` is `null` when the viewer is the requester, has no approver/department/company scope, or the
request hasn't been scored yet. Treat `null` as "show nothing" for employees; for approvers,
show the "Not analyzed" state.

## D2. Risk badge

| `ai.risk_level` | English | Arabic | Color |
|---|---|---|---|
| `high` | High risk | خطر مرتفع | Red |
| `medium` | Medium risk | خطر متوسط | Amber |
| `low` | Low risk | خطر منخفض | Green (or a subtle grey) |
| `ai` is `null` (approver view) | Not analyzed | لم يُحلَّل | Grey |

Don't rely on color alone: always show the text label too.

## D3. Reasons

- Show `ai.reason_details`, in order (most important first), max 3.
- Arabic UI → `text_ar`; English UI → `text_en`.
- If `reason_details` is empty but `reasons` isn't, show `reasons` (English).
- `low` has no reasons: show only the badge.

## D4. Screens

| Screen | Endpoint | What to add |
|---|---|---|
| Pending approvals (manager + finance) | `GET /approvals/pending` | Risk badge on each row. Already sorted riskiest first. Optional filter chips: All / High / Medium |
| Expense detail (approver view) | `GET /expenses/{id}` | An "AI risk check" panel: badge, reasons, and the note in D5 |
| Expenses list (department / company view) | `GET /expenses?risk_level=high` | Risk badge column + risk filter |
| Manager dashboard | `ManagerDashboard.flagged_awaiting_my_approval` | One number: flagged requests waiting for you |
| Finance dashboard | `FinanceDashboard.anomalies` | Requests by risk (bar), flagged % per department (bar), top reasons (list) |
| Employee screens | — | **Nothing.** No badge, no reasons, no score |

## D5. Fixed texts

| Where | English | Arabic |
|---|---|---|
| Panel title | AI risk check | فحص المخاطر بالذكاء الاصطناعي |
| Note under the reasons | This is an automatic hint to help your review. It is not a decision. | هذا تنبيه آلي للمساعدة في المراجعة، وليس قراراً. |
| Not analyzed | Not analyzed yet | لم يُحلَّل بعد |
| Dashboard section title | Unusual requests | الطلبات غير المعتادة |

## D6. Mock data (the `ai` field)

High:

```json
{
  "risk_level": "high",
  "is_flagged": true,
  "reasons": [
    "Several requests in the same category for the same day (possible split to stay under a limit)",
    "Amount is much higher than this employee usually requests in this category"
  ],
  "reason_details": [
    {"code": "possible_split_request",
     "text_en": "Several requests in the same category for the same day (possible split to stay under a limit)",
     "text_ar": "عدة طلبات في نفس الفئة لنفس اليوم (احتمال تجزئة الطلب للبقاء تحت الحد المسموح)"},
    {"code": "amount_high_for_employee_category",
     "text_en": "Amount is much higher than this employee usually requests in this category",
     "text_ar": "المبلغ أعلى بكثير مما يطلبه هذا الموظف عادةً في هذه الفئة"}
  ],
  "model_version": "stub-0.2"
}
```

Medium:

```json
{
  "risk_level": "medium",
  "is_flagged": true,
  "reasons": ["Expense date falls on a weekend (Friday–Saturday)"],
  "reason_details": [
    {"code": "weekend_expense",
     "text_en": "Expense date falls on a weekend (Friday–Saturday)",
     "text_ar": "تاريخ المصروف في عطلة نهاية الأسبوع (الجمعة–السبت)"}
  ],
  "model_version": "stub-0.2"
}
```

Low:

```json
{"risk_level": "low", "is_flagged": false, "reasons": [], "reason_details": [], "model_version": "stub-0.2"}
```

Not analyzed / hidden: `null`

---

# Part E — Seed data (backend, files from ML in Step 4)

## E1. Files

ML delivers three CSV files (UTF-8). **The format is fixed now** so the seed script can be written in parallel.

`departments.csv`

| Column | Example | Notes |
|---|---|---|
| `id` | 7 | Keep it |
| `name` | IT | Unique |
| `description` | Information technology | |
| `manager_id` | 412 | A `users.id` from users.csv |

`users.csv`

| Column | Example | Notes |
|---|---|---|
| `id` | 412 | Keep it |
| `username` | fahad.alharbi | Unique |
| `email` | fahad.alharbi@example.com | Unique |
| `full_name` | Fahad Al-Harbi | Arabic name in English letters |
| `department_id` | 7 | |
| `manager_id` | 398 | Empty for department managers |
| `group` | Employee | `Employee`, `Manager` or `Finance` — must match the seeded group names |

`expenses.csv` (history)

| Column | Example | Notes |
|---|---|---|
| `id` | 100231 | Keep it |
| `requester_id` | 412 | |
| `department_id` | 7 | |
| `category` | Office Supplies | Category **name**; look up `categories.id` |
| `amount` | 450.00 | SAR |
| `currency` | SAR | |
| `description` | Office supplies purchase | Generated text |
| `expense_date` | 2025-08-14 | |
| `status` | approved | History is already decided |
| `created_at` | 2025-08-14 09:00:00 | |

## E2. Import rules

1. **Keep the ids from the files.** The model remembers employees and departments by id: if
   AUTO_INCREMENT assigns new ones, employee 412 in the database is a different person than
   employee 412 in the model. (Inserting explicit ids is fine in MariaDB; the counter moves past them.)
2. Order: run the normal seed (permissions, admin, categories, settings, groups) →
   departments **without** `manager_id` → users → set `departments.manager_id` → expenses.
3. **One demo password for all seeded users** (e.g. `DEMO_USER_PASSWORD` in `.env`): hash it
   **once** and reuse the hash. Hashing thousands of passwords one by one with Argon2 is slow.
4. Historical expenses have no `Approval` rows. That's fine for the prototype.
5. Afterwards run `python -m app.rescore_ai` so the history has AI results for the dashboards.
6. Make the seed idempotent like the existing one: skip rows whose id already exists.

## E3. Policies (suggestion, final numbers in Step 4)

A maximum per request makes the split-detection demo clear (an employee needs 5,000 SAR of
supplies and submits three requests under 2,000). Suggested starting values, to be checked against
the data in Step 4:

| Category | `max_amount` (SAR) |
|---|---|
| Office Supplies | 2,000 |
| IT & Telecom | 5,000 |
| Equipment & Maintenance | 5,000 |
| Food | 1,000 |
| Transportation | 1,500 |
| Travel | 10,000 |

---

# Part F — Testing, changes, open questions

## F1. Testing with the stub

The stub returns **fake** scores, roughly 80% low / 15% medium / 5% high.

- The **same `expense_id` always gets the same result** (repeatable tests).
- **`amount` over 10,000** → always `high` with `large_amount`.
- **2 or more same-category requests in `same_day_requests`** → always `high` with `possible_split_request`.
- A category outside the 6 → **422** (name mismatches show up on the first test).
- To test "Not analyzed": stop the ML service, submit a request, check `ai` is `null`, start it again,
  run `python -m app.rescore_ai`.

## F2. What changes when the real model arrives (Step 9)

- Only the inside of `ml/src/predict.py` changes. **Endpoints, request and response stay the same.**
- `model_version` changes from `stub-0.2`. Run `python -m app.rescore_ai --all` once.
- Risk cut-offs come from the data (Step 7); reason texts are finalized (Step 8);
  the list of reason codes may get shorter (Step 6).

## F3. Open questions

| Question | Owner | Status |
|---|---|---|
| Who builds receipt reading (`extract_receipt`)? Not part of the anomaly model | Team | Open — mark out of scope if nobody owns it |
| Does forecasting join this service (`/forecast/...`) or get its own URL? | Forecasting + Backend | Open |
| `score_anomaly(expense, same_day)` instead of `score_anomaly(expense_id)` | Backend | Proposed in C1 |
| Which departments go into the demo database | Team | Step 4 |

## F4. Changing this contract

Any change (a field, a category name, an endpoint) goes through ML first. ML updates the stub and
this file, then tells both teams. The version at the top goes up with every change.
