from langchain_core.tools import tool
from sqlalchemy import select

from app.agent.context import Scope, agent_session, allowed_audiences, apply_scope, chroma_scope_filter
from app.agent.embeddings import OpenRouterEmbeddings
from app.agent.serializers import serialize_expense
from app.agent.vectorstores import get_expense_collection, get_knowledge_collection
from app.models import Expense


def build_search_tools(scope: Scope):
    @tool
    def search_knowledge(query: str) -> dict:
        """Search Masroof's sectioned policies, user guide, risk guide, and FAQ."""
        try:
            vector = OpenRouterEmbeddings().embed_query(query)
            result = get_knowledge_collection().query(
                query_embeddings=[vector],
                n_results=4,
                where={"audience": {"$in": allowed_audiences(scope)}},
                include=["documents", "metadatas", "distances"],
            )
            items = []
            for doc, meta, distance in zip(
                result.get("documents", [[]])[0],
                result.get("metadatas", [[]])[0],
                result.get("distances", [[]])[0],
            ):
                items.append({
                    "source": meta.get("source"),
                    "section": meta.get("heading"),
                    "content": doc,
                    "distance": distance,
                })
            return {"results": items}
        except Exception as exc:
            return {"error": f"Knowledge search is not ready: {exc}"}

    @tool
    def search_expenses(query: str, limit: int = 5) -> dict:
        """Find semantically similar expenses in the current user's scope; SQL re-checks every match."""
        try:
            collection = get_expense_collection()
            vector = OpenRouterEmbeddings().embed_query(query)
            where = chroma_scope_filter(scope)
            kwargs = {
                "query_embeddings": [vector],
                "n_results": max(1, min(limit, 10)) * 3,
                "include": ["metadatas", "distances"],
            }
            if where is not None:
                kwargs["where"] = where
            matches = collection.query(**kwargs)
            ids = matches.get("ids", [[]])[0]
            if not ids:
                return {"count": 0, "expenses": []}
            ordered_ids = []
            for value in ids:
                try:
                    ordered_ids.append(int(value))
                except (TypeError, ValueError):
                    continue
            with agent_session() as db:
                stmt = apply_scope(
                    select(Expense).where(Expense.id.in_(ordered_ids)), scope
                )
                rows = db.scalars(stmt).all()
                by_id = {row.id: row for row in rows}
                ordered = [by_id[item] for item in ordered_ids if item in by_id]
                return {
                    "count": min(len(ordered), limit),
                    "expenses": [serialize_expense(row, scope) for row in ordered[: max(1, min(limit, 10))]],
                }
        except Exception as exc:
            return {"error": f"Expense search is not ready: {exc}"}

    return [search_knowledge, search_expenses]
