# Masroof — Forecasting & Invoice OCR Handoff

**Owner:** Forecasting + Invoice OCR (Abdullah)  
**Updated:** 22 November 2026 — Forecasting inference module accepted; OCR deferred  
**Sources:** `ml/stub-service` branch, `ml/docs/team/step4_handoff.md`, `ml/docs/team/masroof_changes_for_team.md`, `ml/docs/ml_contract.md`; `ml/forecasting` branch; frontend `financeApi.js`.

> These are handoff notes and proposed integration decisions, not a finalized API contract. Do not change Jassar's anomaly-detection code without coordination.

## 1. Notes from Jassar relevant to forecasting

- Use the same localized expense history as anomaly detection, so the figures displayed for departmental spend remain consistent.
- Inputs: `ml/data/forecast_data.csv` (`expense_date`, `department_id`, `category`, `amount_sar`) and `ml/data/departments.csv`. Data comprises 247,838 transactions from 20 departments and six categories.
- Use data from **2025-06-29 onward**. Examine incomplete start/end weeks and missing department-week combinations rather than silently filling them with zeros.
- Approximately one year of history is available. Annual seasonality cannot be validated reliably; the shifted dates and localized SAR amounts do not make this real Saudi company spending, and US holiday spending patterns remain.
- Do not commit datasets to the public Git repository. The `ml/forecasting` branch currently tracks two files under `ml/data/`; remove them from Git tracking *without deleting local copies*, and ignore `ml/data/` before the PR.
- Keep the forecasting notebook named distinctly from Jassar's anomaly notebooks.
- Mentor feedback MF2: specify model and four-week forecast horizon; compare against last-week baseline using rolling validation; report numeric MAE in SAR and a measurable target.

## 2. Forecasting implementation status — 22 Nov 2026

**Chosen model: Linear Regression.** The owner confirmed `ml/src/forecast.py` is the implementation to keep; **do not replace it with Random Forest or rewrite it without a new decision**. Its example is protected by `if __name__ == "__main__":`, so importing the module does not trigger the sample forecast.

### Completed locally / evidenced by current notebook and owner tests

| Component | Status / evidence |
|---|---|
| Source data | Jassar's localized `forecast_data.csv` + `departments.csv` |
| Preprocessing | Sunday–Saturday weekly department totals; missing department-weeks are not silently filled with zero |
| Features | Last four weekly totals: `lag_1`–`lag_4` plus one-hot department ID |
| Model & horizon | Direct multi-output Linear Regression, four separate next-week predictions (weeks 1–4) |
| Baseline | Last completed week's total repeated for each of the next four weeks |
| Evaluation | Expanding-window rolling validation; the last 12 eligible forecast origins in the notebook |
| Baseline overall MAE | **124,677.26 SAR** |
| Linear Regression overall MAE | **115,676.39 SAR**, roughly **7.22%** better than the baseline |
| Numeric MAE target | **112,209.53 SAR** (baseline MAE × 0.90) — **NOT achieved** |
| Model export | Owner reported `Model saved successfully!` when exporting `forecasting.joblib` locally; must verify file presence in the integration checkout |
| Inference | `ml/src/forecast.py` loads saved model + feature ordering and predicts four weeks; owner successfully tested department 1 with actual historical weekly totals |
| OCR | **Not started; intentionally postponed until after Forecasting integration** |

**Local inference smoke test (department ID 1; oldest → newest):**

- Historical 4-week inputs (SAR): `[1481641.84, 1169765.42, 1267278.02, 1464812.92]`.
- Observed output reported by owner (SAR): `[1332121.42, 1272020.17, 1323753.14, 1295143.25]`.
- These outputs are a **sanity check**, not ground-truth future expenses and not proof of accuracy.

### Accepted `forecast.py` responsibilities

- Signature: `predict_next_four_weeks(department_id, last_four_weeks)`.
- Takes **exactly four completed, consecutive weeks**, ordered **oldest to newest**; expects **SAR** totals derived from the same localized and approved source history.
- Internally maps input to `lag_1` = most recent and `lag_4` = oldest; uses saved `department_ids` categories and `feature_columns` feature order.
- Returns a list of four weekly expense predictions rounded to two decimals, with **negative outputs clipped to zero**.
- Does **not** query MySQL, aggregate dates, validate calendar gaps, serve an HTTP route, or retrain the model.

### Remaining before Forecasting is integrated into Masroof

1. **Validate the input history contract:** Backend must fetch **approved** expenses, group by department, use the same localized SAR amounts and **completed Sunday–Saturday weeks** as training, order four consecutive weeks oldest → newest, and distinguish missing data from actual zero spending. Do not double-count seeded history + imported CSV copies.
2. **Agree on APIs with Jassar + Backend + Majed:** Finance frontend currently proposes **backend `GET /forecast?department_id=...`**. Decide the corresponding **ML service `/forecast/*`** endpoint (suggested: `POST /forecast/predict`), request/response fields, and where the 8 history weeks and four dated predictions come from. The endpoint is **not implemented yet**.
3. **Hook up and test end-to-end:** Backend → historical spending data → ML service → model inference → Finance Forecast page. Test missing weeks, unknown departments, stale history, invalid requests and response dates.
4. **Fix or consciously document two remaining validation mismatches:** (a) the final code still uses `int(department_id)`, which silently coerces values like `1.9` or `True`; add strict ID validation before production, and (b) inference **clips negative predictions**, whereas the current notebook MAE was computed from **raw predictions**. Recalculate MAE with clipping if it will be the deployed policy, without changing the target after seeing the results.
5. **Ship artifacts and source files through the team's Git process:** Ensure the `forecasting.joblib` artifact and corresponding training-feature metadata actually reach the target runtime, and resolve branch/merge and data-file-tracking issues below.

**Scope judgment:** the **initial notebook model, validation, saved-model export, and local inference are done**. The **Forecasting feature is not fully delivered** until steps 1–5 above are finished and the Finance page uses real predictions. Do not start OCR integration before these are stable.

## 3. Invoice scanner with OCR — DEFERRED, not started

- Jassar's contract identifies **receipt reading as an open/unassigned optional capability**, not something his anomaly model implements. The mentor's optional GenAI suggestion requires **human confirmation** of extracted fields and **redaction before processing by any external provider**.
- For the MVP, start with a local OCR library such as Tesseract or EasyOCR. Do not train a custom model unless basic OCR proves inadequate. A separate set of legitimate test receipt images is needed: the transaction CSVs **do not contain receipt pictures**.
- Extract **merchant, date and total amount (SAR)**. Return missing values when confidence is insufficient; never fabricate values. Be aware that multiple subtotal/tax/total fields, Arabic receipts and image quality can cause errors.
- Employee uploads a receipt; backend validates image type/size and access; OCR reads it and returns suggested fields; the employee **reviews and confirms/edits** fields before submitting. Compare extracted amount with manually entered amount and show a mismatch warning.
- Do not confuse OCR mismatches with anomaly risk classification or automatically approve/reject expense requests.
- Use private, permitted receipt images; do not commit actual private receipts. If external multimodal processing is introduced, redact payment/personal details before uploading, and confirm data/privacy handling with the team.
- Once an API contract is agreed, suggested ML logic file: `ml/src/receipt_ocr.py`. Suggested ML endpoint: `POST /receipt/extract`, **called by the backend**. Agree on response fields, failure behavior, file handling and authorization before coding.
- Evaluate extraction on sample receipts, including field-level correctness and common failure cases. Keep it a small separate experiment from forecasting.

## 4. Proposed combined project structure (after ML integration)

```text
Masroof/
├── api/                             # Team backend, authentication, DB, receipt upload
├── frontend/                        # React employee + finance interfaces
└── ml/
    ├── data/                        # LOCAL ONLY; ignored by Git
    │   ├── forecast_data.csv
    │   ├── departments.csv
    │   └── receipts/               # Local OCR test images
    ├── docs/
    │   ├── ml_contract.md           # Jassar anomaly contract
    │   └── team/
    │       ├── step4_handoff.md
    │       ├── masroof_changes_for_team.md
    │       └── forecasting_ocr_handoff.md  # My handoff
    ├── notebooks/
    │   ├── 01_data_exploration.ipynb # Jassar and other anomaly notebooks
    │   └── forecasting.ipynb        # My experiments/validation
    ├── models/
    │   ├── isolation_forest.joblib  # Jassar
    │   └── forecasting.joblib      # Exported locally; verify model artifact in integration checkout
    ├── src/
    │   ├── features.py              # Jassar
    │   ├── predict.py               # Jassar anomaly scoring
    │   ├── service.py               # Shared ML HTTP service; edit by agreement
    │   ├── forecast.py              # Final local inference module (Linear Regression)
    │   └── receipt_ocr.py           # Proposed future OCR extraction
    ├── requirements.txt
    └── requirements-notebooks.txt
```

The forecasting notebook, local exported model, and `forecast.py` are now **completed in the forecasting owner's local workspace**; they are not asserted to be present on Jassar's branch or deployed. `receipt_ocr.py` and the proposed `/forecast/*` and `/receipt/*` endpoints are **not implemented**.

## 5. Branch and merge guidance

- Continue developing on **`ml/forecasting`**, not Jassar's `ml/stub-service`.
- As of this review, Jassar's **PR #6 (`ml/stub-service` → `main`) is open** and adds the `ml/` structure. Prefer that PR be reviewed/merged first.
- Then update `ml/forecasting` from the latest `main` and resolve overlaps carefully, keeping my notebook and Jassar's service files. Do **not** merge Jassar's work-in-progress branch into mine just to obtain the folder layout unless the team explicitly decides to do so.
- Existing branch `ml/forecasting` contains `forecast_data.csv` and `departments.csv` tracked by Git: remove them from tracking while keeping local files and add `ml/data/` to `.gitignore` before opening my PR. If the repository was public and sensitive information was committed, merely untracking does not erase old Git history; discuss whether history cleanup is needed.
- Open a **Forecasting-focused PR** into `main` after forecast API/data integration and review; **OCR does not need to block this PR**. Implement OCR later in a separate commit/PR. Coordinate edits to shared `ml/src/service.py` and dependency lists.

## 6. Decisions requiring team agreement

| Decision | Owners | Status |
|---|---|---|
| Select the forecasting model using rolling MAE on identical origins | Forecasting | **Chosen: Linear Regression**; verified against last-week baseline; MAE goal not met |
| Next **four Sunday-to-Saturday** weeks and history freshness | Forecasting, Finance frontend | Horizon fixed; live history/refresh strategy open |
| Backend `GET /forecast` JSON and ML `/forecast/*` endpoint | Forecasting, Backend, Majed, Jassar | Open |
| Update inference data from approved MySQL expenses | Forecasting, Backend | Open |
| Receipt upload, secure storage and authorization | Backend, Employee frontend, OCR | Open |
| Local OCR engine vs optional external multimodal model | OCR, team | Open |
| OCR response schema, human confirmation, and redaction | OCR, Backend, frontend | Open |
