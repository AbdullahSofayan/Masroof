# Masroof — ML Project Brief

*Last updated: 23 Nov 2026 (Steps 1–8 done; final hybrid `iforest-0.2` with 6 rules; contract v0.4.5; Step 9 next) · Owner of the ML part: Jassar*

**🆕 Where things stand (23 Nov):** ✅ **Step 8 done.** Evaluation finished (seen planted, 2 blind unseen rounds by independent agents, model vs rules vs both, blind hand-check). It added **3 rules + 3 reason codes** (13 codes now) and trimmed the model's medium share to 0.5%. Final: **high 1.00%, medium 3.47% (≈4.5% flagged; ≈5% in Jan–Jun 2026)**. All numbers in `models/evaluation_summary.json` and Step 8 below. `src/features.py` (v2) now holds all the feature + rule code, and `src/predict.py` (stub) has the 13 codes. PR `ml/stub-service` → `main` is open (main merged in, 29 files, additions only); a teammate merges it. **Next: Step 9** (real ML service). ✅ Decided (b): the backend sends the current `category_limit` with each score request (contract v0.4.5). Still deciding: (a) pre-scored seed. 🆕 **Step 9 in progress (23 Nov):** ✅ Part A: `src/history.py` + `models/history.joblib` (dates moved +21 weeks → 8 Oct 2025 – 22 Nov 2026; one-at-a-time features = `build_features`, 0 / 23,985 differences). ✅ Part B: real `src/predict.py` (replaces the stub; same score / level / reasons as batch scoring on 896 requests). ✅ Part C: service ready (`category_limit`, remembered requests saved to `data/service/added_requests.csv`, `/health` with history, `scikit-learn==1.9.1` pinned, spot for Abdullah's `/forecast` routes); cells 9.11–9.13 to run. Next: Part D (seed CSVs).

**Where things stand (18 Nov):** Steps 1–2 done, Step 3 done (**contract v0.4.3**, 18 Nov — matches the **final ERD** (Abdulaziz, all 7 agreed changes in); C10 = review of Omar's first `backend/expense` code), **Step 4 done** (247,838 requests, 20 departments, 4,599 users). ✅ **Backend replied OK to the ERD changes** (18 Nov); Omar pushed a first in-memory version of `backend/expense` (18 Nov) → 4 AI fixes in contract C10. ✅ **Docs pushed to `ml/stub-service` and the team told in the group (18 Nov)** (handoff, team changes, contract). ✅ **Step 5 done (18 Nov)**: features from earlier requests only, cold-start rule with N = 5. ✅ **Step 6 done (18 Nov)**: 13 bulk buyers removed (→ 209,012 requests), **8 final features** in `models/feature_list.json`, all 10 reason codes kept. ✅ **Step 7 done (18 Nov)**: **hybrid** = Isolation Forest on 5 "unusual for this person" features + 3 same-day rules; high = model top 1%, medium = model next 1% or any rule (≈4% flagged); saved `models/isolation_forest.joblib` + `models/model_config.json` (`iforest-0.1`). Review capacity proposed to the team (high 1% ≈ 11 careful checks/week for the biggest manager); waiting for their OK. **Next: Step 8** (evaluation: planted seen + unseen anomalies, model vs rules vs both). ⚠️ Repo check 18 Nov (re-verified): mismatches in `frontend/employee-manager` and data committed in `ml/forecasting` → section 11 + `masroof_changes_for_team.md`.

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
| Category limits for the split rule (23 Nov) | **Backend sends the current `category_limit` with each score request** (optional; ML falls back to its copy in `model_config.json`) | Limits are editable in the app and ML never reads the DB, so ML's copy would go out of date (e.g. Food 2,000 → 3,000: 3 × 900 SAR would still be flagged as a split). Only the split rule uses it, so no retraining when a limit changes |
| History dates for the demo (23 Nov) | **All dates + 21 weeks** (147 days): history 8 Oct 2025 → 22 Nov 2026. The seed files use the same move (`model_config.json` → `history.date_shift_weeks`) | History ended 28 Jun 2026; without the move every employee's first demo request would be a "90+ day break" (100%). Whole weeks keep every weekday and gap → features identical (checked), model and cut-offs unchanged; forecasting uses lags, not dates |
| History file in git (23 Nov) | **Yes: `models/history.joblib`** (1.5 MB) | The service can't start without it; made from the public PCard data, like the model |

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
| 3 | Team Contract + Stub | docs/ml_contract.md, src/service.py, src/predict.py | ✅ Done — **contract v0.4.5** (23 Nov): written for the new ERD; C10 reviews Omar's first code; v0.4.2 = Step 6, v0.4.3 = final ERD, v0.4.4 = Step 8 (13 reason codes, real risk levels, split = medium), **v0.4.5 = optional `category_limit`** |
| 4 | Category Mapping + Localization | notebooks/03_localization | ✅ Done (17 Nov) |
| 5 | Feature Engineering | notebooks/04_feature_engineering | ✅ Done (18 Nov) · 🆕 MF1 done |
| 6 | Feature Selection | notebooks/05_feature_selection | ✅ Done (18 Nov) |
| 7 | Model Training | notebooks/06_model_training | ✅ Done (18 Nov) · hybrid · 🆕 MF4 cut-offs from capacity (team to confirm 1% / ~4%) |
| 8 | Evaluation + Reasons | notebooks/07_evaluation | ✅ Done (23 Nov) · 🆕 MF3, MF4 done |
| 9 | ML Service (real model) | notebooks/08_model_export, src/ | ⬜ Next · 🆕 MF1 |
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
- Input `requests.csv` → output **`data/processed/features.csv`** (**209,012 rows × 18 columns**: `expense_id`, `requester_id`, `department_id`, `category`, `expense_date`, `amount_sar`, `baseline_level` + **11 candidate features**; Step 6 keeps 8). Whole notebook runs in ~15 s. Every cell has an explanation comment (added 18 Nov, also in notebooks 01–03).
- **Cell 5.1b — 13 bulk buyers removed first** (decided in Step 6): employees whose usual day (median requests per active day) is ≥ 5 → ids **1194, 1237, 1752, 1759, 2712, 4097, 4438, 4481, 4851, 5060, 5112, 5438, 5571** (38,826 requests, 15.7%). Travel bookers and equipment buyers on shared cards, not personal expenses (e.g. 4481: 9,544 Travel requests, up to 164 a day). Removed **before** the statistics so department/category averages are clean. `requests.csv` keeps them (still real department spending for forecasting). **Also left out of the demo seed** (contract E3).
- **The 11 candidate features** (✅ = kept in Step 6):

| Feature | Meaning | Step 6 |
|---|---|---|
| `log_amount` | log(1 + amount SAR), "big in general" | ✅ |
| `amount_vs_employee_category` | z-score vs the employee's **earlier** requests in this category (with fallback, below) | ✅ |
| `amount_vs_employee` | z-score vs the employee's earlier requests (fallback: department → category) | dropped |
| `amount_vs_department` | z-score vs the department's earlier requests (fallback: category) | dropped |
| `category_share_for_employee` | share of the employee's earlier requests in this category (0 = first time). Under 5 earlier → department's share; no history → 1.0 | ✅ |
| `same_category_day_count` | employee + day + category (splits). Includes the request itself | ✅ |
| `duplicate_count` | employee + day + category + amount (duplicates) | ✅ |
| `daily_request_count` | employee + day | replaced |
| `other_category_day_count` | `daily_request_count − same_category_day_count` = requests the same day in **other** categories (added in Step 6) | ✅ |
| `is_weekend` | Friday or Saturday (`dayofweek` 4, 5) → 9.2% | ✅ |
| `is_round_amount` | multiple of 100 and ≥ 100, checked on `amount_usd` in training (the original currency); **on SAR in the app** → 1,560 rows (0.75%) | ✅ |

- **Part A — earlier requests only (MF1):** sort by `expense_date`, `expense_id`; per group (emp, empcat, dept, deptcat, cat) and **per day**: cumulative n / sum / sum of squares of `log_amount`, minus the current day → mean and std of **earlier days only** (same-day requests don't see each other). Checked against a brute-force calculation: 0 mismatches on 1,500 values.
- **Part B — cold-start rule (MF1), N = `MIN_HISTORY` = 5:** for `amount_vs_employee_category` use the first level with ≥ 5 earlier requests: employee in category → employee → department in category → category → none (z = 0). Result: empcat 77.1%, emp 12.3%, deptcat 10.2%, cat 0.4%, none 131 rows. Saved as `baseline_level` (drives which amount reason is shown, Step 6).
  - `MIN_STD = 0.1` (spread floor) fixes employees who always paid the same amount (e.g. employee 2099 always 112.46 → spread 0 → infinite z-scores; 9.63 after the floor). `Z_CAP = 10` caps extremes. At the cap: 173 / 65 / 0.
  - Check: employee 3170, 744.90 SAR Transportation on 8 Dec (first time in the category) → 5.87 vs the employee, 0.69 vs the department, category share 0.00.
- **Part C — same-day counts use the whole day** (including requests created later that day). That matches the app: the backend re-scores the Pending same-day siblings (contract C3). Other days are never used.
  - Known cases for Step 8: **432** splits (3 requests in one category on one day, each under the limit, together over it), e.g. employee 1157 on 14 Jan 2026: 3 Food requests (544.61 + 688.84 + 787.80 = 2,021.25 > 2,000). Duplicate example: employee 1001, 1,322.25 Travel twice on 20 Aug 2025.
- **Where `MIN_HISTORY` lives in the app:** now in notebook 04 (chosen + tested); in Step 9 it moves to `src/features.py` (with `MIN_STD`, `Z_CAP`, the z-score and the cascade), imported by the notebooks and the service. **Changing N means rebuilding the features and retraining.**
- Dropped earlier: `vendor_freq`, `posting_delay` (backend has no vendor or posting date).

**Step 6 — Feature selection** ✅ (done 18 Nov)
- **Part A — bulk buyers:** "usual day" per employee = median requests per active day. 92% of employees usually send 1. 13 have ≥ 5 → same-category median 19 a day vs 1 for everyone else → would teach the model that splits are normal. **Decision A: remove them** (in notebook 04, cell 5.1b) → 209,012 requests; same-category count mean 6.35 → 2.76, max 164 → 80.
- **Part B — correlation** (rule: |r| ≥ 0.9 → keep one; Spearman agrees):
  - `log_amount` vs `amount_vs_department` **0.98** → departments have a similar normal (log means 5.4–6.7, spreads 1.3–1.9) → **dropped `amount_vs_department`**.
  - `amount_vs_employee` vs `amount_vs_employee_category` **0.92** → identical 20.8% of the time; "unusual" only vs the employee overall: 6 requests, only vs the category: 123 → **dropped `amount_vs_employee`** (still used inside the cascade).
  - `same_category_day_count` vs `daily_request_count` **0.97** (equal 81.3% of the time) → **replaced** by `other_category_day_count` (r = 0.07; > 0 for 18.7% of requests).
  - Highest pair left: `log_amount` / `amount_vs_employee_category` 0.75 → kept (big in general vs big for this person).
- **Part C — final 8 features:** `log_amount`, `amount_vs_employee_category`, `category_share_for_employee`, `same_category_day_count`, `duplicate_count`, `is_weekend`, `is_round_amount`, `other_category_day_count` → saved with the reason map in **`models/feature_list.json`** (in git; notebook 06 and the service read it).
- **Reason codes: all 10 kept**, each tied to one feature:

| Reason code | Feature | Only when |
|---|---|---|
| `large_amount` | `log_amount` | — |
| `amount_high_for_employee_category` | `amount_vs_employee_category` | `baseline_level` = empcat (77.1%) |
| `amount_high_for_employee` | `amount_vs_employee_category` | `baseline_level` = emp (12.3%) |
| `amount_high_for_department` | `amount_vs_employee_category` | `baseline_level` = deptcat (10.2%, new employees) |
| `unusual_category_for_employee` | `category_share_for_employee` | `baseline_level` in empcat / emp (89.3%: own history) |
| `possible_split_request` | `same_category_day_count` | — |
| `duplicate_request` | `duplicate_count` | — |
| `many_requests_same_day` | `other_category_day_count` | — |
| `weekend_expense` | `is_weekend` | — |
| `round_amount` | `is_round_amount` | — |

  - **When** a reason is shown (thresholds) is decided in Step 8.
  - Text changed (contract v0.4.2, stub too): `amount_high_for_department` → "Amount is much higher than usual for this department in this category" / "المبلغ أعلى بكثير من المعتاد في هذا القسم لهذه الفئة".
- No scaling/encoding needed (trees are scale-invariant; all features are numeric).

**Step 7 — Model training** ✅ (done 18 Nov) · notebook `06_model_training`
- **Part A — first model on all 8 features** (Isolation Forest, 200 trees, 256 requests per tree, `random_state=42`; score = `-score_samples` → 0–1, higher = more unusual, the contract's `score`). Cut-offs from review capacity: high = top 1%, medium = next 2%. **Three problems found:**
  1. **Busy days took over:** 74% of flags were days with 5+ same-category requests (long-tailed counts are isolated in few splits); amounts 5+ spreads above the person's normal: only 17% flagged.
  2. **Both tails:** amounts far *below* normal were flagged as often (16%) as far above.
  3. **Splits can't be learned from card data:** 0 of 100 planted splits (3 × 2,500–2,950 SAR Office Supplies, limit 3,000) caught; several purchases a day is normal on a PCard (45.7% of requests). Tested fixes (log counts, relative counts, a limit-aware day total) didn't change that.
- **Decision: hybrid design.** Model = what the data can teach (each person's normal amounts and categories, weekend, round). Rules = Masroof policy patterns the data treats as normal (split, duplicate, overloaded day). Same API.
- **Part B — final model:** 5 model features `log_amount`, `amount_vs_employee_category`, `category_share_for_employee`, `is_weekend`, `is_round_amount`; **one-sided** before the model (`log_amount` floor = median 5.8661 ≈ 352 SAR; `amount_vs_employee_category` floor 0). Reasons still use the real values.
  - Amounts 5+ spreads above normal: **99.7% flagged** (52% high); far below: 0.2%; busy days: 2.4%.
  - Typical high-risk request: ~6,400 SAR, 2.2 spreads above the person's normal, less-used category; 46% weekend (vs 9%), 38% round (vs 0.7%). Top flags are **combinations** (e.g. 1,125 SAR at the cap for the person + weekend; 18,750 SAR first-ever IT request).
  - **Stable on new months:** trained before Apr 2026 → on Apr–Jun: 1.02% high / 3.25% flagged (planned 1% / 3%).
- **Part C — 3 rules** (strict, because card data has many multi-purchase days; loose versions flagged 5–8%):
  - `possible_split_request`: 2–5 same-category requests on one day, each ≤ limit, total > limit, each ≥ 25% of the limit → 0.68%
  - `duplicate_request`: same amount + category + day, 2–3 copies, ≥ 1,000 SAR → 1.23%
  - `many_requests_same_day`: 8+ requests the same day in other categories → 0.38%
  - Uses the 6 category limits (copy of contract E5). Employee 1157's split and the planted split: all parts marked.
- **Final risk level:** high = model top 1% (careful check; rules don't add to it); medium = model's next 1% **or** any rule (quick look); low = rest → **1.00% high, 3.08% medium (≈4% flagged)**. 3% total is impossible (high 1% + rules-only 2.08% > 3%).
  - **Model and rules catch different requests:** model only 1.87%, rules only 2.08%, both 0.13% → the MF4 "why ML?" answer.
  - Per manager per week: biggest department (1,127 requests) **11 high + 30 medium**; typical (~84) **< 1 high + 2–4 medium**.
  - Caveat for the presentation: rules fire often on PCard because one card is swiped many times a day; in Masroof (one request at a time) they should be rarer.
- **Part D — saved:** `models/isolation_forest.joblib` (2.3 MB, the 7.9 model on all 209,012 requests) + `models/model_config.json` (`model_version` `iforest-0.1`, `trained_on` incl. **scikit-learn 1.9.1**, model/rule features, floors, cut-offs `high_from` 0.6639 / `medium_from` 0.6412 unrounded, rule settings, category limits, `feature_settings` 5 / 0.1 / 10). Reloaded → identical scores and levels.
- 📤 Share: proposal to the team (high 1%, ≈4% flagged in total). 📥 Get: their OK on review capacity.

**Step 8 — Evaluation + reasons**
- No labels → (1) read top flags, (2) check known cases, (3) **plant synthetic anomalies** (split requests under the policy max, huge weekend requests, duplicates) and measure detection rate.
- 🆕 **MF3 — unseen anomaly patterns:** two sets of planted anomalies, reported separately:
  - (a) **seen** — the patterns the features were designed for (splits, weekend, duplicates…);
  - (b) **unseen** — patterns made up by a teammate *without telling Jassar* (e.g. slowly rising amounts, a category the employee never uses at a normal amount, bursts at month-end).
- 🆕 **MF3 — honest metrics:** PCard rows are unlabeled → they are **not** confirmed normal. Report recall (detection rate) on planted anomalies + flag rate on real data. Call flagged real rows **"unverified"**, hand-check a sample. Do **not** report precision or false-alarm rate on real data as if it were known.
- 🆕 **MF4 — model vs rules vs both:** compare the Step 7 model alone, the Step 7 rules alone, and the hybrid on the same planted anomalies, **at the same number of flags**. Show what each catches that the other misses (Step 7 already shows they barely overlap: 0.13%).
- Compute which features made each request unusual → reason codes; finalize EN/AR texts.
- 📤 Share: reason texts, evaluation numbers/charts, demo cases. 📥 Get: frontend feedback on texts.
- ✅ **Results (Step 8, 19–23 Nov, notebook 07, cells 8.1–8.31):**
  - **Code moved to `src/features.py`** (v2): `build_features` (rebuilds `features.csv` with 0.0 difference), `model_input`, `apply_rules`, `risk_levels`, `find_bulk_buyers`, `digits_pattern`. The notebooks and (Step 9) the service import it.
  - **Reasons:** "what-if" test per request (set one feature back to its normal value; if the score drops ≥ 0.02 the feature is a reason) + a sanity check per reason; max 3; rules first; the amount code is picked by the cascade level the request was compared with (`baseline_level`).
  - **Seen planted anomalies** (6 patterns, planted in real history). "Too big" planted in **spreads** (k × the person's usual spread), because one employee's log spread is ≈1.29 (6–10× usual is often normal for them). At the same flag budget (hybrid flags 4.47% of real data):

    | System | Seen caught | Real flagged |
    |---|---|---|
    | **Hybrid** | **86%** | 4.47% |
    | Model only | 55% | same budget |
    | Rules only | 42% | same budget |
    | Policy rules (no ML: over limit, weekend, round…) | 94% | **16.43%** (3.7× the reviews) |

    Hybrid by pattern: too big 69% (k=2 → 4%, k=3 → 46%, k=4 → 94%, k≥5 → 100%), split 100%, duplicate 100%, new category + big 70%, weekend + round 100%, many requests 100%.
  - **Unseen round 1** (blind, made by an independent agent, `data/unseen/`): hybrid **0/126**, model only 2%, policy rules 12%; 0 of 25 normal controls flagged. Patterns: creeping escalation, cross-day duplicate, dormant reactivation, fixed monthly repeat, micro probe claims, patterned digits. → **3 new rules + codes:** `duplicate_recent_request` (same employee + category + amount within 1–7 days, ≥ 1,000 SAR), `unusual_amount_digits` (repeated / sequential digits as typed, ≥ 100), `returning_after_long_break` (first request after 90+ days). After the fix: dormant 100%, digits 64%, cross-day duplicate 9%.
  - **Unseen round 2** (blind, new agent, `data/unseen_round2/`, made *after* the fix): hybrid **1/142 (0.7%)** (via `returning_after_long_break`), policy rules 2%; 0 of 25 controls flagged. Patterns: colleague receipt reuse, daily personal meals, Eid holiday purchase, quarter-end budget burn, retail-price gadget, shared-bill double claim, weekend-stretched trip. **Honest limit:** these need context the data doesn't have (receipts, other employees' requests, calendar, prices) → future work, not more rules.
  - **Blind hand-check** (independent agent, 30 rows: 10 high, 10 medium, 10 unflagged controls, levels hidden; `data/evaluation/hand_check_review.csv`): high 1 suspicious / 2 can't tell / 7 normal; medium 1 / 1 / 8; low 0 / 0 / 10. The 2 suspicious: hotel 4,695 SAR on a weekend; 34,555 SAR, one of 6 same-day charges (the split rule caps at 5 parts). → flagged real rows are **"unverified"** (MF3); most look normal to a human without receipts.
  - **Final settings (`model_config.json`, `iforest-0.2`):** high = model top 1% (`high_from` 0.6639); medium = model next **0.5%** (`medium_from` 0.6513, `model_flag_share` 0.015) **or** any of 6 rules → **high 1.00%, medium 3.47%, low 95.52%**. Monthly flagged ≈3.5–4.3% (Jul–Dec 2025), ≈5.0–5.3% (Jan–Jun 2026); high ≈1% every month. Per week (Jan–Jun 2026): biggest department 11.3 high + 51.4 medium; median department 0.7 high + 3.8 medium. Departments 20 and 17 run ≈12% flagged (mostly same-day duplicates).
  - **Saved:** `models/evaluation_summary.json` (every number above, `ensure_ascii=False`).
  - **Known display issue (fix in Step 9 export):** in history, `round_amount` and digits are checked on the USD amount (e.g. 3,750 SAR = $1,000 → "round"). Show those reasons only if the SAR amount qualifies.

**Step 9 — Real ML service**
- ✅ Feature code already in `src/features.py` (Step 8). Real `predict.py` loads `isolation_forest.joblib` + `model_config.json` and calls `features.py`.
- The 3 time rules need each employee's last requests (same amount within 7 days, last request date) → the service keeps them in its saved stats (backend sends nothing new).
- **Pin `scikit-learn==1.9.1`** in `requirements.txt` (the saved model may not load in another version).
- ✅ Decided: the backend sends `category_limit` (optional) with each request (contract v0.4.5, B3 + C2). In Step 9: add `category_limit: Decimal | None = None` to `ScoreRequest` in `service.py` and pass it to the split rule; missing → `cfg["category_limits"]`. (The stub already accepts the field: pydantic ignores unknown fields.)
- Contract ✅ v0.4.4 says a split gives **medium**; the stub still forces high (testing hook) → the real service follows the config.
- Real `src/predict.py` behind the **same endpoints**; save model + per-employee/department/category stats.
- 🆕 **MF1:** saved stats = history up to the last training date; a new request is compared only with requests before it, and the cold-start rule from Step 5 is in `features.py` (same code for training and serving).
- **Saved stats format:** per group (employee, employee + category, department, department + category, category): **n, sum, sum of squares** of `log_amount` (stored next to the model in `models/`). New request → look up its groups → same cascade as Step 5 (an unknown new employee has n = 0 → department in category). After a request is saved, add it to the sums (updating = addition). Save the updated stats to the file so a restart doesn't lose them (enough for the demo).
- 📤 Share: the real service; backend runs `python -m app.rescore_ai --all` once. 📥 Get: integration test results.
- 🆕 **Progress (23 Nov, notebook 08_model_export):**
  - ✅ **Part A — history (cells 9.1–9.6):** `src/history.py` → class `History`: `from_requests` (bulk buyers left out), `request_features(...)` (one request, earlier days only, cascade, same-day counts from `same_day_requests`, time rules), `add` (same `expense_id` = replaced; ~5 ms), `save` / `load`. Saved **`models/history.joblib`** (209,012 requests, 1.47 MB). Dates **+21 weeks** (9.2: same weekdays, features identical). **Check 9.4: 1,599 requests (random + splits + repeats ≤ 7 days + new employees) → 0 differences out of 23,985 values vs `build_features`.** New employee → compared with the department (`deptcat`). With the move 21% of employees are 90+ days inactive on 25 Nov (= 20.5% on the real last day); without it 100%. `model_config.json` → `history` block (file, shift, from/to, requests).
  - ✅ **Part B — real `predict.py` (cells 9.7–9.10, outputs matched):** replaces the stub, same inputs/outputs. Loads model + config + history at import. Per request: `request_features` → model score + "what if" drops in **one model call** (`score_and_drops`) → the 6 rules on the request + its same-day requests (split total), **`category_limit` from the backend overrides ML's copy** → risk level → reasons (`explain`, ported from 8.4) → `HISTORY.add` (remember). Reason settings moved to `model_config.json` → `reasons` (normal values incl. median category share 0.5886, `min_drop` 0.02, `max_reasons` 3, `unusual_share` 0.2, `min_spreads` 1). Tested: 896 requests (512 flagged) → **same score, level and reasons as batch scoring**; ~32 ms per request (batch of 500 ≈ 16 s, under the 30 s timeout). Examples: 1,850 SAR Food on a Friday (usual ~58) → high (weekend + amount); 3 Food parts = 2,120 SAR → medium split with ML's 2,000 limit, low with `category_limit` 3,000; same Travel amount 3 days apart → `duplicate_recent_request`.
  - ✅ **Part C — the service (cells 9.11–9.13):** `service.py`: `category_limit` (optional, > 0) in `ScoreRequest`; `/health` → `history {requests, added_since_training, latest_date}`; turns on `use_added_file(data/service/added_requests.csv)` at start (git-ignored; loaded again after a restart; delete it to go back to the training history); marked spot at the end for Abdullah's `/forecast/*` routes. `predict.py`: a lock (one score at a time, the history never changes mid-score); `remember()` skips a request already in the history unchanged (re-scoring seed rows adds nothing). `history.py`: saved as plain numpy columns (loads with any pandas version; old file still loads, 9.11 re-saves it); `contains()`. `requirements.txt`: `scikit-learn==1.9.1`, `pandas>=3.0,<4`, `numpy>=2.0`. README notes. Tested with FastAPI's TestClient + a real `uvicorn` start: normal → low; unknown category → 422; `category_limit` 0 → 422; split medium → low with limit 3,000; receipt reused 3 days later → medium; edit = replaced; **batch of 500 ≈ 13–15 s**; 20 requests at the same time → no errors; restart keeps the remembered requests.
  - 🆕 **Finding (23 Nov): question (a) changed.** The service compares each request only with **earlier days** of its history, so re-scoring old seed requests through it gives the same result as training (9.9 proved it: history rows scored one by one = batch). No leakage → `rescore_ai` on the seed is **correct, just slow** (~200k × 30 ms ≈ 1.5–2 h). Pre-scored seed = a few minutes. Team file corrected; asked which they prefer.
  - ⬜ Part D — seed CSVs for the backend (same +21 weeks), pre-scored if the backend agrees (a); round/digits reasons on SAR for history.
  - ⬜ Part E — end-to-end test of the service + contract update (F1/F2: stub hooks gone).

**Step 10 — Demo request generator**
- Script that logs in as different employees and submits requests through the backend API, with planted suspicious ones at chosen moments.
- 📤 Share: script + demo script. 📥 Get: working endpoints; full rehearsal.

---

## 5. The ML service (contract v0.4.5 summary)

**Run:** `uvicorn src.service:app --port 8001 --reload` → docs at http://localhost:8001/docs
**Backend .env:** `AI_SERVICE_URL=http://localhost:8001`

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | status + model version |
| POST | `/anomaly/score` | score one request |
| POST | `/anomaly/score-batch` | up to 500 at once |
| GET | `/anomaly/categories` | the 6 accepted names |
| GET | `/anomaly/reasons` | all reason codes, EN + AR |

**Request:** `expense_id, requester_id, department_id (nullable), category, amount (SAR), expense_date, same_day_requests[]`, 🆕 `category_limit` (optional, the current limit from `expense_limits`; missing → ML's copy)
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

**Reason codes (13 after Step 8):** `amount_high_for_employee`, `amount_high_for_employee_category`, `amount_high_for_department`, `large_amount`, `unusual_category_for_employee`, `weekend_expense`, `round_amount`, `duplicate_request`, `possible_split_request`, `many_requests_same_day`, 🆕 `duplicate_recent_request`, `unusual_amount_digits`, `returning_after_long_break`.

**Risk cut-offs (Step 8, `iforest-0.2`):** high = model score ≥ 0.6639 (top 1%); medium = score ≥ 0.6513 (next 0.5%) **or** any of 6 rules (split, same-day duplicate, many requests, duplicate within 7 days, made-up digits, 90+ day break). 1.00% high + 3.47% medium (≈5% in recent months). The stub still uses 0.60 / 0.80 until Step 9.

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
│   └── processed/        pcard_clean.csv, requests.csv, departments.csv, users.csv, forecast_data.csv, features.csv (209,012 × 18)
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
│   ├── feature_list.json             (Step 6: the 8 features + reason map, in git)
│   ├── isolation_forest.joblib       (Step 7: the trained model, 2.3 MB, in git)
│   ├── model_config.json             (Steps 7–9: cut-offs, floors, rules, limits, version, history, reasons)
│   ├── evaluation_summary.json       (Step 8: every evaluation number)
│   └── history.joblib                (Step 9: the history the service keeps, dates +21 weeks, 1.5 MB, in git)
├── notebooks/
│   ├── 01_data_exploration.ipynb     ✅
│   ├── 02_data_cleaning.ipynb        ✅
│   ├── 03_localization.ipynb         ✅
│   ├── 04_feature_engineering.ipynb  ✅
│   ├── 05_feature_selection.ipynb    ✅
│   ├── 06_model_training.ipynb       ✅
│   ├── 07_evaluation.ipynb
│   └── 08_model_export.ipynb
├── src/
│   ├── service.py      (FastAPI app)
│   ├── predict.py      (✅ Step 9: the real scoring — replaced the stub)
│   ├── history.py      (✅ Step 9: the history the service keeps, one-request features)
│   └── features.py     (✅ Step 8: features + rules, used by training and serving)
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
| **Send the Step 4 handoff to the team** (+ the repo-check fixes in `masroof_changes_for_team.md`) | Jassar | ✅ Docs pushed + team told in the group (18 Nov) |
| Apply the ERD changes (section 1) | Backend | ✅ Final ERD (Abdulaziz, 18 Nov evening) has all 7. To confirm: the index on `expense (requester_id, expense_date)` is in their model |
| Push their real code to `backend/expense` | Backend | 🟡 First version pushed 18 Nov (Omar, in memory), **merged into `main`** with `backend/finance` (18 Nov, tests pass). The 4 AI fixes (contract C10) still open. Check again when MySQL + the ML call are added |
| `frontend/finance` (Majed) matches the final ERD | Frontend | ❌ 18 Nov: finance approval step, per-request AI with score %, no AI dashboard section, old categories, wrong limits (`/policies`, `is_allowed`), annual budgets → team file |
| Forecast API (Majed's proposal `GET /forecast?department_id=`) | Abdullah + backend + Majed | Open — also answers "same ML service or own URL?" |
| Update the contract to v0.4 | ML | ✅ Done 18 Nov → v0.4.1 (C10) → v0.4.2 (Step 6) → **v0.4.3** (final ERD: no `is_active` in `users.csv`, `warnings` = `[]` not null) |
| Are the 20 department names OK? How much history goes into the demo database? | Team / Backend | Asked (18 Nov), waiting for answers |
| Block or warn when a request is over its category limit? | Backend + team | Asked in `step4_handoff.md` |
| **Seed history pre-scored by ML** (AI columns filled in `expenses.csv`) or `rescore_ai` on ~200k old rows? 🆕 23 Nov: with the real service (Step 9) both give **correct** results (it compares each request only with earlier days, no leakage); `rescore_ai` just takes ~1.5–2 h vs a few minutes pre-scored. (The 20 Nov leakage concern was about whole-history stats, e.g. employee 3170: z 5.87 → 1.05; it doesn't apply to the row-level history.) | Backend | Asked again 23 Nov (team file corrected) |
| **Category limits are editable in the app** (Yousef's finance routes) → the ML split rule's copy in `model_config.json` would go out of date. Fix: backend sends `category_limit` with each score request (optional field, contract B3, code in C2); ML falls back to its copy if missing | Jassar → backend | ✅ Decided 23 Nov (contract v0.4.5). Backend to add the field to `_payload` |
| Merge `ml/stub-service` into `main` (Pull Request) | Jassar → a teammate merges | 🟡 PR open (main merged into the branch first; 29 files, additions only) |
| How many flags can managers review? 🆕 MF4: mentors require it | Team | Proposed: high = top 1% (≈11 careful checks/week for the biggest manager). After Step 8: ≈4.5% flagged overall, **≈5% in recent months** (above the ≈4% first proposed) → tell the team; used as the default; waiting for OK |
| 🆕 MF1: Confirm N for the cold-start rule (proposed 5) | ML | ✅ N = 5 (`MIN_HISTORY`), Step 5 |
| The 13 very busy employees (15.7% of rows): drop from training or add a "vs usual day" count? | ML | ✅ Removed (Step 6, option A); also left out of the seed |

---

## 9. Things to remember (gotchas)

- **Training–serving consistency:** the backend must compute features exactly like the notebooks → one shared `features.py`.
- **Cold start:** a new employee/company has no history → compare to department, then category; seed the demo with PCard history. 🆕 MF1: exact rule done in Step 5 (N = 5, cascade empcat → emp → deptcat → cat).
- 🆕 **MF1 — leakage:** every stat uses only requests from **earlier days** (day-level cumulative sums minus the current day). Whole-year averages = leakage. Same-day counts are the one exception on purpose (whole day, matched by re-scoring siblings).
- **Zero spread:** always clip the std (`MIN_STD = 0.1`) and cap z (`Z_CAP = 10`), in training and serving.
- **Round amounts:** training checks `amount_usd`, the service checks SAR (both = the amount as originally written).
- **Bulk buyers:** the 13 removed employees must stay out of the seed files too, otherwise their 20–30 requests a day would be flagged all the time in the demo.
- **One feature list:** `models/feature_list.json` is the only place the 8 features are listed; notebook 06 and the service read it (don't re-type the list).
- **Isolation Forest isolates both ends and loves long tails:** make features one-sided when only one direction is suspicious, and keep long-tailed counts out of the forest (rules instead).
- **The model learns what's rare in the training data, not what's against policy:** splits are normal on a company card → rules for policy patterns.
- **Model + config travel together:** `isolation_forest.joblib` and `model_config.json` must come from the same training run; bump `model_version` on every retrain, then `rescore_ai --all`.
- **scikit-learn version** must match the one in `model_config.json` (1.9.1).
- **Saving to Jassar's computer:** always read the file back after a save and compare (one save on 18 Nov reported success but wrote an old version).
- **Split requests** only become visible once later requests arrive → re-score same-day siblings.
- **No labels** → evaluate with planted anomalies, not accuracy. 🆕 MF3: include unseen patterns; unlabeled ≠ normal → no precision / false-alarm claims on real data.
- **Unseen sets and the hand-check are made by independent agents** and their answer files are opened only after results are saved. Guard the save cells (8.17, 8.24): `if not os.path.exists(path): results.to_csv(...)` — a rerun once overwrote the round-1 blind results.
- **Plant "too big" in spreads, not multiples:** an employee's usual spread is wide (log std ≈1.29), so 6–10× usual can be normal.
- **Round / digits checks use the amount as typed** (`amount_usd` in history, SAR in the service) and digits only from 100 up ($99.99 → 374.96 SAR is not "made up").
- **pandas 3:** `stack()` keeps NaN → build pairs with `itertools.combinations`.
- **History dates are moved +21 weeks** (Step 9): `requests.csv` / `features.csv` keep the original dates (training); `history.joblib` and the seed files use the moved dates. Anything compared with the service's history must be moved too.
- **`history.add` must stay cheap** (it runs after every score): only prepare the new rows, don't rebuild/re-sort all 209k (that took 250 ms per request; now ~5 ms).
- **`predict.py` loads the config at import:** after changing `model_config.json` in a notebook, `importlib.reload(src.predict)` (or restart the kernel after changing `src/` files).
- **The service writes `data/service/added_requests.csv`** (every request it scores). Test requests end up there too → delete the file after testing (9.13), before the demo.
- **Saving to Jassar's computer:** use a NEW staged folder for every save (reusing a path wrote an old version again on 18 Nov and 23 Nov) and compare after.
- **Merging `main` into `ml/stub-service`:** `git merge origin/main` then `git checkout origin/main -- api frontend` (the branch deleted the old api skeleton → 18 modify/delete conflicts).
- **Honest caveats for the presentation:** PCard is card purchases (US government, 2014), not requests; seasons are American (no Ramadan/Eid pattern); ~32% of data excluded (no "Other" category).
- **Contract changes** go through ML first; bump the version.

---

## 10. 🆕 Mentor feedback (16 Nov)

All 5 comments are about AI/ML.

| # | What the mentors asked | Were we already doing it? | What changes | Owner | Where |
|---|---|---|---|---|---|
| **MF1** | Build employee spending features from **prior transactions only**; define handling for **new employees** | ❌ Prior-only: **not planned** (stats were going to be whole-history). 🟡 New employees: **partly** (fallback to department under 5 purchases, but no exact rule) | ✅ **Done in Step 5 (18 Nov):** earlier-days-only stats (verified by brute force), written cascade rule with N = 5. Remaining: same code in serving (`features.py`, Step 9) | Jassar | Steps 5, 9; gotchas |
| **MF2** | Specify the **forecasting model and horizon**; compare with a **last-week baseline** using **rolling validation** and numeric **MAE targets** | ❓ Not in this brief (forecasting teammate's part) | Teammate defines model + horizon, naive last-week baseline, walk-forward validation, MAE target in SAR | Forecasting teammate | Section 8 |
| **MF3** | Test **unseen** synthetic anomaly patterns; don't treat unlabeled purchases as **confirmed normal** when reporting false alarms / precision | 🟡 **Partly**: planting anomalies + detection rate was planned; unseen patterns and the reporting rule were not | ✅ **Done in Step 8 (23 Nov):** seen 86%; 2 blind unseen rounds (0% → 3 new rules → round 2 0.7%, honest limit); recall + flag rate only; blind hand-check; flagged real rows = "unverified" | Jassar (+ a teammate to make the unseen set) | Step 8; gotchas |
| **MF4** | Set **risk thresholds against review capacity**; compare Isolation Forest with **simple spending-policy rules** | 🟡 Thresholds: **planned** (Step 7 asked for review capacity). ❌ Rules comparison: **not planned** | ✅ **Step 7 (18 Nov):** cut-offs from capacity (high = top 1%, team to confirm); rules combined with the model (hybrid). ✅ **Step 8 (23 Nov):** model 55% vs rules 42% vs hybrid 86% at the same flag budget; policy rules 94% but 16.4% flagged | Jassar (+ team for the capacity number) | Steps 7, 8; sections 5, 8 |
| **MF5** | *GenAI option:* extract receipt fields with a **multimodal model**; require **human confirmation** and **redaction** of sensitive info before external processing | ❓ **Not assigned** (open question "who builds receipt reading?") | Optional. Employee confirms extracted fields; blur/remove names, card numbers, IDs before sending to an outside API. Idea: receipt amount ≠ claimed amount → new reason code | Team decides | Section 8 |

**Summary:**
- ✅ Already planned: thresholds from review capacity (MF4), planting anomalies (MF3), department fallback for new employees (MF1).
- ✅ Done: prior-only stats + exact cold-start rule (MF1, Step 5).
- ✅ Done: cut-offs from review capacity + rules (MF4, Step 7).
- ✅ Done: unseen anomaly sets + honest reporting (MF3), rules baseline comparison (MF4), Step 8.
- ➡️ Not Jassar's: forecasting (MF2, teammate), receipt GenAI (MF5, optional, team decides).

---

## 11. Repo check (18 Nov)

**22 Nov check (03:30):**
- **`backend/expense` (Omar, 20 Nov 21:40, not merged):** "Connect expense workflow to MySQL". ✅ Expenses in MySQL with login; only employees create (managers blocked, C4); `category_id` (C10 #4 fixed); warnings from limits + budget; edit endpoint (Pending only) that **clears the AI columns** when details change; approve / reject save `reviewed_by`, `reviewed_at`, `manager_note`; receipts (upload, required before approval); finance can't see single expenses (correct). ⚠️ Branch is based on the old 18 Nov commit and imports `app.models` (main) + `app.routes.finance.approved_spent` (Yousef's branch) → must be merged with `main` + `backend/finance-routes` to run.
  - ❌ **Still no ML call:** no `ai_client`, no `anomaly_service`, no background task, no `rescore_ai` → AI columns always empty.
  - ❌ **Response exposes `anomaly_score` and `risk_level` to every role** (employee included) and has **no reasons** (`risk_justification` not returned). Contract C7: only the department's manager gets `ai = {risk_level, reasons}`, never the score.
  - ❌ Queue sort (C8): ordered by id only. Old `anomaly_result` code still in `decision_engine` / `expense_service` (unused now).
- **`backend/finance-routes` (Yousef, 21 Nov 01:47, not merged):** ✅ **C9 done**: `GET /dashboard/finance/anomalies?year=&month=` → counts (high/medium/low/not_scored), flagged % per department, top 5 reasons (EN+AR) — exactly the shape Majed's dashboard calls.
- **`main` (Ziyad, 21 Nov):** UI improvements only. ❌ Manager `RiskAlertBox` unchanged (score %, `ai_analysis`). ❌ `/api/v1` prefix and `finance` role still mismatched. `USE_MOCK = true`.
- **`ml/stub-service`:** no change; **no PR into `main` yet**; the 20 Nov brief / team-file updates are only local (not pushed).
- **Local folder:** nothing new since Step 7 (notebooks 07, 08 still placeholders; `src/features.py` placeholder; models from Step 7).

**20 Nov check (19:30):**
- New: `main` ← Ziyad's notifications / profile / reports (no AI exposed, ✅); `backend/finance-routes` (Yousef, not merged): MySQL routes for departments, budgets (+ usage), **editable category limits**.
- Already in place: DB columns + index + categories + `ai_service_url` (`main`, from `backend/auth-and-db`, 18 Nov); Majed's finance AI dashboard (C9/D4).
- Still missing for the AI: backend C2–C4, C6–C9 + C10 fixes (expenses still in memory); Ziyad's manager AI box (score % still shown, `ai_analysis` shape) + queue badge; `ml/stub-service` still not in `main` (no PR).
- Non-AI blockers (sent as reminders in the team file): frontend `/api/v1` prefix vs none in the backend; frontend role `finance` vs backend `finance_admin`; merge `backend/finance-routes`.
- Written for the team in `masroof_changes_for_team.md` → "Repo check — 20 Nov".

**19 Nov check (morning):** `main` got `backend/auth-and-db` (MySQL models matching the ERD, auth, categories at startup, `ai_service_url`) and both frontends (finance follows the contract; manager AI box doesn't).


**Evening check (18 Nov, ~17:30):**
- **Final ERD (Abdulaziz):** ✅ all 7 agreed changes in. ML side adjusted (contract v0.4.3): no `is_active` in `users.csv`; `warnings` saved as `[]`, never null. Backend to confirm the `(requester_id, expense_date)` index.
- **`main`:** `backend/expense` + `backend/finance` merged (PR #1, #2). Tests pass. ❌ Contract C10 AI fixes not done.
- **`frontend/finance` (Majed, new, 16:36):** built on the old flow: finance approves (payout queue, `pending_finance`), `RiskAlertBox` with "Anomaly score: 78%" for finance, no AI dashboard section, old 5 categories, limits 1,500/2,500/1,000/3,000 via `/policies` + `is_allowed`, annual budgets. Proposes `GET /forecast?department_id=` (8 weeks history, 4 predicted, last-week baseline) → for Abdullah.
- **`ml/stub-service`:** the 15:18 push had the **old** docs (a save to Jassar's computer didn't land; re-saved + verified at 17:20) → push again.
- Unchanged: `frontend/employee-manager` (4 mismatches), `ml/forecasting` (data in git).
- All written for the team in `masroof_changes_for_team.md` → "Repo check — 18 Nov (evening)".

**Morning check:**

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
