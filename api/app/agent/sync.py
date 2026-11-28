import asyncio
import hashlib
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.agent.embeddings import OpenRouterEmbeddings
from app.agent.vectorstores import get_expense_collection, get_knowledge_collection
from app.core.config import settings
from app.db.session import SessionLocal
from app.models import Expense

logger = logging.getLogger(__name__)
AGENT_DIR = Path(__file__).resolve().parent
KNOWLEDGE_DIR = AGENT_DIR / "knowledge"
STATE_PATH = AGENT_DIR / "data" / "sync_state.json"


def _read_state():
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _write_state(state):
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = STATE_PATH.with_suffix(".tmp")
    temporary.write_text(json.dumps(state, indent=2), encoding="utf-8")
    temporary.replace(STATE_PATH)


def _chunks(markdown: str, source: str):
    lines = markdown.splitlines()
    audience = "all"
    if lines and lines[0].strip() == "---":
        end = next((i for i, line in enumerate(lines[1:], 1) if line.strip() == "---"), None)
        if end is not None:
            for line in lines[1:end]:
                if line.lower().startswith("audience:"):
                    audience = line.split(":", 1)[1].strip()
            lines = lines[end + 1 :]
    sections = []
    heading = source
    buffer = []
    for line in lines:
        if line.startswith("#"):
            if buffer:
                sections.append((heading, "\n".join(buffer).strip()))
                buffer = []
            heading = line.lstrip("#").strip() or source
        else:
            buffer.append(line)
    if buffer:
        sections.append((heading, "\n".join(buffer).strip()))
    output = []
    for heading, body in sections:
        body = body.strip()
        while body:
            chunk = body[:800]
            split_at = chunk.rfind(" ")
            if len(body) > 800 and split_at > 500:
                chunk = chunk[:split_at]
            output.append((heading, chunk.strip(), audience))
            body = body[len(chunk):].strip()
    return output


def index_knowledge():
    if not settings.openrouter_api_key:
        logger.info("Skipping knowledge indexing: OPENROUTER_API_KEY is not configured")
        return
    collection = get_knowledge_collection()
    state = _read_state()
    embedder = OpenRouterEmbeddings()
    for path in sorted(KNOWLEDGE_DIR.glob("*.md")):
        content = path.read_text(encoding="utf-8")
        digest = hashlib.sha256(content.encode()).hexdigest()
        if state.get(path.name) == digest:
            continue
        existing = collection.get(where={"source": path.name}, include=["metadatas"])
        if existing.get("ids"):
            collection.delete(ids=existing["ids"])
        chunks = _chunks(content, path.name)
        if chunks:
            vectors = embedder.embed_documents([chunk for _, chunk, _ in chunks])
            ids = [f"{path.stem}-{index}" for index in range(len(chunks))]
            metadatas = [
                {"source": path.name, "heading": heading, "audience": audience}
                for heading, _, audience in chunks
            ]
            collection.upsert(
                ids=ids, embeddings=vectors,
                documents=[chunk for _, chunk, _ in chunks],
                metadatas=metadatas,
            )
        state[path.name] = digest
        _write_state(state)


def sync_expenses_once():
    if not settings.openrouter_api_key:
        return
    collection = get_expense_collection()
    embedder = OpenRouterEmbeddings()
    with SessionLocal() as db:
        stmt = select(Expense).options(joinedload(Expense.category)).order_by(
            Expense.expense_date.desc(), Expense.id.desc()
        )
        if settings.agent_index_max_expenses:
            stmt = stmt.limit(settings.agent_index_max_expenses)
        rows = db.scalars(stmt).unique().all()
    existing = collection.get(include=["metadatas"])
    known = {
        str(item_id): metadata.get("text_hash")
        for item_id, metadata in zip(existing.get("ids", []), existing.get("metadatas", []))
    }
    valid_ids = {str(row.id) for row in rows}
    stale = [item_id for item_id in known if item_id not in valid_ids]
    if stale:
        collection.delete(ids=stale)
    changed = []
    for row in rows:
        category = row.category.name if row.category else "Uncategorized"
        text = f"{category} | {row.description}"
        digest = hashlib.sha256(text.encode()).hexdigest()
        if known.get(str(row.id)) != digest:
            changed.append((row.id, text, digest, row))
    batch_size = max(1, settings.agent_embed_batch_size)
    for start in range(0, len(changed), batch_size):
        batch = changed[start : start + batch_size]
        vectors = embedder.embed_documents([item[1] for item in batch])
        collection.upsert(
            ids=[str(item[0]) for item in batch],
            embeddings=vectors,
            documents=[item[1] for item in batch],
            metadatas=[
                {
                    "requester_id": int(item[3].requester_id),
                    "department_id": int(item[3].department_id),
                    "category_id": int(item[3].category_id),
                    "expense_ord": int(item[3].expense_date.toordinal()),
                    "text_hash": item[2],
                }
                for item in batch
            ],
        )


async def _sync_loop():
    while True:
        await asyncio.sleep(settings.agent_sync_interval_seconds)
        try:
            await asyncio.to_thread(sync_expenses_once)
        except Exception:
            logger.exception("Masroof expense index refresh failed; it will retry")


@asynccontextmanager
async def agent_lifespan(app):
    task = None
    try:
        if settings.openrouter_api_key:
            try:
                await asyncio.to_thread(index_knowledge)
                await asyncio.to_thread(sync_expenses_once)
            except Exception:
                logger.exception("Initial assistant indexing failed; chat remains available")
            if settings.agent_sync_enabled:
                task = asyncio.create_task(_sync_loop())
        yield
    finally:
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
