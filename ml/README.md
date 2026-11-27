# Masroof — ML (Anomaly Detection)

Isolation Forest that scores expense requests for the Masroof platform.
Trained on the Oklahoma Purchase Card (PCard) FY2014 dataset, mapped to Masroof's
6 categories and localized to Saudi Arabia (SAR, Fri–Sat weekend).
Served to the backend (`api/`) as a small FastAPI service. See `docs/ml_contract.md`.

## Run the service

    pip install -r requirements.txt
    uvicorn src.service:app --port 8001 --reload

## Work on the notebooks

    pip install -r requirements-notebooks.txt

Docs: http://localhost:8001/docs · Backend `.env`: `AI_SERVICE_URL=http://localhost:8001`

## Steps

| # | Step | Where | Output |
|---|------|-------|--------|
| 1 | Data Exploration | notebooks/01_data_exploration | — |
| 2 | Data Cleaning | notebooks/02_data_cleaning | data/processed/pcard_clean.csv |
| 3 | Team Contract + Stub | docs/ml_contract.md, src/service.py, src/predict.py | stub ML service |
| 4 | Category Mapping + Localization | notebooks/03_localization | data/processed/requests.csv + seed files |
| 5 | Feature Engineering | notebooks/04_feature_engineering | data/processed/features.csv |
| 6 | Feature Selection | notebooks/05_feature_selection | final feature list |
| 7 | Model Training | notebooks/06_model_training | models/isolation_forest.joblib |
| 8 | Evaluation + Reasons | notebooks/07_evaluation | evaluation results, final reason texts |
| 9 | ML Service (real model) | notebooks/08_model_export, src/ | src/features.py, src/predict.py, models/ |
| 10 | Demo Request Generator | src/demo_generator.py | live demo through the backend API |

## Notes

- Do not commit `data/` (it is in .gitignore).
- Category names must match the backend's `categories.name` exactly.
- The service needs `models/isolation_forest.joblib`, `models/model_config.json` and `models/history.joblib`
  (the history it compares new requests with; dates moved +21 weeks, see the config's `history` block).
- Requests the service scores are added to that history and written to `data/service/added_requests.csv`,
  so a restart doesn't forget them. Delete that file to go back to the training history only.
- `scikit-learn` must stay at the version in `requirements.txt` (the saved model may not load in another).
