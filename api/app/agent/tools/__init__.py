from app.agent.context import Scope
from app.agent.tools.calculator import calculator_tool
from app.agent.tools.db_tools import build_db_tools
from app.agent.tools.search_tools import build_search_tools


def build_tools(scope: Scope):
    # Tool closures capture the authenticated user's immutable scope.
    return [*build_db_tools(scope), *build_search_tools(scope), calculator_tool()]
