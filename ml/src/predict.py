"""
Anomaly scoring logic for Masroof expense requests.

>>> STUB VERSION <<<
Returns FAKE scores so the backend and frontend can build and test now.
The real model (Step 9) replaces the inside of score_request() and keeps
the same inputs and outputs, so nothing outside this folder has to change.

This file is pure Python (no web framework, no database).
src/service.py wraps it as an HTTP service for the backend.
"""

import hashlib
import random

MODEL_VERSION = "stub-0.2"

# The model is trained on these categories only. Names must match the
# backend's `categories.name` exactly.
CATEGORIES = [
    "Food",
    "Travel",
    "Transportation",
    "Office Supplies",
    "IT & Telecom",
    "Equipment & Maintenance",
]

# code -> (English, Arabic). The list is final after Step 6 (all 10 kept); texts may be polished in Step 8.
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
}

# Placeholder cut-offs. Final values are set in Step 7.
MEDIUM_FROM = 0.60
HIGH_FROM = 0.80


def risk_level(score):
    if score >= HIGH_FROM:
        return "high"
    if score >= MEDIUM_FROM:
        return "medium"
    return "low"


def reason_detail(code):
    text_en, text_ar = REASONS[code]
    return {"code": code, "text_en": text_en, "text_ar": text_ar}


def score_request(expense, same_day_requests):
    """
    expense: dict with expense_id, requester_id, department_id (may be None),
             category, amount, expense_date ("YYYY-MM-DD").
    same_day_requests: list of dicts (expense_id, category, amount) — the
             requester's OTHER requests with the same expense_date.

    Returns a dict matching the contract's response.
    """
    # Same expense_id always gets the same fake score (repeatable tests).
    seed = int(hashlib.md5(str(expense["expense_id"]).encode()).hexdigest(), 16)
    rng = random.Random(seed)

    # Roughly 80% low, 15% medium, 5% high, so every badge can be tested.
    roll = rng.random()
    if roll < 0.80:
        score = rng.uniform(0.05, MEDIUM_FROM - 0.01)
    elif roll < 0.95:
        score = rng.uniform(MEDIUM_FROM, HIGH_FROM - 0.01)
    else:
        score = rng.uniform(HIGH_FROM, 0.99)

    # Testing hooks: force a result on purpose.
    codes = []
    if float(expense["amount"]) > 10000:
        score = max(score, 0.90)
        codes.append("large_amount")
    same_cat = [r for r in same_day_requests if r.get("category") == expense["category"]]
    if len(same_cat) >= 2:
        score = max(score, 0.85)
        codes.append("possible_split_request")

    level = risk_level(score)
    if level == "low":
        codes = []
    else:
        others = [c for c in REASONS if c not in codes]
        codes = (codes + rng.sample(others, k=rng.randint(1, 3)))[:3]

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
