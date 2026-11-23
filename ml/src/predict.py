"""
Anomaly scoring for Masroof expense requests: the REAL model (Step 9).

Same inputs and outputs as the stub it replaces (contract Part B), so nothing outside this folder changes.
Pure Python (no web framework, no database); src/service.py wraps it as an HTTP service.

For one request:
  1. features from the history the service keeps (src/history.py): earlier days only (MF1)
  2. the Isolation Forest score (5 one-sided features, Step 7)
  3. the 6 rules (Steps 7-8), with the category limit the backend sends (contract B3, v0.4.5)
  4. risk level: high = model's top 1%; medium = model's next 0.5% or any rule (Step 8)
  5. reasons: rules first, then the model features that made it unusual ("what if" test, Step 8)
  6. the request is remembered, so later requests are compared with it too
"""

import csv
import json
import threading
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from src import features as F
from src.history import CATEGORIES, History

MODELS = Path(__file__).resolve().parent.parent / "models"
with open(MODELS / "model_config.json", encoding="utf-8") as fh:
    CONFIG = json.load(fh)
MODEL = joblib.load(MODELS / "isolation_forest.joblib")
HISTORY = History.load(MODELS / CONFIG["history"]["file"])
MODEL_VERSION = CONFIG["model_version"]
TRAINING_REQUESTS = len(HISTORY.rows)

# Requests the service has scored are also written to a file (git-ignored), so a restart doesn't
# forget them. Off by default: only the service turns it on (use_added_file); notebook checks don't.
ADDED_FILE = None
_LOCK = threading.Lock()      # the backend may score several requests at the same time

# code -> (English, Arabic). 10 codes after Step 6 + 3 added in Step 8 (unseen test, round 1).
REASONS = {
    "amount_high_for_employee": (
        "Amount is much higher than this employee's usual requests",
        "المبلغ أعلى بكثير من معدل طلبات هذا الموظف"),
    "amount_high_for_employee_category": (
        "Amount is much higher than this employee usually requests in this category",
        "المبلغ أعلى بكثير مما يطلبه هذا الموظف عادةً في هذه الفئة"),
    "amount_high_for_department": (
        "Amount is much higher than usual for this department in this category",
        "المبلغ أعلى بكثير من المعتاد في هذا القسم لهذه الفئة"),
    "large_amount": (
        "Very large amount",
        "مبلغ كبير جداً"),
    "unusual_category_for_employee": (
        "This employee rarely submits requests in this category",
        "نادراً ما يقدّم هذا الموظف طلبات في هذه الفئة"),
    "weekend_expense": (
        "Expense date falls on a weekend (Friday–Saturday)",
        "تاريخ المصروف في عطلة نهاية الأسبوع (الجمعة–السبت)"),
    "round_amount": (
        "Round amount (e.g. 500 or 1,000)",
        "المبلغ رقم مقرّب (مثل 500 أو 1,000)"),
    "duplicate_request": (
        "Same amount in the same category requested more than once for the same day",
        "نفس المبلغ في نفس الفئة طُلب أكثر من مرة لنفس اليوم"),
    "possible_split_request": (
        "Several requests in the same category for the same day (possible split to stay under a limit)",
        "عدة طلبات في نفس الفئة لنفس اليوم (احتمال تجزئة الطلب للبقاء تحت الحد المسموح)"),
    "many_requests_same_day": (
        "Unusually many requests by this employee for the same day",
        "عدد طلبات غير معتاد من هذا الموظف لنفس اليوم"),
    # Added in Step 8 (round 1 of the unseen test): patterns that only show over time or in the digits
    "duplicate_recent_request": (
        "Same amount and category as a request a few days earlier (possible receipt used twice)",
        "نفس المبلغ والفئة لطلب قبل أيام قليلة (احتمال استخدام الإيصال مرتين)"),
    "unusual_amount_digits": (
        "The amount looks made up (repeated or sequential digits, e.g. 1,111.11 or 1,234.56)",
        "المبلغ يبدو غير حقيقي (أرقام مكررة أو متسلسلة، مثل 1,111.11 أو 1,234.56)"),
    "returning_after_long_break": (
        "First request after a long break (90+ days without any request)",
        "أول طلب بعد انقطاع طويل (أكثر من 90 يومًا دون أي طلب)"),
}

# Which amount reason to show depends on what the request was compared with (Step 6, baseline_level)
AMOUNT_CODE = {"empcat": "amount_high_for_employee_category",
               "emp": "amount_high_for_employee",
               "deptcat": "amount_high_for_department"}


def reason_detail(code):
    text_en, text_ar = REASONS[code]
    return {"code": code, "text_en": text_en, "text_ar": text_ar}


# ---------- reasons (Step 8, cells 8.3-8.4) ----------
def score_and_drops(X):
    """The model's score for one request, and how much it drops when ONE model feature is set back to
    a normal value (the "what if" test). One call to the model for both: row 0 = the request as it is."""
    normal = CONFIG["reasons"]["normal_values"]
    rows = pd.concat([X] * (len(normal) + 1), ignore_index=True)
    for i, (feature, value) in enumerate(normal.items(), start=1):
        rows.loc[i, feature] = value
    scores = -MODEL.score_samples(rows)
    return float(scores[0]), dict(zip(normal, scores[0] - scores[1:]))


def explain(row, drops, fired_rules):
    """Reason codes: every rule that fired (strength 1.0, so first), then model features whose drop is
    at least min_drop AND that make sense for this request. Strongest first, at most max_reasons."""
    r = CONFIG["reasons"]
    level = row["baseline_level"]
    candidates = {code: 1.0 for code, fired in fired_rules.items() if fired}
    checks = {   # reason code: (feature it comes from, does it make sense here?)
        "large_amount": ("log_amount", row["log_amount"] > CONFIG["model_input"]["log_amount_floor"]),
        AMOUNT_CODE.get(level, "none"): ("amount_vs_employee_category",
            row["amount_vs_employee_category"] >= r["min_spreads"] and level in AMOUNT_CODE),
        "unusual_category_for_employee": ("category_share_for_employee",
            row["category_share_for_employee"] <= r["unusual_share"] and level in ("empcat", "emp")),
        "weekend_expense": ("is_weekend", row["is_weekend"] == 1),
        "round_amount": ("is_round_amount", row["is_round_amount"] == 1),
    }
    model_candidates = {code: drops[feature] for code, (feature, makes_sense) in checks.items() if makes_sense}
    candidates.update({code: d for code, d in model_candidates.items() if d >= r["min_drop"]})
    if not candidates and model_candidates:          # fallback: the strongest sensible one
        best = max(model_candidates, key=model_candidates.get)
        candidates[best] = model_candidates[best]
    return sorted(candidates, key=candidates.get, reverse=True)[:r["max_reasons"]]


# ---------- the remembered requests ----------
def use_added_file(path):
    """Load the requests scored before the last restart, then keep writing new ones to the same file."""
    global ADDED_FILE
    ADDED_FILE = Path(path)
    ADDED_FILE.parent.mkdir(parents=True, exist_ok=True)
    if ADDED_FILE.exists() and ADDED_FILE.stat().st_size > 0:
        HISTORY.add(pd.read_csv(ADDED_FILE).to_dict("records"))      # same id again → the last version wins


def remember(row):
    """Add a scored request to the history (and the file). Already there unchanged → nothing to do
    (e.g. the backend re-scoring a seed request)."""
    if HISTORY.contains(row):
        return
    HISTORY.add([row])
    if ADDED_FILE is not None:
        new_file = not ADDED_FILE.exists() or ADDED_FILE.stat().st_size == 0
        with open(ADDED_FILE, "a", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=list(row))
            if new_file:
                writer.writeheader()
            writer.writerow(row)


def history_info():
    rows = HISTORY.rows
    return {"requests": int(len(rows)), "added_since_training": int(len(rows) - TRAINING_REQUESTS),
            "latest_date": str(rows["expense_date"].max().date())}


# ---------- scoring ----------
def score_request(expense, same_day_requests, remember=True, typed_amount=None):
    """
    expense: dict with expense_id, requester_id, department_id (may be None), category,
             amount (SAR), expense_date ("YYYY-MM-DD"), category_limit (optional, may be None).
    same_day_requests: list of dicts (expense_id, category, amount): the requester's OTHER
             requests with the same expense_date.
    remember: add this request to the history (the service does; checks in the notebook don't).
    typed_amount: only for checks on the PCard history (the amount as written there, in USD).

    Returns a dict matching the contract's response.
    """
    with _LOCK:      # one request at a time, so the history never changes in the middle of a score
        return _score(expense, same_day_requests, remember, typed_amount)


def _score(expense, same_day_requests, remember_it, typed_amount):
    same_day = [{"expense_id": d["expense_id"], "category": d["category"], "amount_sar": float(d["amount"])}
                for d in same_day_requests]
    row = HISTORY.request_features(
        expense["expense_id"], expense["requester_id"], expense.get("department_id"), expense["category"],
        float(expense["amount"]), expense["expense_date"], same_day, typed_amount=typed_amount)

    # 1. model score (0-1, higher = more unusual) + the "what if" drops used for the reasons
    X = F.model_input(row, CONFIG)
    score, drops = score_and_drops(X)

    # 2. rules: the request + its same-day requests in one table (the split rule needs the day's total).
    #    The category limit from the backend replaces ML's copy for this request (contract B3).
    cfg = CONFIG
    if expense.get("category_limit") is not None:
        limits = {**CONFIG["category_limits"], expense["category"]: float(expense["category_limit"])}
        cfg = {**CONFIG, "category_limits": limits}
    others = pd.DataFrame([{"requester_id": row["requester_id"].iloc[0], "expense_date": row["expense_date"].iloc[0],
                            "category": d["category"], "amount_sar": round(d["amount_sar"], 2)} for d in same_day],
                          columns=["requester_id", "expense_date", "category", "amount_sar"])
    day = pd.concat([row, others], ignore_index=True) if len(others) else row
    rules = F.apply_rules(day, cfg).iloc[[0]]          # this request's row: True/False per rule
    fired = rules.iloc[0]

    # 3. risk level
    level = str(F.risk_levels(np.array([score]), rules, cfg)[0])

    # 4. reasons (only for medium / high)
    codes = []
    if level != "low":
        codes = explain(row.iloc[0], drops, fired)

    # 5. remember the request, so later requests are compared with it (edit = same id = replaced)
    if remember_it:
        remember({"expense_id": expense["expense_id"], "requester_id": expense["requester_id"],
                  "department_id": expense.get("department_id"), "category": expense["category"],
                  "expense_date": str(pd.Timestamp(expense["expense_date"]).date()),
                  "amount_sar": round(float(expense["amount"]), 2)})

    details = [reason_detail(c) for c in codes]
    return {
        "expense_id": expense["expense_id"],
        "score": score,
        "risk_level": level,
        "is_flagged": level != "low",
        "reasons": [d["text_en"] for d in details],
        "reason_details": details,
        "model_version": MODEL_VERSION,
    }
