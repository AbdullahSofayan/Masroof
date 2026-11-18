# Masroof — ML Project Brief

*Last updated: 18 Nov 2026 (Step 5 feature engineering done; backend OK on the ERD changes; contract v0.4; Step 4 handoff not sent yet) · Owner of the ML part: Jassar*

**Where things stand (18 Nov):** Steps 1–2 done, Step 3 done (**contract v0.4**, 18 Nov — matches the new ERD; Part C to be aligned when the backend code is pushed), **Step 4 done** (247,838 requests, 20 departments, 4,599 users). ✅ **Backend replied OK to the ERD changes** (18 Nov) — next from them: their real code on `backend/expense`. ⏳ **The Step 4 handoff has NOT been sent to the team yet** (`step4_handoff.md`, `sample_requests.csv`, `forecast_data.csv`). ✅ **Step 5 done (18 Nov)**: 10 features from earlier requests only, cold-start rule with N = 5, saved `features.csv` (247,838 × 17). **Next: Step 6** (feature selection), which starts with one decision: what to do about the 13 very busy employees (see Step 5). ⚠️ Repo check 18 Nov (re-verified): mismatches in `frontend/employee-manager` and data committed in `ml/forecasting` → section 11 + `masroof_changes_for_team.md`.

**🆕 Mentor feedback received (16 Nov):** 5 comments, all about AI/ML → full list and status in **section 10**. Every change they cause is marked **🆕 MF1–MF5** through this brief (Steps 5, 7, 8, 9, gotchas, open questions).

---

## 1. The project

- **What:** Masroof, a corporate expense-management web platform (similar to SiFi) with AI anomaly detection.
- **Context:** capstone project for the SIC AI course (bootcamp), **3-week prototype**.
- **Team:** backend team, frontend team, Jassar (ML model), another teammate (expense forecasting).
- **Repo:** github.com/AbdullahSofayan/Masroof
  - `main` → **empty**: the old `api/` skeleton was reverted on 15 Nov.
  - `backend/expense` branch → **where the backend team is building**, using the new ERD (below).
  - `ml/stub-service` branch → **the ML folder (pushed 15 Nov)**: contract, stub service, notebooks. No data files. Safe to merge into `main` (won't restore `api/`).
- **Backend stack:** FastAPI + MySQL.

### How the platform works (new ERD, 15 Nov)
- Employees submit **expense requests before spending**; nothing is paid before approval.
- **One approval step:** the **department manager** approves or rejects (`status`: Pending / Approved / Rejected, `reviewed_by`, `reviewed_at`, `manager_note`).
- **Roles** (enum on USERS): `employee`, `manager`, `finance_admin`.
  - Department managers don't submit expenses (recommended: backend blocks it).
  - `finance_admin` sets budgets and sees the dashboard; doesn't review requests.
- Tables: USERS, DEPARTMENT (`manager_id`), EXPENSE (department snapshot at submit, category, amount, description, expense_date, receipt_path, `anomaly_score`, `risk_justification`, `warnings` JSON for policy/budget warnings), CATEGORIES, **EXPENSE_LIMITS** (one `max_amount` per category), **BUDGET** (per department per year + month).
- **No vendor, no card, no posting date.**

### ERD changes requested from the backend (✅ backend confirmed OK, 18 Nov)
Full list with reasons: `masroof_changes_for_team.md`.
1. Rename `users.role_id` → `role` (it's an enum, not an FK).
2. Add `expense.risk_level` (`low`/`medium`/`high`, nullable).
3. Fix `risk_justificaition` → `risk_justification`, type **JSON** (holds `reason_details`, EN + AR).
4. Nullable: `anomaly_score`, `risk_level`, `risk_justification`, `reviewed_at`, `manager_note`, `receipt_path`.
5. Index on `expense (requester_id, expense_date)`; seed exactly the 6 category names.
6. Recommended: block department managers from submitting expenses (nobody could review them).
7. `requires_review` was removed — good (it repeated `status` / `reviewed_by`).

Mapping: ML `score` → `anomaly_score`, `risk_level` → `risk_level`, `reason_details` → `risk_justification`.

**Who sees AI results:** department manager (badge + reasons on their department's requests); finance_admin (dashboard); employee sees nothing.

---

## 2. Decisions log

| Decision | Choice | Why |
|---|---|---|
| Model | **Isolation Forest** | No fraud labels → unsupervised; fast on 400K+ rows; catches combinations of signals; explainable |
| Pre-trained / fine-tuned model? | **No** | Tabular data has no shared "language" to transfer; "normal" is specific to each organization; fine-tuning needs labels; Isolation Forest trains in seconds |
| Training data | **Oklahoma PCard FY2014** (442,458 rows) | Real behavior; generated data would be circular (model learns our own assumptions) |
| Bank simulation vs requests | **Option A: keep the backend's request system** | Backend already built around requests; changing it 3 weeks before the deadline is risky. Bank simulation dropped. |
| Companies vs departments | **One company, with departments** | Less backend work (no multi-tenancy); natural approvers (department managers); department comparisons in the dashboard |
| Demo names | **Arabic names in English letters** (e.g. Fahad Al-Harbi) | |
| Categories | **6: Food, Travel, Transportation, Office Supplies, IT & Telecom, Equipment & Maintenance** | Backend had 4; added 2 |
| "Other" category | **None** | PCard purchases that fit none of the 6 (~32%) are **left out of training** (~290K rows remain, plenty) |
| How ML connects | **Separate HTTP service** (port 8001) | That's what the backend's `ai_client.py` expects (`AI_SERVICE_URL`) |
| ML and the database | **ML never touches the DB** | Backend sends the data; each team owns its part |
| Forecasting | Not Jassar's part | Another teammate |
| Score precision | **Unrounded** (Jassar removed `round(score, 3)`) | Keep it unrounded in the real model too |
| Approval flow (new ERD) | **One step: department manager** | finance_admin sets budgets + sees the dashboard; managers don't submit expenses |

---

## 3. Data — what we learned

**Raw file:** `data/raw/pcard_2014.csv` — 442,458 rows, 11 columns, no missing values, July 2013 – June 2014.

**Step 1 findings**
- Amounts very skewed: median ~$105, 75% under $345, max $1.9M → use `log(amount)`.
- 14,531 negative/zero amounts = refunds.
- No cardholder ID (only last name + initial) → build one.
- 116 agency numbers but 124 names (spelling variants).
- Dates stored as text. No time of day (all 12:00 AM).

**Step 2 cleaning (done)**
- Renamed columns to snake_case; parsed dates; uppercased/trimmed text.
- One name per agency (most common spelling).
- `cardholder_id` = agency_number + last name + initial.
- Removed 14,531 refunds.
- Removed 55 **bank account entries** (cards where "last name" = agency number: finance charges, late fees, payment adjustments — including the $1.9M "purchase").
- **Kept** 14,330 exact duplicates (no transaction ID; repeats may be legit, and duplicates are a fraud signal).
- Result: `data/processed/pcard_clean.csv` — **427,872 rows, 12 columns**, 5,425 cardholders, 114 agencies.
- 650 cardholders have < 5 purchases → their personal average is unreliable → fall back to department.
- Note: some values like "N/A" become NaN when re-reading the CSV → fill text columns with "UNKNOWN".

**Category analysis (why "amount vs category" alone is weak)**

Spread of log-amount inside each group (lower = tighter = better comparison):

| Compare to… | Spread |
|---|---|
| All purchases | 1.56 |
| Backend's 4 categories | 1.54 |
| 10 categories | 1.51 |
| Original 433 MCC codes | 1.31 |
| The employee | 1.37 |
| **The employee within the category** | **1.31** (as tight as the 433 MCCs) |

→ Use **amount vs employee-within-category** instead of amount vs category.

With the 6 categories: 32% of purchases fit none (Professional Services, Lab & Medical, Training, misc.) → excluded from training.
"Book Stores" in PCard is 96% Amazon → mapped to Office Supplies (a judgment call).

---

## 4. The 10-step plan

| # | Step | Where | Status |
|---|---|---|---|
| 1 | Data Exploration | notebooks/01_data_exploration | ✅ Done |
| 2 | Data Cleaning | notebooks/02_data_cleaning | ✅ Done |
| 3 | Team Contract + Stub | docs/ml_contract.md, src/service.py, src/predict.py | ✅ Done — **contract v0.4** (18 Nov): written for the new ERD. Part C is ERD-based reference code (tested vs the stub); align with the real code once it's on `backend/expense` |
| 4 | Category Mapping + Localization | notebooks/03_localization | ✅ Done (17 Nov) |
| 5 | Feature Engineering | notebooks/04_feature_engineering | ✅ Done (18 Nov) · 🆕 MF1 done |
| 6 | Feature Selection | notebooks/05_feature_selection | ⬜ Next |
| 7 | Model Training | notebooks/06_model_training | ⬜ · 🆕 MF4 |
| 8 | Evaluation + Reasons | notebooks/07_evaluation | ⬜ · 🆕 MF3, MF4 |
| 9 | ML Service (real model) | notebooks/08_model_export, src/ | ⬜ · 🆕 MF1 |
| 10 | Demo Request Generator | src/demo_generator.py | ⬜ |

### What each step does, and what to share / get

**Step 3 — Contract + stub** ✅
- Contract with backend & frontend; stub service returns fake but well-formed scores.
- 📤 Share: contract (backend → Parts B, C, E; frontend → Part D); push `ml/` to the repo.
- **v0.4 (18 Nov):** one approval step, `role` enum, AI columns `anomaly_score` / `risk_level` / `risk_justification` (mapping in B8), rule `warnings` kept separate from AI reasons (A2, C5, D3), only the department manager sees AI per request, never the score (C7, D2), managers blocked from submitting (C4), seed format with `categories` (ids 1–6), `departments`, `users` (`role`), `expense_limits`, `budget` (×1.1 proposal), `expenses` + Step 4 ID ranges and limits (Part E), categories + statuses with Arabic labels (D5), mentor feedback (F3). Part C tested on ERD-shaped tables against the stub: split → all 3 flagged, re-score works, manager sees badge + reasons only, employee/finance see nothing per request, queue order high → medium → not scored, ML down → no error.
- 📥 Get: answers to open questions (section 8); backend's OK on the 3 AI columns and `score_anomaly(expense, same_day)`.

**Step 4 — Category mapping + localization** ✅ (done 17 Nov)
- **Part A — categories:** keyword rules (regex, `\b` word boundaries) map the 434 PCard MCCs → the 6 categories; table saved in `mappings/mcc_to_category.csv` (in git). First rules had bugs ("H**EATING**" → Food, "COURIER-**AIR**" → Travel) → fixed. Kept 282,502 of 427,872 rows (66%); dropped 34% (medical/lab, general retail, business/government services…).
- **Part B — departments + users:** `N_DEPARTMENTS = 20` (top 20 agencies, 87.7% of rows → **247,838 requests**). Department names chosen from each agency's spending mix (dict `DEPARTMENT_NAMES`, easy to edit). Employees: ids **1001–5577** (sorted → same ids every run), names from a fixed-seed generator (`default_rng(42)`). **20 new managers (101–120, no expenses)**, **2 finance admins (201–202, no department)**. Username = `first.family.id`, email `@example.com`. Total 4,599 users.
- **Part C — SAR, dates, saving:** `amount_sar` = USD × 3.75 (kept `amount_usd` for the round-amount feature). Dates + 626 weeks − 1 day → **2025-05-14 … 2026-06-28** (real year starts **2025-06-29**); Mon→Sun mapping verified; weekend (Fri–Sat) share 8.2%. Stable sort by date (mergesort) → expense ids **100001–347838**. Descriptions generated (5 per category, random — may not fit the amount). History status = `Approved`. Saved `requests.csv` (12 cols, incl. `orig_vendor` / `orig_mcc` for hand-checking only), `departments.csv`, `users.csv`.
- **Limits (4.19):** Office Supplies 3,000 · IT & Telecom 7,500 · Equipment & Maintenance 7,500 · Food 2,000 · Transportation 5,000 · Travel 10,000 SAR (~p95, ~5% of requests over). Limits are **per single request**.
- 📤 Shared: `step4_handoff.md` (departments, ID ranges, limits, caveats, questions) + `sample_requests.csv` (50 rows, statuses mixed for UI only) + `forecast_data.csv` (forecasting teammate). **Seed files in the backend's exact format come after their ERD changes.**
- 📥 Get: OK on the 20 department names; how much history goes into the demo DB (recommended: a few departments + last ~6 months); block or warn over limit.
- Possible later improvement: descriptions chosen from the original MCC (so they fit the amount).

**Step 5 — Feature engineering** ✅ (done 18 Nov)
- Input `requests.csv` → output **`data/processed/features.csv`** (247,838 rows × 17 columns: `expense_id`, `requester_id`, `department_id`, `category`, `expense_date`, `amount_sar`, `baseline_level` + the 10 features). Whole notebook runs in ~15 s.
- **The 10 features:**

| Feature | Meaning |
|---|---|
| `log_amount` | log(1 + amount SAR), "big in general" |
| `amount_vs_employee_category` | z-score vs the employee's **earlier** requests in this category (with fallback, below) |
| `amount_vs_employee` | z-score vs the employee's earlier requests (fallback: department → category) |
| `amount_vs_department` | z-score vs the department's earlier requests (fallback: category) |
| `category_share_for_employee` | share of the employee's earlier requests in this category (0 = first time). Under 5 earlier → department's share; no history → 1.0 |
| `same_category_day_count` | employee + day + category (splits). Includes the request itself |
| `duplicate_count` | employee + day + category + amount (duplicates) |
| `daily_request_count` | employee + day |
| `is_weekend` | Friday or Saturday (`dayofweek` 4, 5) → 8.2% |
| `is_round_amount` | multiple of 100 and ≥ 100, checked on `amount_usd` in training (the original currency); **on SAR in the app** → 1,841 rows (0.74%) |

- **Part A — earlier requests only (MF1):** sort by `expense_date`, `expense_id`; per group (emp, empcat, dept, deptcat, cat) and **per day**: cumulative n / sum / sum of squares of `log_amount`, minus the current day → mean and std of **earlier days only** (same-day requests don't see each other). Checked against a brute-force calculation: 0 mismatches on 1,500 values.
- **Part B — cold-start rule (MF1), N = `MIN_HISTORY` = 5:** for `amount_vs_employee_category` use the first level with ≥ 5 earlier requests: employee in category → employee → department in category → category → none (z = 0). Result: empcat 80.6%, emp 10.4%, deptcat 8.6%, cat 0.3%, none 119 rows. Saved as `baseline_level` (for reasons like "compared with the department because the employee is new").
  - `MIN_STD = 0.1` (spread floor) fixes employees who always paid the same amount (e.g. employee 2099 always 112.46 → spread 0 → 128 infinite z-scores, one of 53.7 million). `Z_CAP = 10` caps extremes. At the cap: 175 / 66 / 0.
  - Check: employee 3170, 744.90 SAR Transportation on 8 Dec (first time in the category) → 5.87 vs the employee, 0.69 vs the department, category share 0.00.
- **Part C — same-day counts use the whole day** (including requests created later that day). That matches the app: the backend re-scores the Pending same-day siblings (contract C3). Other days are never used.
  - Known cases for Step 8: **451** splits (3 requests in one category on one day, each under the limit, together over it), e.g. employee 1157 on 14 Jan 2026: 3 Food requests (544.61 + 688.84 + 787.80 = 2,021.25 > 2,000). Duplicate example: employee 1001, 1,322.25 Travel twice on 20 Aug 2025.
- ⚠️ **Finding: very busy employees.** 13 employees (0.3%) usually send ≥ 5 requests per day and make up **15.7% of all rows**. The busiest, employee 4481, has 9,544 Travel requests (mostly one travel agency → books trips for others). Normal on a company card, not for personal requests: same-day counts reach 164 (mean 6.35, median 2). **Decide in Step 6:** drop these 13 from training, or add a "vs this employee's usual day" count.
- **Where `MIN_HISTORY` lives in the app:** now in notebook 04 (chosen + tested); in Step 9 it moves to `src/features.py` (with `MIN_STD`, `Z_CAP`, the z-score and the cascade), imported by the notebooks and the service. **Changing N means rebuilding the features and retraining.**
- Dropped: `vendor_freq`, `posting_delay` (backend has no vendor or posting date).
- 📤 Share: plain-language feature list (+ the cold-start rule). 📥 Get: confirmation the backend sends same-day requests (already in contract v0.4).

**Step 6 — Feature selection**
- Correlation check; remove features that carry the same information (Isolation Forest picks features at random, so duplicates get double weight).
- No scaling/encoding needed (trees are scale-invariant; all features are numeric).
- 📤 Share: final reason codes if any are removed.

**Step 7 — Model training**
- Train Isolation Forest; choose `contamination` (share flagged — a product decision); set Low/Medium/High cut-offs.
- 🆕 **MF4 — cut-offs from review capacity:** start from how many flags managers can review (e.g. per manager per week), then pick `contamination` and the Medium/High cut-offs so the number of flags matches it. No more placeholder 0.60 / 0.80.
- 🆕 **MF4 — rules baseline:** build simple spending-policy rules (over the category max in EXPENSE_LIMITS, weekend, same-category same-day split, duplicate, many requests per day) to compare with Isolation Forest in Step 8.
- 📤 Share: risk cut-offs. 📥 Get: how many flags managers can realistically review (**now required — MF4**).

**Step 8 — Evaluation + reasons**
- No labels → (1) read top flags, (2) check known cases, (3) **plant synthetic anomalies** (split requests under the policy max, huge weekend requests, duplicates) and measure detection rate.
- 🆕 **MF3 — unseen anomaly patterns:** two sets of planted anomalies, reported separately:
  - (a) **seen** — the patterns the features were designed for (splits, weekend, duplicates…);
  - (b) **unseen** — patterns made up by a teammate *without telling Jassar* (e.g. slowly rising amounts, a category the employee never uses at a normal amount, bursts at month-end).
- 🆕 **MF3 — honest metrics:** PCard rows are unlabeled → they are **not** confirmed normal. Report recall (detection rate) on planted anomalies + flag rate on real data. Call flagged real rows **"unverified"**, hand-check a sample. Do **not** report precision or false-alarm rate on real data as if it were known.
- 🆕 **MF4 — model vs rules:** compare Isolation Forest with the Step 7 rules baseline on the same planted anomalies, **at the same number of flags**. Show what Isolation Forest catches that single rules miss (combinations) — that's the answer to "why ML?".
- Compute which features made each request unusual → reason codes; finalize EN/AR texts.
- 📤 Share: reason texts, evaluation numbers/charts, demo cases. 📥 Get: frontend feedback on texts.

**Step 9 — Real ML service**
- Move feature code to `src/features.py` (one source of truth for training and serving).
- Real `src/predict.py` behind the **same endpoints**; save model + per-employee/department/category stats.
- 🆕 **MF1:** saved stats = history up to the last training date; a new request is compared only with requests before it, and the cold-start rule from Step 5 is in `features.py` (same code for training and serving).
- **Saved stats format:** per group (employee, employee + category, department, department + category, category): **n, sum, sum of squares** of `log_amount` (stored next to the model in `models/`). New request → look up its groups → same cascade as Step 5 (an unknown new employee has n = 0 → department in category). After a request is saved, add it to the sums (updating = addition). Save the updated stats to the file so a restart doesn't lose them (enough for the demo).
- 📤 Share: the real service; backend runs `python -m app.rescore_ai --all` once. 📥 Get: integration test results.

**Step 10 — Demo request generator**
- Script that logs in as different employees and submits requests through the backend API, with planted suspicious ones at chosen moments.
- 📤 Share: script + demo script. 📥 Get: working endpoints; full rehearsal.

---

## 5. The ML service (contract v0.4 summary)

**Run:** `uvicorn src.service:app --port 8001 --reload` → docs at http://localhost:8001/docs
**Backend .env:** `AI_SERVICE_URL=http://localhost:8001`

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | status + model version |
| POST | `/anomaly/score` | score one request |
| POST | `/anomaly/score-batch` | up to 500 at once |
| GET | `/anomaly/categories` | the 6 accepted names |
| GET | `/anomaly/reasons` | all reason codes, EN + AR |

**Request:** `expense_id, requester_id, department_id (nullable), category, amount (SAR), expense_date, same_day_requests[]`
(`same_day_requests` = the requester's other requests for the same date, any status, excluding this one.)

**Response:** `expense_id, score (0–1), risk_level (low/medium/high), is_flagged, reasons (EN), reason_details (code + EN + AR), model_version`

**Stub behavior:** same `expense_id` → same fake score; ~80/15/5% low/medium/high; amount > 10,000 → high; 2+ same-category same-day requests → high; unknown category → 422.

**Integration rules (in the contract):**
- Backend scores in a **background task** after create / edit (while Pending); never blocks the workflow.
- When a request is scored, the employee's **other pending same-day requests are re-scored** (so all parts of a split get flagged).
- Saved in the ERD's EXPENSE columns: `score` → `anomaly_score`, `risk_level` → `risk_level`, `reason_details` → `risk_justification` (JSON). Rule warnings stay in `warnings`.
- `python -m app.rescore_ai` scores anything missed (ML down, seed history, new model).
- **Only the department manager sees the AI result per request** (badge + reasons, never the raw score). Employees see nothing; finance_admin sees the dashboard summary.
- The manager's Pending queue is sorted high → medium → low → not scored, then oldest first.
- **Seed IDs must be kept** — the model remembers employees/departments by ID.
- Backend integration code (Part C) was tested against the stub on ERD-shaped tables (SQLite): works.

**Reason codes:** `amount_high_for_employee`, `amount_high_for_employee_category`, `amount_high_for_department`, `large_amount`, `unusual_category_for_employee`, `weekend_expense`, `round_amount`, `duplicate_request`, `possible_split_request`, `many_requests_same_day`.

**Risk cut-offs (placeholder until Step 7):** medium ≥ 0.60, high ≥ 0.80. 🆕 MF4: the real cut-offs come from managers' review capacity.

**Category limits (checked in Step 4, ~p95):** Office Supplies 3,000 · IT & Telecom 7,500 · Equipment & Maintenance 7,500 · Food 2,000 · Transportation 5,000 · Travel 10,000 SAR. (Earlier guesses were too strict — e.g. Transportation 1,500 would flag 16% of normal requests.)

---

## 6. Folder structure

**Working copy: `Desktop\Masroof\ml`** (the repo clone, on branch `ml/stub-service`). `Desktop\SIC\ML` is the old copy — don't work there anymore.

**`ml\docs\`** = where every important `.md` file for the project lives (moved from `ml\stuff\` on 18 Nov): the contract and this brief at the top, files sent to the team in `team\`, sample data in `samples\`.
`Desktop\Masroof\api\` is the old reverted backend skeleton (it came with the branch) — ignore it.

```
ml/
├── data/                 (git-ignored)
│   ├── raw/pcard_2014.csv
│   └── processed/        pcard_clean.csv, requests.csv, departments.csv, users.csv, forecast_data.csv, features.csv
├── docs/
│   ├── ml_contract.md               (contract with backend + frontend)
│   ├── masroof_ml_project.md        (this brief)
│   ├── team/                        (sent to the team)
│   │   ├── step4_handoff.md
│   │   └── masroof_changes_for_team.md
│   └── samples/
│       └── sample_requests.csv      (50 requests for the frontend)
├── mappings/mcc_to_category.csv     (Step 4, in git)
├── models/
├── notebooks/
│   ├── 01_data_exploration.ipynb     ✅
│   ├── 02_data_cleaning.ipynb        ✅
│   ├── 03_localization.ipynb         ✅
│   ├── 04_feature_engineering.ipynb  ✅
│   ├── 05_feature_selection.ipynb
│   ├── 06_model_training.ipynb
│   ├── 07_evaluation.ipynb
│   └── 08_model_export.ipynb
├── src/
│   ├── service.py      (FastAPI app)
│   ├── predict.py      (stub scoring logic)
│   └── features.py     (Step 9)
├── Dockerfile, .dockerignore, .gitignore
├── requirements.txt              (service)
├── requirements-notebooks.txt    (notebooks)
└── README.md
```

---

## 7. The repo ✅ pushed

- `ml/stub-service` pushed on 15 Nov (commit "Add ML service stub and integration contract"), no data files.
- Safe to merge into the new `main`: the merge won't bring back the reverted `api/` folder.
- Next time you push, use **cmd** syntax (`xcopy`, no `#` comments) or PowerShell (`Copy-Item`) — the two shells use different commands.
- ✅ Switched to the clone (`Desktop\Masroof\ml`) on 16 Nov.
- Pending: open a Pull Request into `main` so the team can review the contract.

---

## 8. Open questions

| Question | Who answers | Status |
|---|---|---|
| Who builds receipt reading? 🆕 MF5: mentors suggest a multimodal model (see section 10) | Team | Open |
| Does forecasting share the ML service (`/forecast/...`) or get its own URL? | Forecasting + backend | Open |
| 🆕 MF2: Forecasting model, horizon, last-week baseline, rolling validation, MAE target | Forecasting teammate | ✅ Covered in `ml/forecasting` (17 Nov): Linear Regression, next 4 weeks per department, last-week baseline, rolling validation, MAE in SAR |
| **Send the Step 4 handoff to the team** (+ the repo-check fixes in `masroof_changes_for_team.md`) | Jassar | ⏳ Not sent yet |
| Apply the ERD changes (section 1) | Backend | ✅ OK'd on 18 Nov — now waiting for their code |
| Push their real code to `backend/expense` | Backend | 🟡 First version pushed 18 Nov (Omar, in memory). 4 AI changes sent (contract C10 + team file). Check again when MySQL + the ML call are added |
| Update the contract to v0.4 | ML | ✅ Done 18 Nov → **v0.4.1** (C10 = review of Omar's first code) |
| Are the 20 department names OK? How much history goes into the demo database? | Team / Backend | In `step4_handoff.md` — waiting for it to be sent |
| Block or warn when a request is over its category limit? | Backend + team | Asked in `step4_handoff.md` |
| How many flags can managers review (sets contamination)? 🆕 MF4: mentors require it | Team | Step 7 — needed |
| 🆕 MF1: Confirm N for the cold-start rule (proposed 5) | ML | ✅ N = 5 (`MIN_HISTORY`), Step 5 |
| The 13 very busy employees (15.7% of rows): drop from training or add a "vs usual day" count? | ML | Step 6 — first decision |

---

## 9. Things to remember (gotchas)

- **Training–serving consistency:** the backend must compute features exactly like the notebooks → one shared `features.py`.
- **Cold start:** a new employee/company has no history → compare to department, then category; seed the demo with PCard history. 🆕 MF1: exact rule done in Step 5 (N = 5, cascade empcat → emp → deptcat → cat).
- 🆕 **MF1 — leakage:** every stat uses only requests from **earlier days** (day-level cumulative sums minus the current day). Whole-year averages = leakage. Same-day counts are the one exception on purpose (whole day, matched by re-scoring siblings).
- **Zero spread:** always clip the std (`MIN_STD = 0.1`) and cap z (`Z_CAP = 10`), in training and serving.
- **Round amounts:** training checks `amount_usd`, the service checks SAR (both = the amount as originally written).
- **Split requests** only become visible once later requests arrive → re-score same-day siblings.
- **No labels** → evaluate with planted anomalies, not accuracy. 🆕 MF3: include unseen patterns; unlabeled ≠ normal → no precision / false-alarm claims on real data.
- **Honest caveats for the presentation:** PCard is card purchases (US government, 2014), not requests; seasons are American (no Ramadan/Eid pattern); ~32% of data excluded (no "Other" category).
- **Contract changes** go through ML first; bump the version.

---

## 10. 🆕 Mentor feedback (16 Nov)

All 5 comments are about AI/ML.

| # | What the mentors asked | Were we already doing it? | What changes | Owner | Where |
|---|---|---|---|---|---|
| **MF1** | Build employee spending features from **prior transactions only**; define handling for **new employees** | ❌ Prior-only: **not planned** (stats were going to be whole-history). 🟡 New employees: **partly** (fallback to department under 5 purchases, but no exact rule) | ✅ **Done in Step 5 (18 Nov):** earlier-days-only stats (verified by brute force), written cascade rule with N = 5. Remaining: same code in serving (`features.py`, Step 9) | Jassar | Steps 5, 9; gotchas |
| **MF2** | Specify the **forecasting model and horizon**; compare with a **last-week baseline** using **rolling validation** and numeric **MAE targets** | ❓ Not in this brief (forecasting teammate's part) | Teammate defines model + horizon, naive last-week baseline, walk-forward validation, MAE target in SAR | Forecasting teammate | Section 8 |
| **MF3** | Test **unseen** synthetic anomaly patterns; don't treat unlabeled purchases as **confirmed normal** when reporting false alarms / precision | 🟡 **Partly**: planting anomalies + detection rate was planned; unseen patterns and the reporting rule were not | Seen vs unseen anomaly sets; recall + flag rate only; flagged real rows = "unverified" | Jassar (+ a teammate to make the unseen set) | Step 8; gotchas |
| **MF4** | Set **risk thresholds against review capacity**; compare Isolation Forest with **simple spending-policy rules** | 🟡 Thresholds: **planned** (Step 7 asked for review capacity). ❌ Rules comparison: **not planned** | Cut-offs from managers' capacity; rules baseline; compare at the same number of flags | Jassar (+ team for the capacity number) | Steps 7, 8; sections 5, 8 |
| **MF5** | *GenAI option:* extract receipt fields with a **multimodal model**; require **human confirmation** and **redaction** of sensitive info before external processing | ❓ **Not assigned** (open question "who builds receipt reading?") | Optional. Employee confirms extracted fields; blur/remove names, card numbers, IDs before sending to an outside API. Idea: receipt amount ≠ claimed amount → new reason code | Team decides | Section 8 |

**Summary:**
- ✅ Already planned: thresholds from review capacity (MF4), planting anomalies (MF3), department fallback for new employees (MF1).
- ✅ Done: prior-only stats + exact cold-start rule (MF1, Step 5).
- ❌ New work for Jassar: unseen anomaly set + honest reporting (MF3), rules baseline comparison (MF4).
- ➡️ Not Jassar's: forecasting (MF2, teammate), receipt GenAI (MF5, optional, team decides).

---

## 11. Repo check (18 Nov)

New branches since 15 Nov:

| Branch | Who | What | Status for ML |
|---|---|---|---|
| `backend/finance` | Yousef | Finance rules: limit warning **per single request**, monthly department budget warning, budget usage; request schemas for departments / limits / budgets (with tests) | ✅ Matches what was agreed. No category names hard-coded |
| `ml/forecasting` | Abdullah | `forecasting.ipynb` using `forecast_data.csv` + `departments.csv` | ✅ Same data as the anomaly model. ⚠️ **The data files are committed to git** (`ml/data/forecast_data.csv`, 8.8 MB) |
| `frontend/employee-manager` | Ziyad | Employee + manager screens, mock API, risk box | ⚠️ 3 mismatches (below) |
| `backend/expense` | Omar | **18 Nov:** expense API, schemas, decision engine (still in memory) | ✅ statuses, SAR, rule warnings separate. ⚠️ 4 AI changes: reads `anomaly_score` instead of `score`; drops `reason_details`; AI called before saving; `category` vs `category_id` → contract C10 |

**Frontend mismatches (affect the model / the agreements):**
1. **Categories:** mock uses *Meals & hospitality, Office supplies, Travel & transport, Software & subscriptions, Training & events* — not the 6 agreed names. The ML service rejects any other name (422).
2. **Statuses / workflow:** uses the old `api/` flow (`pending_manager` → `pending_finance` → `approved`, `needs_changes`) — the new ERD has one step: `Pending` / `Approved` / `Rejected`.
3. **AI box (`RiskAlertBox`):** shows the raw **anomaly score as a %** to managers (agreed: never shown); shows `warnings` as the AI's reasons (ERD: `warnings` = policy/budget rules, AI reasons = `risk_justification`); mock `risk_level` is capitalized (`High`) — handled with `toLowerCase()`, OK.

**Forecasting data in git:** `ml/data/` is git-ignored on `ml/stub-service`, but `ml/forecasting` was branched from `main` (no `.gitignore` there) so the CSVs were committed. 8.8 MB is under GitHub's limit, but data shouldn't be in git; when both ML branches merge, the files will stay tracked. Both ML branches also share `ml/notebooks/` → agree on folder names.

**Re-checked 18 Nov (morning):** no new commits on any branch since 17 Nov 23:01 (`ml/forecasting`). Every finding above was verified in the code:
- `backend/finance` → `limit_warning` (per single request), `budget_warning` (monthly department budget, approved spending + this request), `budget_usage`; schemas `DepartmentCreate`, `ExpenseLimitCreate`, `BudgetCreate`. Pure functions, no database yet.
- `frontend/employee-manager` → `mockData.js` categories (5 different names, each with `name_ar`); `constants.js` statuses `pending_manager` / `pending_finance` / `needs_changes` and a manager decision that sends to `pending_finance`; `RiskAlertBox.jsx` shows `Anomaly score: {score × 100}%` and lists `analysis.warnings` as the AI's points.
- `ml/forecasting` → `forecasting.ipynb` + `ml/data/forecast_data.csv` (247,839 lines) + `ml/data/departments.csv` committed. The notebook covers **MF2**: Linear Regression on weekly department totals (lags 1–4), 4-week horizon, last-week baseline, rolling validation, MAE in SAR.
- `backend/expense`, `main` → unchanged.

Extra for the frontend: their categories carry an Arabic name (`name_ar`), so they'll need Arabic names for the **6 agreed categories** too.

All of this is written for the team in `masroof_changes_for_team.md` (section "Repo check — 18 Nov").
