import ast
import math
import operator

from langchain_core.tools import tool


_BINARY = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_UNARY = {ast.UAdd: operator.pos, ast.USub: operator.neg}
_FUNCTIONS = {
    "abs": abs,
    "round": round,
    "min": min,
    "max": max,
    "sum": sum,
    "sqrt": math.sqrt,
    "floor": math.floor,
    "ceil": math.ceil,
}
_CONSTANTS = {"pi": math.pi}


def safe_calculate(expression: str):
    if len(expression) > 200:
        raise ValueError("Expression is too long")
    root = ast.parse(expression, mode="eval")

    def visit(node):
        if isinstance(node, ast.Expression):
            return visit(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
            return node.value
        if isinstance(node, (ast.List, ast.Tuple)):
            return [visit(item) for item in node.elts]
        if isinstance(node, ast.Name) and node.id in _CONSTANTS:
            return _CONSTANTS[node.id]
        if isinstance(node, ast.BinOp) and type(node.op) in _BINARY:
            left, right = visit(node.left), visit(node.right)
            if isinstance(node.op, ast.Pow) and abs(right) > 100:
                raise ValueError("Exponent magnitude cannot exceed 100")
            return _BINARY[type(node.op)](left, right)
        if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY:
            return _UNARY[type(node.op)](visit(node.operand))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            function = _FUNCTIONS.get(node.func.id)
            if function is None or node.keywords:
                raise ValueError("Function is not allowed")
            return function(*(visit(arg) for arg in node.args))
        raise ValueError("Expression contains an unsupported operation")

    result = visit(root)
    if isinstance(result, complex) or not math.isfinite(float(result)):
        raise ValueError("Result is not a finite real number")
    return result


def calculator_tool():
    @tool
    def calculate(expression: str) -> dict:
        """Safely calculate a mathematical expression. No Python code or imports."""
        try:
            return {"result": safe_calculate(expression)}
        except Exception as exc:
            return {"error": str(exc)}
    return calculate
