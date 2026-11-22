from decimal import Decimal

from app.services.decision_engine import evaluate_expense

# test 1: expense exceeds both limits

result = evaluate_expense(
    amount=Decimal("5000"),
    category_limit=Decimal("3000"),
    monthly_spent=Decimal("8000"),
    monthly_budget=Decimal("10000"),
)

assert len(result["warnings"]) == 2
print("test 1 passed")

# test 2: expense within both limits

result = evaluate_expense(
    amount=Decimal("1000"),
    category_limit=Decimal("3000"),
    monthly_spent=Decimal("8000"),
    monthly_budget=Decimal("10000"),
)

assert result["warnings"] == []
print("test 2 Passed")


# test 3: No category limit or monthly budget
result = evaluate_expense(
    amount=Decimal("5000"),
    category_limit=None,
    monthly_spent=Decimal("0"),
    monthly_budget=None,
)

assert result["warnings"] == []
print("test 3 Passed")


# test 4: finance warnings + AI result

result = evaluate_expense(
    amount=Decimal("5000"),
    category_limit=Decimal("3000"),
    monthly_spent=Decimal("8000"),
    monthly_budget=Decimal("10000"),
    anomaly_result={"risk_level": "High", "anomaly_score": -0.15},
)

assert len(result["warnings"]) == 2
assert result["risk_level"] == "High"
assert result["anomaly_score"] == -0.15

print("test 4 Passed")

# test 5: AI is not available

result = evaluate_expense(
    amount=Decimal("1000"),
    category_limit=Decimal("3000"),
    monthly_spent=Decimal("2000"),
    monthly_budget=Decimal("10000"),
)

assert result["warnings"] == []
assert result["risk_level"] is None
assert result["anomaly_score"] is None

print("test 5 Passed")
