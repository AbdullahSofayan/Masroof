# ML Contract — Masroof Anomaly Detection

**Owner:** ML (Jassar) · **For:** Backend (`backend/expense`, `backend/finance`), Frontend (`frontend/employee-manager`)
**Version:** v0.4.4 — 23 Nov 2026 · Based on the **final ERD** (Abdulaziz, 18 Nov) and the Step 4 demo data · C10 = how it fits Omar's first `backend/expense` code · v0.4.4 = Step 8 results: 13 reason codes, real risk levels (model `iforest-0.2`)
**Stub:** the ML service works now with fake scores (`stub-0.2`). The real model (Step 9) keeps the same endpoints and fields.

Everything the backend and frontend need from ML is in this file.
If something here needs to change, tell ML first, so the stub and the real model stay in sync.

| Part | For | Contents |
|---|---|---|
| A | Everyone | What the model does, how it fits in, who sees what, ports |
| B | Backend | The ML service API + which response field goes into which EXPENSE column |
| C | Backend | Integration code written against the ERD (adjust names to your code); C10 = review of the first `backend/expense` code |
| D | Frontend | Badge, AI reasons vs rule warnings, screens per role, categories, statuses, texts, mock data |
| E | Backend | Seed data: files, columns, ID ranges, import order, limits, budget |
| F | Everyone | Testing with the stub, what changes later, mentor feedback, open questions, changelog |

---

# Part A — Overview (everyone)

## A1. What the model does

When an employee submits an expense request, the model checks how **unusual** it is compared to that
employee's own earlier requests, their department, and the category. It returns a risk level
(`low` / `medium` / `high`) and up to 3 reasons.

**It never approves or rejects anything.** It's a hint for the department manager.

What it looks for:
- An amount much higher than this employee usually requests (overall, and in this category)
- For new employees (fewer than 5 earlier requests): an amount much higher than usual for their department in this category
- A category this employee rarely uses
- Several requests in the same category for the same day (splitting to stay under a limit)
- The same amount requested twice for the same day, or again within 7 days (≥ 1,000 SAR)
- Many requests for the same day
- Weekend dates (Friday–Saturday) and round amounts
- Made-up-looking amounts (repeated or sequential digits, e.g. 1,111.11)
- The first request after a long break (90+ days without requests)

How it decides (Step 7–8): an Isolation Forest model judges "unusual for this person" (amount, category,
weekend, round), and 6 clear rules catch same-day and time patterns (split, duplicates, busy day, made-up digits,
long break). **High** = the model's most unusual 1% (careful check). **Medium** = the model's next 0.5%, or any rule
(quick look). On the demo history that's ≈1% high and ≈3.5% medium (≈5% in the most recent months).

## A2. How it fits in

```
Employee submits a request (or edits it while it's Pending)
        │
        ▼
Backend
  1. saves it with status = Pending
  2. runs the RULE checks (finance_service: over the category limit, over the department budget)
     → saves them in expense.warnings
  3. returns the response to the employee immediately
        │
        └──► background task (after the response)
               4. loads the request + the employee's other requests for the same expense_date
               5. POST {AI_SERVICE_URL}/anomaly/score
               6. saves anomaly_score, risk_level, risk_justification on the expense
               7. re-scores the employee's other Pending requests for that day
        │
        ▼
Department manager opens the Pending queue → risk badge + AI reasons + rule warnings
```

Rules:
- **The ML service never connects to the database.** The backend sends what the model needs.
- **The frontend never calls the ML service.** It only reads what the backend returns.
- **Scoring never blocks the workflow.** If the ML service is down, the request is saved with empty AI
  columns and scored later (`python -m app.rescore_ai`, C6).
- **Rule warnings and AI results are two different things**:

| | Rule warnings | AI result |
|---|---|---|
| Comes from | Backend (`finance_service`) | ML service |
| Asks | "Is this **allowed**?" (limit, budget) | "Is this **normal for this person**?" |
| Stored in | `expense.warnings` | `expense.anomaly_score`, `risk_level`, `risk_justification` |
| Shown as | "Policy warnings" | "AI risk check" |

## A3. Who sees what

Roles come from `users.role`.

| Role | Sees | Never sees |
|---|---|---|
| `employee` | Their own requests and their status | Anything from the AI on their own requests |
| `manager` | Risk badge + AI reasons + rule warnings on **their department's** requests | The raw `anomaly_score` |
| `finance_admin` | Dashboard: requests by risk level, flagged share per department, top reasons — next to budgets | The raw `anomaly_score` |

- Department managers **don't submit requests** (recommended: the backend blocks it, C4), so no one ever
  sees the AI result on their own request.
- `finance_admin` doesn't review requests in the new flow — only the department manager does.

## A4. Ports

| Service | Port |
|---|---|
| Backend | 8000 |
| ML service | 8001 |
| Frontend (Vite) | 5173 |
| MySQL | 3306 |

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

Optional Docker (in your `docker-compose.yml`, under `services:`; adjust the path to the `ml/` folder):

```yaml
  ml:
    build: ../ml
    container_name: masroof-ml
    ports:
      - "8001:8001"
```

## B2. Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | `{"status": "ok", "model_version": "..."}` |
| POST | `/anomaly/score` | Score one request |
| POST | `/anomaly/score-batch` | Score up to 500 requests in one call (re-scoring, seed history) |
| GET | `/anomaly/categories` | The 6 category names the model accepts |
| GET | `/anomaly/reasons` | Every reason code with English + Arabic text |

Paths start with `/anomaly/` so other AI features (forecasting, receipt reading) can be added under their
own prefix later, behind the same `AI_SERVICE_URL`.

## B3. `POST /anomaly/score` — request

```json
{
  "expense_id": 347901,
  "requester_id": 2259,
  "department_id": 1,
  "category": "Office Supplies",
  "amount": "2500.00",
  "expense_date": "2026-06-25",
  "same_day_requests": [
    {"expense_id": 347900, "category": "Office Supplies", "amount": "2400.00"}
  ]
}
```

| Field | Type | From (ERD) | Notes |
|---|---|---|---|
| `expense_id` | int | `expense.id` | |
| `requester_id` | int | `expense.requester_id` | |
| `department_id` | int or null | `expense.department_id` | The snapshot at submit. Null allowed |
| `category` | string | `categories.name` (via `expense.category_id`) | **One of the 6 below, spelled exactly** |
| `amount` | decimal > 0 | `expense.amount` | SAR |
| `expense_date` | `YYYY-MM-DD` | `expense.expense_date` | |
| `same_day_requests` | list | query in C3 | The employee's **other** requests with the same `expense_date`, **any status**, **not including this one**. `[]` if none |

Rejected requests are included on purpose: someone who splits a request and gets one part rejected is
still splitting.

**Categories the model accepts** (must match `categories.name` exactly):

```
Food, Travel, Transportation, Office Supplies, IT & Telecom, Equipment & Maintenance
```

There is **no "Other" category**: the model is trained only on these 6. Any other value returns **422**.
**If a category is renamed or added, tell ML first** — the model has to be retrained for it.

## B4. `POST /anomaly/score` — response

```json
{
  "expense_id": 347901,
  "score": 0.8714902263,
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
| `score` | 0–1, higher = more unusual. **Not rounded.** For sorting only — **never shown to users** |
| `risk_level` | `low` / `medium` / `high` (always lowercase) |
| `is_flagged` | `true` when medium or high |
| `reasons` | English texts, 0–3, most important first. Empty when `low` |
| `reason_details` | The same reasons with `code`, `text_en`, `text_ar` |
| `model_version` | Which model produced this result |

## B5. `POST /anomaly/score-batch`

Request: `{"items": [ <same body as /anomaly/score>, ... ]}` (max 500)
Response: `{"results": [ <same response as /anomaly/score>, ... ]}` (same order)

## B6. Errors

| Status | When | What the backend does |
|---|---|---|
| 422 | Invalid body (unknown category, amount ≤ 0, more than 500 batch items) | A bug: log it, leave the AI columns empty |
| 5xx / timeout / connection refused | ML service down or busy | Log a warning, leave the AI columns empty, re-score later |

## B7. Reason codes

**The list is final after Step 8 (23 Nov): 13 codes.** The 10 from Step 6, plus 3 added after the first unseen test
(`duplicate_recent_request`, `unusual_amount_digits`, `returning_after_long_break`). The texts come from the API,
so the frontend shows whatever `reason_details` contains; no frontend change is needed when a code is added.
The three "amount" reasons come from one feature; which one is shown depends on what the amount was compared with
(the employee in this category → the employee overall → the department in this category, for new employees).

| Code | English | Arabic |
|---|---|---|
| `amount_high_for_employee` | Amount is much higher than this employee's usual requests | المبلغ أعلى بكثير من معدل طلبات هذا الموظف |
| `amount_high_for_employee_category` | Amount is much higher than this employee usually requests in this category | المبلغ أعلى بكثير مما يطلبه هذا الموظف عادةً في هذه الفئة |
| `amount_high_for_department` | Amount is much higher than usual for this department in this category | المبلغ أعلى بكثير من المعتاد في هذا القسم لهذه الفئة |
| `large_amount` | Very large amount | مبلغ كبير جداً |
| `unusual_category_for_employee` | This employee rarely submits requests in this category | نادراً ما يقدّم هذا الموظف طلبات في هذه الفئة |
| `weekend_expense` | Expense date falls on a weekend (Friday–Saturday) | تاريخ المصروف في عطلة نهاية الأسبوع (الجمعة–السبت) |
| `round_amount` | Round amount (e.g. 500 or 1,000) | المبلغ رقم مقرّب (مثل 500 أو 1,000) |
| `duplicate_request` | Same amount in the same category requested more than once for the same day | نفس المبلغ في نفس الفئة طُلب أكثر من مرة لنفس اليوم |
| `possible_split_request` | Several requests in the same category for the same day (possible split to stay under a limit) | عدة طلبات في نفس الفئة لنفس اليوم (احتمال تجزئة الطلب للبقاء تحت الحد المسموح) |
| `many_requests_same_day` | Unusually many requests by this employee for the same day | عدد طلبات غير معتاد من هذا الموظف لنفس اليوم |
| `duplicate_recent_request` | Same amount and category as a request a few days earlier (possible receipt used twice) | نفس المبلغ والفئة لطلب قبل أيام قليلة (احتمال استخدام الإيصال مرتين) |
| `unusual_amount_digits` | The amount looks made up (repeated or sequential digits, e.g. 1,111.11 or 1,234.56) | المبلغ يبدو غير حقيقي (أرقام مكررة أو متسلسلة، مثل 1,111.11 أو 1,234.56) |
| `returning_after_long_break` | First request after a long break (90+ days without any request) | أول طلب بعد انقطاع طويل (أكثر من 90 يومًا دون أي طلب) |

## B8. Where each response field is saved (EXPENSE table)

| ML response | EXPENSE column | Type |
|---|---|---|
| `score` | `anomaly_score` | float, nullable |
| `risk_level` | `risk_level` | string `low` / `medium` / `high`, nullable |
| `reason_details` | `risk_justification` | JSON (list of `{code, text_en, text_ar}`), nullable |
| `is_flagged`, `reasons`, `model_version`, `expense_id` | not stored | `is_flagged` = risk is medium or high; `reasons` is the same as `reason_details[].text_en` |

All three columns are **null until the request has been scored**.

---

# Part C — Backend integration

This part is written **against the ERD**: SQLAlchemy models named `Expense`, `Category`, `User`,
`Department`, a `SessionLocal` session factory, and a settings object with `ai_service_url`.
**Rename to match your code** — the logic stays the same.
The first real code on `backend/expense` (18 Nov, still in memory, no MySQL yet) is checked in **C10**:
what already matches and the 4 changes the AI part needs.

The code below was tested against the running stub service on a copy of the ERD tables (SQLite).
It only needs `httpx` (`pip install httpx`).

## C1. EXPENSE columns the AI needs (the agreed ERD changes)

```python
from sqlalchemy import JSON, Float, Index, String
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional

class Expense(Base):
    __tablename__ = "expense"
    # ... id, requester_id, department_id, category_id, amount, description,
    #     expense_date, status, reviewed_by, reviewed_at, manager_note,
    #     receipt_path, warnings, created_at, updated_at ...

    anomaly_score: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True, comment="ML score 0-1, higher = more unusual. Sorting only, never shown.")
    risk_level: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True, index=True, comment="low / medium / high from the ML service. Null = not scored yet.")
    risk_justification: Mapped[Optional[list]] = mapped_column(
        JSON, nullable=True, comment="ML reasons: list of {code, text_en, text_ar}.")

    __table_args__ = (Index("ix_expense_requester_date", "requester_id", "expense_date"),)
```

Also from the agreed changes: `reviewed_at`, `manager_note`, `receipt_path` nullable; `users.role` (enum
`employee` / `manager` / `finance_admin`); the 6 category names seeded exactly.

## C2. Calling the ML service — `app/services/ai_client.py`

```python
"""Talks to the ML service. Returns None when AI_SERVICE_URL isn't set."""
import httpx

from app.core.config import get_settings


def _payload(expense, same_day) -> dict:
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


def score_one(expense, same_day) -> dict | None:
    url = get_settings().ai_service_url
    if not url:
        return None
    r = httpx.post(f"{url.rstrip('/')}/anomaly/score", json=_payload(expense, same_day), timeout=3.0)
    r.raise_for_status()
    return r.json()


def score_many(pairs) -> list[dict] | None:
    """pairs = [(expense, same_day), ...], at most 500."""
    url = get_settings().ai_service_url
    if not url:
        return None
    body = {"items": [_payload(e, s) for e, s in pairs]}
    r = httpx.post(f"{url.rstrip('/')}/anomaly/score-batch", json=body, timeout=30.0)
    r.raise_for_status()
    return r.json()["results"]
```

## C3. Scoring and saving — `app/services/anomaly_service.py`

```python
"""Runs anomaly scoring and stores the result on the expense. Never raises into the workflow."""
import logging

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.expense import Expense
from app.services import ai_client

log = logging.getLogger(__name__)


def same_day_requests(db: Session, expense: Expense) -> list[Expense]:
    """The employee's OTHER requests with the same expense_date, any status."""
    return (
        db.query(Expense)
        .filter(
            Expense.requester_id == expense.requester_id,
            Expense.expense_date == expense.expense_date,
            Expense.id != expense.id,
        )
        .all()
    )


def save_result(expense: Expense, result: dict) -> None:
    expense.anomaly_score = result["score"]
    expense.risk_level = result["risk_level"]
    expense.risk_justification = result["reason_details"]


def score_expense_in_background(expense_id: int) -> None:
    """Run as a FastAPI BackgroundTask AFTER the expense is committed.

    Also re-scores the employee's other Pending requests for the same day: when a third
    split request arrives, the first two become suspicious too.
    """
    db = SessionLocal()
    try:
        expense = db.get(Expense, expense_id)
        if expense is None:
            return
        siblings = same_day_requests(db, expense)
        result = ai_client.score_one(expense, siblings)
        if result is None:          # AI_SERVICE_URL not set
            return
        save_result(expense, result)
        for other in siblings:
            if other.status == "Pending":
                others_same_day = [e for e in siblings if e.id != other.id] + [expense]
                save_result(other, ai_client.score_one(other, others_same_day))
        db.commit()
    except Exception as exc:  # ML down, timeout, bad response: never break the workflow
        db.rollback()
        log.warning("Anomaly scoring failed for expense %s: %s", expense_id, exc)
    finally:
        db.close()
```

## C4. Where to call it — the expense routes

```python
from fastapi import BackgroundTasks, HTTPException
from app.services.anomaly_service import score_expense_in_background


@router.post("/expenses")
def create_expense(body: ExpenseCreate, background_tasks: BackgroundTasks,
                   db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role == "manager":
        raise HTTPException(403, "Department managers can't submit expense requests.")
    expense = ...                      # save with status="Pending" + rule warnings (C5), commit
    background_tasks.add_task(score_expense_in_background, expense.id)
    return expense


@router.put("/expenses/{expense_id}")
def update_expense(expense_id: int, body: ExpenseUpdate, background_tasks: BackgroundTasks,
                   db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    expense = ...                      # only the requester, only while status == "Pending"; commit
    background_tasks.add_task(score_expense_in_background, expense.id)
    return expense
```

- Background tasks run **after the response is sent**, so the employee never waits for the model.
- They open their own session (`SessionLocal()`), because the request's session is closed by then.
- No scoring is needed when the manager approves or rejects: the request itself didn't change.

## C5. Rule warnings (`backend/finance`) — keep them separate

`finance_service.limit_warning` and `budget_warning` already return a text or `None`.
Store them in `expense.warnings` as a list of strings, e.g.:

```python
warnings = [w for w in (
    limit_warning(body.amount, limit.max_amount if limit else None),
    budget_warning(spent_this_month, body.amount, budget.amount if budget else None),
) if w]
expense.warnings = warnings          # [] when no rule was broken (the ERD's warnings column isn't nullable)
```

- `warnings` = **rules**. `risk_justification` = **AI**. Never mix them: the frontend shows them as two sections.
- Optional extra rule (catches split requests by rule): *the total of this employee's same-category
  requests for the same day is over the category limit.* It uses the same query as C3.

## C6. Re-scoring — `app/rescore_ai.py`

For requests saved while the ML service was down, for the seed history, and after a new model version.

```python
"""Score expenses with the ML service.

    python -m app.rescore_ai          # only expenses with no AI result yet
    python -m app.rescore_ai --all    # every expense (e.g. after a new model version)
"""
import sys
from collections import defaultdict

from app.core.database import SessionLocal
from app.models.expense import Expense
from app.services import ai_client
from app.services.anomaly_service import save_result

BATCH_SIZE = 500


def run(rescore_all: bool) -> None:
    db = SessionLocal()
    try:
        everything = db.query(Expense).all()
        by_day = defaultdict(list)
        for e in everything:
            by_day[(e.requester_id, e.expense_date)].append(e)

        targets = everything if rescore_all else [e for e in everything if e.risk_level is None]
        for start in range(0, len(targets), BATCH_SIZE):
            chunk = targets[start:start + BATCH_SIZE]
            pairs = [(e, [o for o in by_day[(e.requester_id, e.expense_date)] if o.id != e.id]) for e in chunk]
            results = ai_client.score_many(pairs)
            if results is None:
                print("AI_SERVICE_URL is not set.")
                return
            for expense, result in zip(chunk, results):
                save_result(expense, result)
            db.commit()
            print(f"Scored {start + len(chunk)}/{len(targets)}")
    finally:
        db.close()


if __name__ == "__main__":
    run(rescore_all="--all" in sys.argv)
```

## C7. What the API returns to each role

Add the AI fields to the expense response **only for the manager of the request's department**.
**Never return `anomaly_score`.**

```python
from typing import Literal
from pydantic import BaseModel, Field


class ReasonDetail(BaseModel):
    code: str = Field(description="Stable reason code, e.g. possible_split_request.")
    text_en: str = Field(description="English text.")
    text_ar: str = Field(description="Arabic text.")


class ExpenseAIView(BaseModel):
    """What the department manager sees. The raw score is never included."""
    risk_level: Literal["low", "medium", "high"] = Field(description="Badge to show.")
    reasons: list[ReasonDetail] = Field(description="AI reasons, most important first (0-3).")


def ai_view_for(user, expense, department) -> ExpenseAIView | None:
    """department = the Department row of expense.department_id."""
    if expense.risk_level is None:
        return None                                   # not scored yet
    if user.id == expense.requester_id:
        return None                                   # never on your own request
    if user.role == "manager" and department is not None and department.manager_id == user.id:
        return ExpenseAIView(risk_level=expense.risk_level,
                             reasons=expense.risk_justification or [])
    return None
```

In the expense response schema add `ai: ExpenseAIView | None = None` and keep `warnings` as its own field.
Employees always get `ai = null`.

## C8. The manager's Pending queue — riskiest first

```python
from sqlalchemy import case

risk_order = case({"high": 0, "medium": 1, "low": 2}, value=Expense.risk_level, else_=3)

q = (db.query(Expense)
       .filter(Expense.department_id == my_department.id, Expense.status == "Pending")
       .order_by(risk_order, Expense.created_at))
# optional filter: ?risk_level=high  →  q = q.filter(Expense.risk_level == risk_level)
```

Order: high → medium → low → not scored yet, then oldest first.

## C9. Finance dashboard — AI summary

```python
class RiskCounts(BaseModel):
    high: int
    medium: int
    low: int
    not_scored: int


class DepartmentRisk(BaseModel):
    department_id: int
    department_name: str
    flagged: int = Field(description="Requests with risk medium or high.")
    total: int = Field(description="All scored requests.")
    flagged_percent: float = Field(description="flagged / total x 100.")


class ReasonCount(BaseModel):
    code: str
    text_en: str
    text_ar: str
    count: int = Field(description="How many flagged requests have this reason.")


class AnomalySummary(BaseModel):
    counts: RiskCounts
    by_department: list[DepartmentRisk] = Field(description="Highest flagged_percent first.")
    top_reasons: list[ReasonCount] = Field(description="Top 5 among flagged requests.")
```

`top_reasons` = count `risk_justification[*].code` over requests with `risk_level` in (`medium`, `high`).
Same period filter as the rest of the finance dashboard (e.g. this month).

## C10. Fitting this into `backend/expense` (checked 18 Nov, commit `f7425d1`)

Omar's first version: `routes/expenses.py`, `schemas/expenses.py`, `services/decision_engine.py`,
`services/expense_service.py`, `test_decision_engine.py`. Data is still in memory (no MySQL, login or ML call yet).

**Already matches ✅:** statuses `Pending` / `Approved` / `Rejected`; approve/reject only while Pending;
amounts in SAR; `department_id` snapshot from the employee; rule warnings stored as a list of strings,
separate from the AI result (C5); "AI not available" → `None`, no error.

**4 changes for the AI part:**

| # | Where | Now | Change | Why |
|---|---|---|---|---|
| 1 | `decision_engine.evaluate_expense` | Reads `anomaly_result.get("anomaly_score")` | Make it **rules only** (code below). The AI result is saved by `save_result` (C3): `score` → `anomaly_score` | The ML service returns **`score`**, so `anomaly_score` is always `None` (tested with the stub) |
| 2 | Same | Keeps only `risk_level` + the score | `reason_details` → `risk_justification` (C3 `save_result`) | Without it the manager sees a badge with **no reasons** |
| 3 | `expense_service.prepare_expense` + `create_expense` | AI result is an input **before** saving | Save first (AI columns `None`), then `background_tasks.add_task(score_expense_in_background, expense.id)` (C3, C4) | The ML request needs `expense_id` and `same_day_requests`; scoring after saving never slows the employee down; same-day Pending requests get re-scored (splits) |
| 4 | `schemas.ExpenseCreate` vs `expense_service` | Schema has `category: str`, service reads `expense_data["category_id"]` → `KeyError` | Pick one (suggested: `category_id` in the request). The ML call sends the **name** (`expense.category.name`, C2) | The ML service accepts only the 6 names |

`decision_engine.py`, rules only (tested with `finance_service` from `backend/finance`: the 4 rule tests pass):

```python
from decimal import Decimal

from app.services.finance_service import limit_warning, budget_warning


def evaluate_expense(amount: Decimal, category_limit: Decimal | None,
                     monthly_spent: Decimal, monthly_budget: Decimal | None) -> dict:
    """Rule warnings only. The AI result is added later, after the expense is saved (C3)."""
    warnings = [w for w in (
        limit_warning(amount, category_limit),
        budget_warning(monthly_spent, amount, monthly_budget),
    ) if w]
    return {"warnings": warnings}
```

**Test 4** (`"High"`, `-0.15`) doesn't match the ML response: `risk_level` is lowercase and `score` is 0–1.
Remove it from the decision-engine tests; test `save_result` with a stub-shaped result instead:

```python
result = {"score": 0.9, "risk_level": "high", "reason_details": [
    {"code": "large_amount", "text_en": "Very large amount", "text_ar": "مبلغ كبير جداً"}]}
save_result(expense, result)
assert expense.anomaly_score == 0.9 and expense.risk_level == "high"
assert expense.risk_justification[0]["code"] == "large_amount"
```

Not AI, but noticed (ERD): reject saves `reason`, the ERD column is `manager_note`; `reviewed_by` / `reviewed_at`
aren't set yet; the approve/reject section is titled "Finance Admin", but the department manager approves.
`decision_engine` imports `finance_service`, which is on `backend/finance` → merge that branch first
(on `backend/expense` alone the test fails with `ModuleNotFoundError`).

---

# Part D — Frontend

## D1. Where the data comes from

From the backend only. On each expense:

| Field | What it is | When it's null |
|---|---|---|
| `ai.risk_level` | `low` / `medium` / `high` | Viewer isn't the department manager, or not scored yet |
| `ai.reasons` | List of `{code, text_en, text_ar}` | Same |
| `warnings` | List of rule texts (over limit, over budget) | Never null: an empty list `[]` when no rule was broken |

**Never call the ML service directly, and never show `anomaly_score`** (the backend doesn't send it).

## D2. Risk badge

| `ai.risk_level` | English | Arabic | Color |
|---|---|---|---|
| `high` | High risk | خطر مرتفع | Red |
| `medium` | Medium risk | خطر متوسط | Amber |
| `low` | Low risk | خطر منخفض | Green (or subtle grey) |
| `ai` is `null` (manager view) | Not analyzed yet | لم يُحلَّل بعد | Grey |

- Always show the text label, not only the color.
- **No percentage, no score.** "Anomaly score: 87%" reads like "87% chance of fraud", which is wrong:
  the score only ranks requests from most to least unusual.

## D3. Two sections: AI risk check vs policy warnings

On the manager's request detail, show **two separate sections**:

1. **AI risk check** — the badge (D2) + `ai.reasons` (`text_ar` in the Arabic UI, `text_en` in the English UI), max 3, in order.
   `low` has no reasons: show only the badge.
2. **Policy warnings** — `warnings` (e.g. "Amount 3,500 SAR is above the 3,000 SAR limit for this category").

They answer different questions ("is this normal for this person?" vs "is this allowed?"), so they must not be merged into one list.

## D4. Screens per role

| Role | Screen | What to show |
|---|---|---|
| `employee` | My requests, submit / edit request | Status only. **No badge, no reasons, no score** |
| `manager` | Pending queue (their department) | Risk badge on each row. Already sorted riskiest first. Optional filter chips: All / High / Medium |
| `manager` | Request detail | D3: AI risk check + policy warnings, then Approve / Reject (with `manager_note`) |
| `finance_admin` | Dashboard | Requests by risk (bar), flagged % per department (bar), top reasons (list) — next to budgets |
| `finance_admin` | Budgets, limits | No AI |

## D5. Categories and statuses (must match the backend)

Categories — exact names, with Arabic labels:

| `name` | `name_ar` |
|---|---|
| Food | طعام وضيافة |
| Travel | سفر |
| Transportation | مواصلات |
| Office Supplies | مستلزمات مكتبية |
| IT & Telecom | تقنية المعلومات والاتصالات |
| Equipment & Maintenance | معدات وصيانة |

Statuses (new ERD, **one approval step** by the department manager):

| `status` | English | Arabic |
|---|---|---|
| `Pending` | Pending | قيد المراجعة |
| `Approved` | Approved | مقبول |
| `Rejected` | Rejected | مرفوض |

There is no `pending_finance` and no `needs_changes` anymore.

## D6. Fixed texts

| Where | English | Arabic |
|---|---|---|
| AI section title | AI risk check | فحص المخاطر بالذكاء الاصطناعي |
| Under the AI reasons | This is an automatic hint to help your review. It is not a decision. | هذا تنبيه آلي للمساعدة في المراجعة، وليس قراراً. |
| Rules section title | Policy warnings | تنبيهات السياسة |
| Not analyzed | Not analyzed yet | لم يُحلَّل بعد |
| Dashboard section title | Unusual requests | الطلبات غير المعتادة |

## D7. Mock data

High (with a rule warning too):

```json
{
  "id": 347901,
  "category": {"id": 4, "name": "Office Supplies"},
  "amount": "2500.00",
  "status": "Pending",
  "warnings": [],
  "ai": {
    "risk_level": "high",
    "reasons": [
      {"code": "possible_split_request",
       "text_en": "Several requests in the same category for the same day (possible split to stay under a limit)",
       "text_ar": "عدة طلبات في نفس الفئة لنفس اليوم (احتمال تجزئة الطلب للبقاء تحت الحد المسموح)"},
      {"code": "amount_high_for_employee_category",
       "text_en": "Amount is much higher than this employee usually requests in this category",
       "text_ar": "المبلغ أعلى بكثير مما يطلبه هذا الموظف عادةً في هذه الفئة"}
    ]
  }
}
```

Medium, over the limit:

```json
{
  "id": 347902,
  "category": {"id": 4, "name": "Office Supplies"},
  "amount": "3500.00",
  "status": "Pending",
  "warnings": ["Amount 3500.00 SAR is above the 3000.00 SAR limit for this category."],
  "ai": {
    "risk_level": "medium",
    "reasons": [
      {"code": "weekend_expense",
       "text_en": "Expense date falls on a weekend (Friday–Saturday)",
       "text_ar": "تاريخ المصروف في عطلة نهاية الأسبوع (الجمعة–السبت)"}
    ]
  }
}
```

Low: `"ai": {"risk_level": "low", "reasons": []}` · Not analyzed / employee view: `"ai": null`

For realistic requests to design with, use `ml/docs/samples/sample_requests.csv` (50 rows, from the demo data).

---

# Part E — Seed data (backend; files from ML)

## E1. Status

The ERD is final (OK'd 18 Nov; final version checked 18 Nov evening), so the format below is fixed. **ML exports the files when the team says
go** — after deciding how much history goes in (E7). Don't import the Step 4 training files
(`requests.csv`, `users.csv`, `departments.csv`): they have extra ML-only columns.

## E2. Files and columns

All CSV, UTF-8. **Every `id` must be kept** (E4).

`categories.csv`

| Column | Example |
|---|---|
| `id` | 4 |
| `name` | Office Supplies |

Ids: 1 Food · 2 Travel · 3 Transportation · 4 Office Supplies · 5 IT & Telecom · 6 Equipment & Maintenance.

`departments.csv`

| Column | Example | Notes |
|---|---|---|
| `id` | 1 | |
| `name` | Operations | Unique |
| `manager_id` | 101 | A `users.id` |

`users.csv`

| Column | Example | Notes |
|---|---|---|
| `id` | 2259 | |
| `username` | yazeed.almuqrin.2259 | Unique |
| `email` | yazeed.almuqrin.2259@example.com | Unique; `example.com` can't reach a real person |
| `full_name` | Yazeed Al-Muqrin | Arabic name in English letters |
| `role` | employee | `employee`, `manager` or `finance_admin` |
| `department_id` | 1 | Empty for finance admins |

No password in the file: the seed script sets one demo password (E4).

`expense_limits.csv`

| Column | Example |
|---|---|
| `id` | 4 |
| `category_id` | 4 |
| `max_amount` | 3000.00 |

`budget.csv`

| Column | Example |
|---|---|
| `id` | 1 |
| `department_id` | 1 |
| `year` | 2026 |
| `month` | 6 |
| `amount` | 6200000.00 |

`expenses.csv` (history)

| Column | Example | Notes |
|---|---|---|
| `id` | 346990 | |
| `requester_id` | 2259 | |
| `department_id` | 1 | |
| `category_id` | 5 | |
| `amount` | 251.25 | SAR |
| `description` | Computer accessories | Generated |
| `expense_date` | 2026-06-25 | |
| `status` | Approved | History is already decided |
| `reviewed_by` | 101 | The department's manager |
| `reviewed_at` | 2026-06-26 10:30:00 | |
| `manager_note` | *(empty)* | |
| `receipt_path` | *(empty)* | |
| `warnings` | `[]` | Empty list (history has no rule warnings) |
| `created_at` | 2026-06-25 16:02:00 | |
| `updated_at` | 2026-06-26 10:30:00 | |

`anomaly_score`, `risk_level`, `risk_justification` are left **empty**: run `python -m app.rescore_ai`
after the import (E4).

## E3. ID ranges

Please don't use these in your own test data.

| Range | Who / what |
|---|---|
| 1–6 | Categories |
| 1–20 | Departments |
| 101–120 | Department managers (no requests — managers don't submit) |
| 201–202 | Finance admins |
| 1001–5577 | Employees (**13 ids are not in the seed**, see below) |
| 100001–347838 | Expenses (history) |
| 347839 and up | New requests created in the demo |

**Not in the seed (Step 6):** 13 employees who usually send 5 or more requests a day (bulk travel / equipment
buyers on shared cards, not personal expenses): **1194, 1237, 1752, 1759, 2712, 4097, 4438, 4481, 4851, 5060,
5112, 5438, 5571**. The model is trained without them, so ML leaves them (and their expenses) out of `users.csv`
and `expenses.csv`. Their ids are simply unused — don't reuse them for test users.

## E4. Import rules

1. **Keep the ids from the files.** The model remembers employees and departments by id: if
   AUTO_INCREMENT assigns new ones, employee 2259 in the database is a different person than employee
   2259 in the model. (Inserting explicit ids is fine in MySQL; the counter moves past them.)
2. Order: `categories` → `departments` **without** `manager_id` → `users` → set `departments.manager_id`
   → `expense_limits` → `budget` → `expenses`.
3. **One demo password for all seeded users** (e.g. `DEMO_USER_PASSWORD` in `.env`): hash it **once** and
   reuse the hash. Hashing thousands of passwords one by one is slow.
4. Make the seed idempotent: skip rows whose id already exists.
5. Afterwards run `python -m app.rescore_ai` so the history has AI results for the dashboard.

## E5. Category limits (`expense_limits`)

| Category | `max_amount` (SAR) | Demo requests over it |
|---|---|---|
| Food | 2,000 | 4.1% |
| Travel | 10,000 | 0.8% |
| Transportation | 5,000 | 5.3% |
| Office Supplies | 3,000 | 4.8% |
| IT & Telecom | 7,500 | 4.7% |
| Equipment & Maintenance | 7,500 | 5.1% |

Set near the 95th percentile of real amounts, so ~5% of requests go over — rare enough that a warning
means something. **A limit applies to one request at a time** (not a daily or monthly total).

## E6. Budget (proposal — team decides)

The demo data has no budgets. Proposal: for each department and month, **the department's average
monthly spending × 1.1**, so most months stay under budget and a few go over. ML generates `budget.csv`
from the data once the team agrees (or uses numbers the team gives).

## E7. How much history

**Recommendation:** a few departments and the last ~6 months. The dashboard still looks full and the
import is fast. The model doesn't need the history in MySQL — it keeps its own statistics.
Team decides; ML exports exactly that.

---

# Part F — Testing, changes, mentor feedback, open questions

## F1. Testing with the stub

The stub returns **fake** scores, roughly 80% low / 15% medium / 5% high.

- The **same `expense_id` always gets the same result** (repeatable tests).
- **`amount` over 10,000** → always `high` with `large_amount`.
- **2 or more same-category requests in `same_day_requests`** → always `high` with `possible_split_request`.
- A category outside the 6 → **422** (name mismatches show up on the first test).
- To test "Not analyzed yet": stop the ML service, submit a request, check the AI columns are empty,
  start it again, run `python -m app.rescore_ai`.

## F2. What changes when the real model arrives (Step 9)

- Only the inside of `ml/src/predict.py` changes. **Endpoints, request and response stay the same.**
- `model_version` changes from `stub-0.2` to `iforest-0.2`. Run `python -m app.rescore_ai` for anything not scored yet.
- **Risk levels** (set from review capacity, MF4): `high` = the model's most unusual 1% (careful check);
  `medium` = the model's next 0.5% **or** any rule (quick look). On the demo history ≈1% high, ≈3.5% medium.
- **A split now gives `medium`** (with `possible_split_request`), not `high`: `high` is kept for the model's top 1%.
  The stub still forces `high` for 2+ same-category requests (F1): that's a testing hook only.
- 13 reason codes (B7). Up to 3 per request, rules first, then the model's strongest reasons.
- The new time rules (receipt reused within 7 days, 90+ days without requests) need each employee's recent requests:
  **the ML service keeps them itself** (it sees every request it scores), so the backend sends nothing new.

## F3. Mentor feedback that touches this contract

| # | What | Effect here |
|---|---|---|
| MF1 | Features use only **earlier** requests; written rule for **new employees** | None on the API. A brand-new employee is compared with their department and category until they have history |
| MF3 | Test on **unseen** planted anomalies; unlabeled data isn't "confirmed normal" | None on the API. Evaluation numbers in Step 8 |
| MF4 | Risk cut-offs from **review capacity**; compare the model with **simple policy rules** | Cut-offs (F2). The rules in C5 are part of that comparison |
| MF5 | Optional: receipt reading with a multimodal model, human confirmation, redaction | Not in this service yet (F4) |

## F4. Open questions

| Question | Who | Status |
|---|---|---|
| How many flagged requests can a manager realistically review per week? (MF4) | Team | Proposed: high = top 1% (≈11 careful checks/week for the biggest department, < 1 for a typical one); ≈5% flagged in total with the rules. Used as the default; waiting for OK |
| Seed history pre-scored by ML (AI columns filled in `expenses.csv`) instead of `rescore_ai` on old rows (E2/E4) | ML → backend | Proposed by ML, deciding |
| Backend sends the current `category_limit` with each score request (limits are editable in the app) (B3) | ML → backend | Proposed by ML, deciding |
| How much history goes into the demo database? (E7) | Team / Backend | Open |
| Block or warn when a request is over its category limit? Add the same-day total rule? (C5) | Backend + team | Open |
| Budget amounts: the ×1.1 proposal or the team's numbers? (E6) | Team | Open |
| Who builds receipt reading (`/receipt/...`)? | Team | Open |
| Does forecasting join this service (`/forecast/...`) or get its own URL? | Forecasting + backend | Open |
| Is the index on `expense (requester_id, expense_date)` in the model? (C1; ERD diagrams don't show indexes) | Backend | To confirm |
| Align Part C with the real backend code | ML | 🟡 First version checked in C10 (18 Nov). Check again when MySQL + the ML call are added |

## F5. Changing this contract

Any change (a field, a category name, an endpoint) goes through ML first. ML updates the stub and this
file, then tells both teams. The version at the top goes up with every change.

| Version | Date | Changes |
|---|---|---|
| v0.4.4 | 23 Nov | Step 8 results: 13 reason codes (+3: `duplicate_recent_request`, `unusual_amount_digits`, `returning_after_long_break`) (B7); real risk levels + split = medium (A1, F2); open ML proposals in F4 |
| v0.4.3 | 18 Nov | Final ERD check (all agreed changes in): `users.csv` without `is_active` (not in the ERD); `warnings` saved as `[]` instead of null (C5, D1, E2) |
| v0.4.2 | 18 Nov | Step 6 results: the 10 reason codes are final (B7, F2); `amount_high_for_department` text → "…for this department in this category" (used for new employees); A1 wording; 13 bulk buyers left out of the seed (E3) |
| v0.4.1 | 18 Nov | C10: checked Omar's first `backend/expense` code — what matches + 4 changes for the AI part (score field name, reasons, score after saving, category name vs id) |
| v0.4 | 18 Nov | Rewritten for the new ERD: one approval step, `role` enum, AI columns `anomaly_score` / `risk_level` / `risk_justification`, rule warnings separate from AI reasons, ERD-based Part C, seed format with `categories`, `expense_limits`, `budget`, Step 4 ID ranges and limits, categories + statuses with Arabic labels, mentor feedback |
| v0.3 | 15 Nov | Full integration for the `api/` skeleton (reverted the same day) |
| v0.2 | 15 Nov | HTTP service instead of a Python import; requests instead of card transactions |
| v0.1 | 14 Nov | First draft (card-transaction design) |
