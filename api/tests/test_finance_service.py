"""Tests for the finance rules in app/services/finance_service.py.

Run from the api folder:  python -m tests.test_finance_service
"""

from decimal import Decimal

from app.services.finance_service import (budget_usage, budget_warning,
                                          limit_warning)


def test_limit_warning():
    # Food limit is 500
    assert limit_warning(Decimal("300"), Decimal("500")
                         ) is None  # under the limit
    assert limit_warning(Decimal("500"), Decimal("500")
                         ) is None  # exactly the limit
    assert limit_warning(Decimal("700"), Decimal("500")
                         ) is not None  # over the limit
    # category has no limit
    assert limit_warning(Decimal("10000"), None) is None


def test_budget_warning():
    # IT budget for November is 50,000 and 42,500 is already approved
    assert (
        budget_warning(Decimal("42500"), Decimal(
            "5000"), Decimal("50000")) is None
    )  # 47,500 fits
    assert (
        budget_warning(Decimal("42500"), Decimal(
            "7500"), Decimal("50000")) is None
    )  # exactly 50,000
    assert (
        budget_warning(Decimal("42500"), Decimal(
            "9000"), Decimal("50000")) is not None
    )  # 51,500 is over
    assert (
        budget_warning(Decimal("42500"), Decimal("9000"), None) is None
    )  # no budget set


def test_budget_usage():
    usage = budget_usage(Decimal("42500"), Decimal("50000"))
    assert usage["remaining"] == Decimal("7500")
    assert usage["percent"] == Decimal("85.0")
    assert budget_usage(Decimal("0"), Decimal("0"))["percent"] == Decimal("0")


if __name__ == "__main__":
    for test in (test_limit_warning, test_budget_warning, test_budget_usage):
        test()
        print(f"PASS  {test.__name__}")
    print()
    print("Example warnings:")
    print(" ", limit_warning(Decimal("700"), Decimal("500")))
    print(" ", budget_warning(Decimal("42500"), Decimal("9000"), Decimal("50000")))
    print(" ", budget_usage(Decimal("42500"), Decimal("50000")))
