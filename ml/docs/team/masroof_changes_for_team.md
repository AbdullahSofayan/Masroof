# Masroof — Changes needed for the AI model

*From: Jassar (ML) · 16 Nov 2026 · Based on the latest ERD*

**✅ Status (18 Nov): the backend confirmed OK on all the ERD changes below, and the final ERD (Abdulaziz, 18 Nov evening) has all of them.** Omar's first code is on `backend/expense` (18 Nov) → checked in **"Repo check — 18 Nov (afternoon)"** at the end: 4 changes for the AI part.

**🆕 Latest (23 Nov):** the model is finished and tested → see **"Update — 23 Nov"** near the end (3 new reason codes, how many requests get flagged, `category_limit` to send, 1 question for the backend).

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
- Full details: `ml/docs/ml_contract.md` (**v0.4.5**, matches the final ERD) on the `ml/stub-service` branch.
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

## Update — 18 Nov (ML Step 6 finished) · contract v0.4.2

Only two things touch the other teams:

1. **Seed data: 13 employees are left out.** They usually send 5+ requests a day (bulk travel / equipment buyers
   on shared cards, not personal expenses), so the model is trained without them. Ids **1194, 1237, 1752, 1759,
   2712, 4097, 4438, 4481, 4851, 5060, 5112, 5438, 5571** won't be in `users.csv` or `expenses.csv`.
   Nothing to do on your side, just don't reuse those ids for test users (contract E3).
2. **Reason codes are final: all 10 stay** (contract B7). One text changed:
   `amount_high_for_department` → "Amount is much higher than usual for this department in this category" /
   "المبلغ أعلى بكثير من المعتاد في هذا القسم لهذه الفئة" (it's now used for new employees, who are compared with their department).
   Frontend: no change needed, the text comes from the API. The stub already returns the new text.

Still needed from the team for ML Step 7 (training): **how many flagged requests a manager can realistically review per week** (mentor feedback MF4).

---

## Repo check — 18 Nov (evening) · contract v0.4.3

### Final ERD (Abdulaziz) ✅
All 7 agreed changes are in: `role` enum, `risk_level` (low/medium/high, nullable), `risk_justification` JSON (spelled right),
the nullable columns, `requires_review` removed, statuses `Pending` / `Approved` / `Rejected` with one reviewer (`reviewed_by`),
`EXPENSE_LIMITS` = one `max_amount` per category, `BUDGET` = department + year + month.

Two small things on the ML side to match it (contract v0.4.3):
- `users.csv` (seed) has **no `is_active`** column anymore (it's not in the ERD).
- `expense.warnings` is saved as an **empty list `[]`** when no rule was broken, never null (contract C5).

Please confirm: the **index on `expense (requester_id, expense_date)`** is in your model (contract C1). ERD diagrams don't show indexes,
and it's what makes the "same-day requests" query fast.

### `main`
`backend/expense` (PR #1) and `backend/finance` (PR #2) are merged. ✅ All tests pass now (the `finance_service` import works on `main`).
❌ The **4 AI fixes in contract C10 are still open** (the code on `main` is the same as Omar's first version):
1. Read `score` (not `anomaly_score`) from the ML response → save it in `anomaly_score`
2. Save `reason_details` → `risk_justification`
3. Score **after** saving, in a background task (needs `expense_id` and the same-day requests)
4. `category` vs `category_id` in the create schema / service

### `frontend/finance` (Majed, new)
Careful work (tests, budget warnings), but branched from `frontend/employee-manager`, so it carries the old design:

| # | In the code | Agreed (final ERD + contract) |
|---|---|---|
| 1 | Finance approves requests ("Approve for payment", payout queue, `pending_finance`) | **Only the department manager approves**, one step. `finance_admin` sets budgets and limits and sees the dashboard |
| 2 | `RiskAlertBox` on finance's request page, with **"Anomaly score: 78%"** and `warnings` shown as the AI's reasons | finance_admin sees **no AI on single requests**; nobody sees the score; AI reasons ≠ rule warnings (contract A3, C7, D3, D4) |
| 3 | Finance dashboard has no AI section | Dashboard AI summary: requests by risk level, flagged % per department, top reasons (contract C9, D4) |
| 4 | Old 5 categories (Meals & hospitality, …) | Food, Travel, Transportation, Office Supplies, IT & Telecom, Equipment & Maintenance |
| 5 | Limits 1,500 / 2,500 / 1,000 / 3,000 on 4 categories, as `/policies` with `is_allowed` | `EXPENSE_LIMITS`: one `max_amount` per category: Food 2,000 · Travel 10,000 · Transportation 5,000 · Office Supplies 3,000 · IT & Telecom 7,500 · Equipment & Maintenance 7,500 |
| 6 | Budgets can be monthly **or annual** | `BUDGET` is per department, per **month** only |

**Forecast API proposal:** `financeApi.forecast()` proposes `GET /forecast?department_id=` → 8 weeks of history, 4 predicted weeks,
last-week baseline. It matches the forecasting notebook (Linear Regression, 4 weeks, last-week baseline). **Abdullah (forecasting)
and the backend should agree on it with Majed**; it also answers the open question "does forecasting join the ML service or get its own URL?".

### Unchanged since 17 Nov
- `frontend/employee-manager` (Ziyad): the 4 mismatches above (categories, statuses, score as %, warnings as AI reasons) are still open.
- `ml/forecasting` (Abdullah): `ml/data/*.csv` still committed to git.

---

## Repo check — 20 Nov

### New since 19 Nov
- **`main`** (Ziyad): notifications, profile page, reports page with CSV export. ✅ The reports and the export don't show the AI score or risk, which is correct.
- **`backend/finance-routes`** (Yousef, **not merged yet**): real MySQL routes for departments, monthly budgets (+ usage) and category limits, finance-admin only. ✅ Matches the final ERD.

### Already in place for the AI (thank you)
- Database (`main`): `anomaly_score`, `risk_level`, `risk_justification` (nullable), `warnings` (default `[]`), the `(requester_id, expense_date)` index, the 6 categories created at startup, `ai_service_url` setting.
- Finance dashboard (Majed): the "Unusual requests" AI summary follows the contract exactly (C9, D4).

### Still needed for the AI to work end to end
**Backend** (works today with the ML stub, nothing waits for the real model):

| File | Contract | What |
|---|---|---|
| `routes/expenses.py` | C4 | Move from the in-memory list to MySQL + login; after saving, score in a **background task**; edit endpoint (re-score after edit); block managers from submitting |
| `services/ai_client.py` (new) | C2 | Calls `POST /anomaly/score` on the ML service |
| `services/anomaly_service.py` (new) | C3 | Fetch the same-day requests → ML → save `score` → `anomaly_score`, `risk_level`, `reason_details` → `risk_justification`; re-score the employee's other Pending requests that day |
| `services/decision_engine.py`, `expense_service.py` | C5, C10 | Rules only (`{"warnings": [...]}`); `category` vs `category_id` |
| `schemas/expenses.py` | C7 | `ai` field (`risk_level` + `reasons`), only for the department's manager, **never the score** |
| Manager queue | C8 | Sort Pending: high → medium → low → not scored, then oldest first |
| Dashboard summary endpoint (new, e.g. in `routes/finance.py`) | C9 | Counts by risk, flagged % per department, top reasons. **Majed's dashboard is already waiting for it** |
| `app/rescore_ai.py` (new) | C6 | Scores anything that was missed (ML was down) |

**Frontend (Ziyad), the manager's AI screens:**

| File | Contract | What |
|---|---|---|
| `components/RiskAlertBox.jsx`, `pages/manager/ExpenseReviewPage.jsx` | D2, D3 | Badge + `ai.reasons` (EN/AR) as one section, policy `warnings` as a separate section; **remove "Anomaly score: 74%"**; read `expense.ai` instead of `ai_analysis` |
| Manager queue (`ExpenseTable` / `ManagerDashboard`) | D2, C8 | Risk badge per row, riskiest first |
| `services/mockData.js` | D7 | Mock in the new shape: `ai: {risk_level: "high", reasons: [...]}`, lowercase, no score |

### Reminders (not about the AI, but they block connecting the frontend to the real backend)
1. **URL prefix:** the frontend calls `http://localhost:8000/api/v1/...`, but the backend routes have no `/api/v1` prefix (`/auth`, `/users`, `/expenses`). Pick one.
2. **Role name:** the frontend's permissions use the role `finance`, but the backend sends `finance_admin`. A finance admin logging into the real backend gets no access, so the finance dashboard (with the AI summary) won't open.
3. **Merge `backend/finance-routes`** into `main` (departments, budgets, limits).
4. Still open from before: the C10 AI fixes, the `ml/forecasting` data files in git, the forecast API to agree between Abdullah, Majed and the backend.

ML side: the ML folder (`ml/stub-service`) will be merged into `main` with a Pull Request, so the ML service can be started from the same checkout.

---

## Update — 23 Nov (ML Step 8 finished) · contract v0.4.4 → v0.4.5

The model is tested and its settings are final (`iforest-0.2`). The response shape didn't change; the request gets one optional field (`category_limit`, point 5).

**What changed for you:**
1. **3 new reason codes** (13 in total, contract B7): `duplicate_recent_request` (same amount + category as a request a few days earlier), `unusual_amount_digits` (amount looks made up, e.g. 1,111.11), `returning_after_long_break` (first request after 90+ days). The EN/AR texts come from the API in `reason_details`, so **the frontend needs no change**; just don't hard-code a list of codes.
2. **How many requests get flagged:** ≈1% **high** (careful check) and ≈3.5% **medium** (quick look); ≈5% in total in the most recent months. For the biggest department that's ≈11 high + ≈51 medium per week; for a typical department < 1 high + ≈4 medium. Tell ML if that's too many to review.
3. **A split request now gives `medium`** (with the split reason), not `high`. The stub still forces `high` for 2+ same-category requests on one day; that's only a testing hook.
4. The new time rules (receipt reused within 7 days, 90+ days without requests) use history the ML service keeps itself: **nothing new to send for them.**
5. 🆕 **Backend: please send `category_limit` with each score request** (contract v0.4.5, B3 + C2). The finance admin can edit limits, and ML can't read the database, so without it the split rule would use old limits (e.g. Food raised to 3,000 → three 900 SAR requests still flagged as a split). It's one line in `ai_client._payload`:
   ```python
   "category_limit": (str(expense.category.expense_limit.max_amount) if expense.category.expense_limit else None),
   ```
   Optional: if it's missing, ML uses its own copy of the limits. The ML stub already accepts it.

**How it was tested (for the presentation):** planted anomalies in the real history; two "unseen" sets made blind by an independent reviewer; the model alone vs simple rules vs both at the same number of flags; and a blind hand-check of 30 requests. The hybrid caught 86% of the planted cases while flagging ≈4.5%; simple policy rules caught 94% but flagged 16% (almost 4× the reviews). All numbers are in `ml/models/evaluation_summary.json`.

**Backend status from the 22 Nov check (still needed for the AI):**
- ✅ Omar (`backend/expense`, 20 Nov): expenses in MySQL with login, only employees create, edit clears the AI columns, `category_id`. Yousef (`backend/finance-routes`): **C9 dashboard endpoint done**.
- ❌ Still no ML call: `ai_client`, `anomaly_service`, background task, `rescore_ai` (C2, C3, C6) → the AI columns stay empty.
- ❌ The expense response shows `anomaly_score` and `risk_level` to **every role** and has no reasons. Contract C7: only the department's manager gets `ai = {risk_level, reasons}`, never the score.
- ❌ Manager queue sort (C8). Ziyad's `RiskAlertBox` still shows the score %.
- `backend/expense` needs `main` + `backend/finance-routes` merged in to run.

**One question from ML (please answer before the real model, Step 9):**
- (a) **Seed history:** can ML send `expenses.csv` with the AI columns already filled, instead of running `rescore_ai` on ~200k old rows? Scoring old rows live would compare each one with stats that already include it and later months, which makes old requests look more normal than they were.

ML side: PR `ml/stub-service` → `main` is open (only adds `ml/`); please review and merge it.

---

## Please tell ML when

- MySQL and the ML call are added on `backend/expense` (ML will check it again)
- You want to change a category name, a column the model uses, or the roles
