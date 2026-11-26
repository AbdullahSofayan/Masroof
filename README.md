# Testing an expense from submission to review

This guide is for teammates who want to check the Masroof expense workflow locally. Use a checkout with the shared backend, Finance routes, expense changes, and the anomaly detection service with its model files.

## Get the API running

Open PowerShell in the repository root and run:

```powershell
cd .\api
docker compose up -d --wait
docker compose ps
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Reuse the virtual environment if you already have one. In the same terminal, set the database password and host port to match your Compose setup, then start FastAPI:

```powershell
$env:DATABASE_URL = 'mysql+pymysql://masroof:<password>@127.0.0.1:<host-port>/masroof?charset=utf8mb4'
$env:AI_SERVICE_URL = 'http://127.0.0.1:8001'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Keep the terminal open and check that [the backend is running](http://localhost:8000/health). You can explore the expense endpoints in [Swagger](http://localhost:8000/docs).

## Start scoring in a second terminal

From the repository root, change to the folder containing the anomaly detection service's `src/service.py`. Use the matching Python path for your checkout:

```powershell
# If the service is under ml/
cd .\ml
$python = Resolve-Path ..\api\.venv\Scripts\python.exe
```

```powershell
# If the service is under api/ml/
cd .\api\ml
$python = Resolve-Path ..\.venv\Scripts\python.exe
```

Then run:

```powershell
& $python -m pip install -r requirements.txt
& $python -m uvicorn src.service:app --port 8001
```

Check [the model version](http://localhost:8001/health) before sending a request.

## Walk through one request

Use a test employee and manager from the same department.

1. Sign in as the employee and submit a request using an existing category. The request starts as `pending`. Upload a JPG, PNG, or PDF receipt up to 5 MB. The upload endpoint is `POST /expenses/{id}/attachment` with multipart field `file`.
2. Open the request again via `GET /expenses/{id}`. The first response can have empty AI fields because scoring runs in the background after saving. Once it finishes, the response includes `risk_level`, `anomaly_score`, and `ai_analysis`. The manager's review page uses `ai_analysis` to display the risk level and any reasons.
3. Edit the pending request and open it again after scoring finishes. A change to the amount, category, or date also refreshes the financial warnings.
4. Switch to the manager and approve the request with its receipt, or reject it with a note. The employee can reopen it to check the final status. Only an approved request contributes to actual department spending.

If the request saves but the AI fields stay empty, check the anomaly service health and the backend terminal for scoring errors.
