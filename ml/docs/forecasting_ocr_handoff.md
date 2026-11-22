# Masroof — Forecasting & Invoice OCR Handoff

**Owner:** Forecasting + Invoice OCR (Abdullah)  
**Review date:** 22 November 2026  
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

## 2. Current forecasting work and next steps

- `ml/forecasting` already contains `ml/notebooks/forecasting.ipynb`, with direct multi-output Linear Regression, four weekly targets, a last-week baseline, and expanding-window rolling validation. Verify notebook execution and report its actual current results.
- If Random Forest is tried, compare with the **same departments, rolling forecast origins, four horizons, and MAE computation**. Do not claim it is better without measured results.
- Choose the final model from validation results. Export its model artifact and any feature-order/department encoding required at inference time.
- Implement forecasting inference separately from training, suggested `ml/src/forecast.py`. Do not create another unrelated application or modify the anomaly scoring implementation.
- Coordinate with Backend and Finance frontend on historical spending refresh. A model that reads only static CSV history will not automatically reflect new approved expenses in MySQL.
- Current Finance frontend has a proposed **backend** route `GET /forecast?department_id=` and a response containing `department_id`, `model`, `generated_for_week`, eight history weeks, four forecast weeks, and `baseline_last_week`. This is a proposal/mock, not evidence that the production backend endpoint exists.
- Agree with Jassar whether forecasting joins the existing **ML service** (e.g., `/forecast/predict` on port 8001) before changing `ml/src/service.py`. Frontend should call backend, backend should call ML, not frontend directly to ML.

## 3. Invoice scanner with OCR: scope and plan

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
    │   └── forecasting.joblib      # Only after final model export
    ├── src/
    │   ├── features.py              # Jassar
    │   ├── predict.py               # Jassar anomaly scoring
    │   ├── service.py               # Shared ML HTTP service; edit by agreement
    │   ├── forecast.py              # Proposed future forecasting inference
    │   └── receipt_ocr.py           # Proposed future OCR extraction
    ├── requirements.txt
    └── requirements-notebooks.txt
```

`forecast.py`, `receipt_ocr.py`, the forecast model export and OCR endpoints above are **proposals**, not completed files in Jassar's branch.

## 5. Branch and merge guidance

- Continue developing on **`ml/forecasting`**, not Jassar's `ml/stub-service`.
- As of this review, Jassar's **PR #6 (`ml/stub-service` → `main`) is open** and adds the `ml/` structure. Prefer that PR be reviewed/merged first.
- Then update `ml/forecasting` from the latest `main` and resolve overlaps carefully, keeping my notebook and Jassar's service files. Do **not** merge Jassar's work-in-progress branch into mine just to obtain the folder layout unless the team explicitly decides to do so.
- Existing branch `ml/forecasting` contains `forecast_data.csv` and `departments.csv` tracked by Git: remove them from tracking while keeping local files and add `ml/data/` to `.gitignore` before opening my PR. If the repository was public and sensitive information was committed, merely untracking does not erase old Git history; discuss whether history cleanup is needed.
- Open my PR into `main` after the model, OCR experiments and API contracts are reviewed. Coordinate any edits to shared `ml/src/service.py` and dependency lists.

## 6. Decisions requiring team agreement

| Decision | Owners | Status |
|---|---|---|
| Select the forecasting model using rolling MAE on identical origins | Forecasting | Pending measured comparison |
| Next **four Sunday-to-Saturday** weeks and history freshness | Forecasting, Finance frontend | Proposed |
| Backend `GET /forecast` JSON and ML `/forecast/*` endpoint | Forecasting, Backend, Majed, Jassar | Open |
| Update inference data from approved MySQL expenses | Forecasting, Backend | Open |
| Receipt upload, secure storage and authorization | Backend, Employee frontend, OCR | Open |
| Local OCR engine vs optional external multimodal model | OCR, team | Open |
| OCR response schema, human confirmation, and redaction | OCR, Backend, frontend | Open |
