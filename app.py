"""Application web interne : API FastAPI et interface statique."""

from __future__ import annotations

import json
import logging
from typing import Annotated

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from rag.config import PROJECT_ROOT, settings
from rag.engine import RagConfigurationError, RagProviderError, get_engine

logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO), format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)
FRONTEND_DIR = PROJECT_ROOT / "frontend"

app = FastAPI(title="Assistant documentaire interne", docs_url=None, redoc_url=None)
if settings.allowed_origins:
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.allowed_origins), allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


class ChatRequest(BaseModel):
    question: Annotated[str, Field(min_length=1, max_length=4_000)]
    stream: bool = True


class SourceResponse(BaseModel):
    id: str
    document: str
    category: str
    chunk_id: int
    excerpt: str
    score: float


def public_error(exc: Exception) -> HTTPException:
    if isinstance(exc, RagConfigurationError):
        logger.warning("Configuration RAG : %s", exc)
        return HTTPException(status_code=503, detail="Le service documentaire n'est pas encore configuré.")
    logger.exception("Erreur de traitement")
    return HTTPException(status_code=502, detail="Le service de réponse est momentanément indisponible. Réessayez dans quelques instants.")


@app.get("/api/health")
def health() -> dict:
    return get_engine().health()


@app.get("/api/sources/{source_id}", response_model=SourceResponse)
def source(source_id: str) -> dict:
    try:
        result = get_engine().get_source(source_id)
    except RagConfigurationError as exc:
        raise public_error(exc) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Extrait source introuvable.")
    return result.as_dict()


@app.post("/api/chat")
def chat(payload: ChatRequest):
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Veuillez saisir une question.")
    engine = get_engine()
    try:
        if not payload.stream:
            answer, sources = engine.answer(question)
            return {"answer": answer, "sources": [source.as_dict() for source in sources]}
        tokens, sources = engine.stream_answer(question)
    except (RagConfigurationError, RagProviderError) as exc:
        raise public_error(exc) from exc

    def event_stream():
        yield f"data: {json.dumps({'type': 'sources', 'sources': [source.as_dict() for source in sources]}, ensure_ascii=False)}\n\n"
        try:
            for token in tokens:
                yield f"data: {json.dumps({'type': 'token', 'content': token}, ensure_ascii=False)}\n\n"
            yield 'data: {"type":"done"}\n\n'
        except Exception:
            logger.exception("Interruption du flux de réponse")
            yield 'data: {"type":"error","message":"La réponse a été interrompue. Réessayez."}\n\n'

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/")
def index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")
