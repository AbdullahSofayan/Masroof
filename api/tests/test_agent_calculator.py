import pytest

from app.agent.tools.calculator import safe_calculate


def test_safe_calculator_supports_arithmetic_and_functions():
    assert safe_calculate("10 + 2 * 3") == 16
    assert safe_calculate("sum([1, 2, 3])") == 6
    assert safe_calculate("sqrt(81)") == 9


@pytest.mark.parametrize("expression", [
    "__import__('os').system('id')",
    "2 ** 101",
    "True + 1",
    "open('secret')",
])
def test_safe_calculator_rejects_unsafe_expressions(expression):
    with pytest.raises((ValueError, TypeError, SyntaxError)):
        safe_calculate(expression)
