# Masroof — Changes needed for the AI model

*From: Jassar (ML) · 16 Nov 2026 · Based on the latest ERD*

**✅ Status (18 Nov): the backend confirmed OK on all the ERD changes below.** Omar's first code is on `backend/expense` (18 Nov) → checked in **"Repo check — 18 Nov (afternoon)"** at the end: 4 changes for the AI part.

These changes let the backend store and show the AI model's results correctly.
Each one has a reason, so you can push back if something doesn't fit.

---

## Backend / database

### 1. Rename `users.role_id` → `role`
The column is now an enum (`employee`, `manager`, `finance_admin`), not a link to another table.
In database naming, `_id` means "points to a row in another table", so `role_id` makes people
look for a ROLES table that doesn't exist.

### 2. Add `expense.risk_level` — `low` / `medium` / `high`, nullable
The badge, the "riskiest first" sorting and the "show only High" filter need a ready label.
With only `anomaly_score` (a number like 0.87), each team would have to decide where "High" starts.
That cut-off belongs to the model: it's set from the data and changes when the model improves.
Use **lowercase** values — the ML service returns lowercase, and "High" vs "high" causes filter bugs.

### 3. Fix `risk_justificaition` → `risk_justification`, type **JSON**
- **Name:** the typo would end up in the database, the backend models and the frontend code.
- **Type:** the model returns up to 3 reasons, each in English and Arabic. One string can't hold that.

Example value:

```json
[
  {"code": "possible_split_request",
   "text_en": "Several requests in the same category for the same day (possible split to stay under a limit)",
   "text_ar": "عدة طلبات في نفس الفئة لنفس اليوم (احتمال تجزئة الطلب للبقاء تحت الحد المسموح)"}
]
```

### 4. Make these columns nullable

| Column | Why it's empty at first |
|---|---|
| `anomaly_score`, `risk_level`, `risk_justification` | Not scored yet (ML service down, or scoring still running) |
| `reviewed_at`, `manager_note` | Not reviewed yet |
| `receipt_path` | No receipt uploaded yet |

If they're NOT NULL, the database rejects every new request.

### 5. Add an index on `expense (requester_id, expense_date)`
For every new request, the backend fetches "this employee's other requests on the same day" so the
model can detect split requests. Without the index, that query scans the whole table.

### 6. Seed exactly these 6 categories
```
Food, Travel, Transportation, Office Supplies, IT & Telecom, Equipment & Maintenance
```
Spelled exactly like this. The ML service rejects any other name (that's on purpose, so mismatches show up immediately).
If you want to rename or add a category, tell ML first — the model has to be retrained for it.

### 7. Block department managers from submitting expenses (recommended)
A manager's request would be reviewed by... themselves. If it can't happen by design, make the
backend reject it, so a request never sits in "Pending" forever.

### Already fixed ✅
- `requires_review` removed — it repeated what `status` / `reviewed_by` / `reviewed_at` already say.
- Role stored on USERS (no foreign key to a missing ROLES table).

---

## How the ML response maps to the columns

| ML service returns | Save in EXPENSE |
|---|---|
| `score` | `anomaly_score` |
| `risk_level` | `risk_level` |
| `reason_details` | `risk_justification` (JSON) |
| `is_flagged`, `model_version` | Not stored (`is_flagged` = risk is medium or high) |

---

## Who sees the AI result

| Role | Sees |
|---|---|
| **employee** | Nothing about the AI on their own requests |
| **manager** | Risk badge + reasons on their department's requests (never the raw score) |
| **finance_admin** | Dashboard: flagged share per department, top reasons — next to budgets |

---

## How the backend talks to the model

- ML runs as a small FastAPI service on **port 8001**. Set `AI_SERVICE_URL=http://localhost:8001`.
- `POST /anomaly/score` for one request; `POST /anomaly/score-batch` for up to 500.
- The ML service **never connects to the database** — the backend sends the data.
- Score in a **background task** after a request is created or edited, so the employee never waits.
- If the ML service is down, **save the request anyway** with no AI result, and score it later.
- Full details: `ml/docs/ml_contract.md` (**v0.4.1**, matches this ERD) on the `ml/stub-service` branch.
  Backend → Parts B, C, E · Frontend → Part D. Part C is reference code written against the ERD; **C10** checks it against Omar's first `backend/expense` code.

---

## Seed data (from ML, after the ERD is final)

ML will provide CSV files: `departments`, `users`, `expenses` (history), `expense_limits`, `budget`.
**Insert them with the ids from the files** — the model remembers employees and departments by id.
If MySQL assigns new ids, employee 412 in the database becomes a different person than employee 412 in the model.

---

## From the mentor feedback (16 Nov) — what ML needs from the team

| # | What we need | From whom | Why |
|---|---|---|---|
| MF4 | **How many flagged requests can a manager realistically review** (e.g. per week)? | Team / product | The mentors want the risk cut-offs set from review capacity, not picked arbitrarily. This number decides how many requests get flagged. |
| MF3 | **One teammate to invent a few "unseen" suspicious patterns** and plant them in the data **without telling Jassar** what they are | Any teammate | The mentors want proof the model catches patterns it wasn't designed for — that's only a fair test if Jassar doesn't know them. |
| MF2 | Forecasting: define the model + horizon, compare with a **last-week baseline** using **rolling validation**, and set an **MAE target** in SAR | Forecasting teammate | ✅ Done in `ml/forecasting` (Linear Regression, next 4 weeks, last-week baseline, rolling validation, MAE in SAR). |
| MF5 | Decide whether to add **receipt reading with a multimodal model** — if yes: the employee confirms the extracted fields, and sensitive info is removed before sending to any outside API | Team | Optional GenAI idea from the mentors. Not assigned to anyone yet. |

---

## Repo check — 18 Nov

### Frontend (`frontend/employee-manager`)

| # | What's in the code now | What was agreed | Why it matters |
|---|---|---|---|
| 1 | Categories: *Meals & hospitality, Office supplies, Travel & transport, Software & subscriptions, Training & events* | **Food, Travel, Transportation, Office Supplies, IT & Telecom, Equipment & Maintenance** (exact spelling) | The AI service rejects any other category name, and the model is trained on these 6 only |
| 2 | Statuses `pending_manager` → `pending_finance` → `approved`, plus `needs_changes` | New ERD: **one step** by the department manager — `Pending` / `Approved` / `Rejected` | The old flow came from the reverted `api/` skeleton |
| 3 | The AI box shows **"Anomaly score: 87%"** | **Never show the raw score** — only the risk badge (low / medium / high) + reasons | The score isn't a probability; "87%" reads like "87% chance of fraud", which is wrong |
| 4 | The AI box lists `ai_analysis.warnings` as the AI's reasons | `warnings` = **rule** warnings (over limit, over budget). AI reasons = `risk_justification` (JSON: `code`, `text_en`, `text_ar`) | Two different things: a rule broken vs. "unusual for this person". Show them as two sections |

The mock `risk_level: 'High'` (capitalized) is handled with `toLowerCase()` — fine, but the backend will send lowercase.

**Arabic names for the 6 categories** (your mock categories have `name_ar`, so here are the agreed ones):

| `name` (exact) | `name_ar` |
|---|---|
| Food | طعام وضيافة |
| Travel | سفر |
| Transportation | مواصلات |
| Office Supplies | مستلزمات مكتبية |
| IT & Telecom | تقنية المعلومات والاتصالات |
| Equipment & Maintenance | معدات وصيانة |

### Forecasting (`ml/forecasting`)

- **`ml/data/forecast_data.csv` (8.8 MB) and `departments.csv` are committed to git.** Data shouldn't be in the repo:
  remove them from git (`git rm --cached ml/data/*.csv`) and add `ml/data/` to `.gitignore`; share the files directly.
- Both ML branches use `ml/notebooks/`. Keep forecasting files clearly named (e.g. `forecasting.ipynb` is fine)
  so the two branches don't overwrite each other when they merge.

---

## Repo check — 18 Nov (afternoon): `backend/expense`

Omar pushed *"Add expense API, schemas, service and decision engine"* (commit `f7425d1`, force-push, replaces the 14 Nov mock).
Still in memory: no MySQL, login or ML call yet — that's expected.

**Already matches ✅**
- Statuses `Pending` / `Approved` / `Rejected`; approve / reject only while Pending; amounts in SAR.
- `department_id` is copied from the employee when the request is created (snapshot).
- Rule warnings (limit, budget) are a list of strings, **separate from the AI result** — exactly as agreed.
- AI not available → `None`, no error.
- Uses Yousef's `limit_warning` / `budget_warning` correctly (all 5 tests pass when `finance_service.py` is added).

**4 changes for the AI part** (code for each in contract **C10**, C2–C4)

| # | What's in the code now | Change | Why it matters |
|---|---|---|---|
| 1 | `decision_engine` reads `anomaly_result.get("anomaly_score")` | The ML service returns **`score`** → save it in `anomaly_score` | Tested with the stub: the score comes back as `None`, so the queue can't sort by risk |
| 2 | Only `risk_level` and the score are kept | Also save `reason_details` → `risk_justification` | Without it, the manager sees a badge with **no reasons** |
| 3 | The AI result is passed in **before** the expense is saved | Save first (AI columns empty), then score in a **background task** (`score_expense_in_background(expense.id)`) | The ML service needs `expense_id` and the employee's other requests that day (to catch splits); scoring after saving never slows the employee down; the other Pending requests of that day get re-scored |
| 4 | `ExpenseCreate` has `category: str`, but `expense_service` reads `expense_data["category_id"]` | Pick one (suggested: `category_id` from the frontend). When calling ML, send the **name** (`expense.category.name`) | It will crash with `KeyError` once connected; ML accepts only the 6 names |

Simplest fix for 1–3: `evaluate_expense` does **rules only** (returns `{"warnings": [...]}`), and the AI goes through
`anomaly_service.save_result` / `score_expense_in_background` from the contract (C3). Test 4 (`"High"`, `-0.15`) should go:
`risk_level` is lowercase and `score` is 0–1.

**Smaller things (ERD, not AI)**
- `decision_engine` imports `finance_service`, which is only on `backend/finance` → on `backend/expense` alone the test fails (`ModuleNotFoundError`). Merge `backend/finance` first.
- Reject saves the reason as `reason`; the ERD column is `manager_note`. `reviewed_by` and `reviewed_at` aren't set yet.
- The approve / reject section is titled "Finance Admin", but in the ERD the **department manager** approves (the comments inside already say managers).
- No edit endpoint yet; when it's added, re-score the request after the edit (C4).

Other branches: no new commits since 17 Nov (`frontend/employee-manager` and `ml/forecasting` items above are still open).

---

## Please tell ML when

- MySQL and the ML call are added on `backend/expense` (ML will check it again)
- You want to change a category name, a column the model uses, or the roles
