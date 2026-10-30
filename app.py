"""Application web interne : API FastAPI et service de l'interface.

Deux moteurs coexistent volontairement :

* `rag.engine` — moteur historique (chunks.json + embeddings.npy) conservé pour
  `POST /api/chat` et la base déjà indexée ;
* `rag.index` — index par document, rechargeable à chaud, alimenté par les
  imports de l'interface (`/api/documents`).

Les deux partagent `rag.store` (SQLite) pour l'inventaire documentaire et, à
partir de P2, les conversations.
"""

from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from rag.config import PROJECT_ROOT, settings
from rag.documents import (
    ALLOWED_EXTENSIONS,
    DocumentError,
    DuplicateDocument,
    chunk_pages,
    extract_pages,
    extension_of,
    human_size,
    sanitize_filename,
    sha256_of,
    validate_upload,
)
from rag.engine import RagConfigurationError, RagEngine, RagProviderError
from rag.index import IndexManager, IndexUnavailable
from rag.store import Store, new_id

logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO), format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)
FRONTEND_DIR = PROJECT_ROOT / "frontend"

MEDIA_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv",
}

# Instances partagées (remplacées par les tests via monkeypatch).
store = Store(settings.database_path)
index_manager = IndexManager(settings.index_dir, model_name=settings.embedding_model)
engine = RagEngine(settings, index_provider=lambda: index_manager)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.ensure_directories()
    logger.info(
        "Base documentaire : %s document(s), %s chunk(s) indexé(s)",
        store.count_documents(),
        index_manager.document_count,
    )
    yield


app = FastAPI(title="Assistant documentaire interne", docs_url=None, redoc_url=None, lifespan=lifespan)
if settings.allowed_origins:
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.allowed_origins), allow_credentials=False, allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Content-Type"])
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


# --------------------------------------------------------------------------- #
# Modèles
# --------------------------------------------------------------------------- #

class ChatRequest(BaseModel):
    question: Annotated[str, Field(min_length=1, max_length=4_000)]
    stream: bool = True
    conversation_id: str | None = None
    category: str | None = None


class ConversationCreate(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=200)] = "Nouvelle conversation"
    category: str | None = None


class ConversationRename(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=200)]


class FeedbackRequest(BaseModel):
    feedback: str | None = None


class SourceResponse(BaseModel):
    id: str
    document: str
    category: str
    chunk_id: int
    excerpt: str
    score: float
    page: str | None = None
    document_id: str | None = None


class DocumentResponse(BaseModel):
    id: str
    name: str
    category: str
    ext: str
    size_bytes: int
    pages: int | None = None
    chunk_count: int
    status: str
    error: str | None = None
    created_at: str
    indexed_at: str | None = None


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int
    counts: dict[str, int]


# --------------------------------------------------------------------------- #
# Erreurs
# --------------------------------------------------------------------------- #

def public_error(exc: Exception) -> HTTPException:
    if isinstance(exc, RagConfigurationError):
        logger.warning("Configuration RAG : %s", exc)
        return HTTPException(status_code=503, detail="Le service documentaire n'est pas encore configuré.")
    logger.exception("Erreur de traitement")
    return HTTPException(status_code=502, detail="Le service de réponse est momentanément indisponible. Réessayez dans quelques instants.")


@app.exception_handler(DocumentError)
def document_error_handler(_: Request, exc: DocumentError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


# --------------------------------------------------------------------------- #
# Santé
# --------------------------------------------------------------------------- #

@app.get("/api/health")
def health() -> dict:
    payload = engine.health()
    payload.update(
        {
            "documents_count": store.count_documents(),
            "chunks_indexed": index_manager.chunk_count,
            "uploads_enabled": True,
            "formats": list(ALLOWED_EXTENSIONS),
            "max_upload_bytes": settings.max_upload_bytes,
        }
    )
    return payload


# --------------------------------------------------------------------------- #
# Documents
# --------------------------------------------------------------------------- #

def _vectorise(document_id: str, name: str, category: str, chunks) -> int:
    """Indexe les chunks ; laisse le document en erreur si l'encodeur échoue."""
    try:
        count = index_manager.add_document(document_id, document=name, category=category, chunks=chunks)
    except IndexUnavailable as exc:
        store.mark_error(document_id, str(exc))
        logger.warning("Indexation impossible pour %s : %s", name, exc)
        raise HTTPException(
            status_code=503,
            detail="Le document est enregistré mais n'a pas pu être indexé : le modèle d'embeddings est indisponible.",
        ) from exc
    return count


async def _read_limited(upload: UploadFile, limit: int) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        block = await upload.read(1024 * 256)
        if not block:
            break
        total += len(block)
        if total > limit:
            raise HTTPException(status_code=413, detail=f"Fichier trop volumineux : maximum {human_size(limit)}.")
        chunks.append(block)
    return b"".join(chunks)


@app.get("/api/documents", response_model=DocumentListResponse)
def list_documents(status: str | None = None, q: str | None = None, category: str | None = None) -> dict:
    documents = store.list_documents(status=status, query=q, category=category)
    return {"documents": documents, "total": len(documents), "counts": _status_counts()}


def _status_counts() -> dict:
    everything = store.list_documents()
    return {
        "all": len(everything),
        "indexe": sum(1 for document in everything if document["status"] == "indexe"),
        "en_attente": sum(1 for document in everything if document["status"] == "en_attente"),
        "erreur": sum(1 for document in everything if document["status"] == "erreur"),
    }


@app.post("/api/documents", response_model=DocumentResponse, status_code=201)
async def upload_document(
    file: Annotated[UploadFile, File()],
    category: Annotated[str, Form()] = "Général",
) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Aucun fichier reçu.")

    name = sanitize_filename(file.filename)
    content = await _read_limited(file, settings.max_upload_bytes)
    ext = validate_upload(name, content, max_bytes=settings.max_upload_bytes)

    digest = sha256_of(content)
    existing = store.get_document_by_sha(digest)
    if existing:
        raise DuplicateDocument(f"Ce document est déjà présent sous le nom « {existing['name']} ».")

    category_name = (category or "Général").strip()[:60] or "Général"
    pages = extract_pages(content, ext)
    chunks = chunk_pages(pages, chunk_size=settings.chunk_size, chunk_overlap=settings.chunk_overlap)

    document_id = new_id()
    stored_name = f"{document_id}.{extension_of(name)}"
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    (settings.uploads_dir / stored_name).write_bytes(content)

    document = store.create_document(
        document_id=document_id,
        sha256=digest,
        name=name,
        category=category_name,
        ext=ext,
        size_bytes=len(content),
        stored_name=stored_name,
        pages=len(pages),
    )

    try:
        count = _vectorise(document_id, name, category_name, chunks)
    except HTTPException:
        raise
    except Exception as exc:  # garde-fou : on ne laisse pas un document fantôme
        store.mark_error(document_id, str(exc))
        raise HTTPException(status_code=500, detail="L'indexation a échoué. Le document est conservé en erreur.") from exc

    store.mark_indexed(document_id, chunk_count=count, pages=len(pages))
    logger.info("Document importé : %s (%s chunks)", name, count)
    return store.get_document(document_id)  # type: ignore[return-value]


@app.delete("/api/documents/{document_id}", status_code=204)
def delete_document(document_id: str) -> None:
    stored_name = store.get_stored_name(document_id)
    if stored_name is None:
        raise HTTPException(status_code=404, detail="Document introuvable.")
    index_manager.remove_document(document_id)
    (settings.uploads_dir / stored_name).unlink(missing_ok=True)
    store.delete_document(document_id)
    logger.info("Document supprimé : %s", document_id)


@app.post("/api/documents/{document_id}/reindex", response_model=DocumentResponse, status_code=202)
def reindex_document(document_id: str) -> dict:
    document = store.get_document(document_id)
    stored_name = store.get_stored_name(document_id)
    if document is None or stored_name is None:
        raise HTTPException(status_code=404, detail="Document introuvable.")
    path = settings.uploads_dir / stored_name
    if not path.is_file():
        store.mark_error(document_id, "Fichier original absent du disque.")
        raise HTTPException(status_code=409, detail="Le fichier original est absent : réimportez le document.")

    content = path.read_bytes()
    ext = extension_of(document["name"])
    pages = extract_pages(content, ext)
    chunks = chunk_pages(pages, chunk_size=settings.chunk_size, chunk_overlap=settings.chunk_overlap)
    count = _vectorise(document_id, document["name"], document["category"], chunks)
    store.mark_indexed(document_id, chunk_count=count, pages=len(pages))
    return store.get_document(document_id)  # type: ignore[return-value]


@app.get("/api/documents/{document_id}/file")
def download_document(document_id: str) -> FileResponse:
    document = store.get_document(document_id)
    stored_name = store.get_stored_name(document_id)
    if document is None or stored_name is None:
        raise HTTPException(status_code=404, detail="Document introuvable.")
    path = settings.uploads_dir / Path(stored_name).name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Fichier original introuvable.")
    return FileResponse(
        path,
        media_type=MEDIA_TYPES.get(document["ext"], "application/octet-stream"),
        filename=document["name"],
        content_disposition_type="inline",
    )


@app.get("/api/knowledge-bases")
def knowledge_bases() -> dict:
    return {
        "categories": store.categories(),
        "formats": list(ALLOWED_EXTENSIONS),
        "max_upload_bytes": settings.max_upload_bytes,
    }


# --------------------------------------------------------------------------- #
# Sources
# --------------------------------------------------------------------------- #

@app.get("/api/sources/{source_id}", response_model=SourceResponse)
def source(source_id: str) -> dict:
    # Index par document d'abord (imports de l'interface), puis base historique.
    entry = index_manager.get_source(source_id)
    if entry is not None:
        return {
            "id": entry["id"],
            "document": entry["document"],
            "category": entry["category"],
            "chunk_id": entry["chunk_id"],
            "excerpt": entry["text"],
            "score": 0.0,
            "page": entry["label"],
            "document_id": entry["document_id"],
        }
    try:
        result = engine.get_source(source_id)
    except RagConfigurationError as exc:
        if index_manager.document_count:
            raise HTTPException(status_code=404, detail="Extrait source introuvable.") from exc
        raise public_error(exc) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Extrait source introuvable.")
    return result.as_dict()


# --------------------------------------------------------------------------- #
# Conversation
# --------------------------------------------------------------------------- #

def _existing_conversation(payload: ChatRequest) -> dict | None:
    """Conversation demandée, ou None s'il faut la créer.

    La création est différée après le succès du moteur : un échec (503, 502) ne
    doit pas laisser de conversation vide dans l'historique.
    """
    if not payload.conversation_id:
        return None
    conversation = store.get_conversation(payload.conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")
    return conversation


def _title_from_question(question: str) -> str:
    cleaned = " ".join(question.split())
    return (cleaned[:60] + "…") if len(cleaned) > 60 else (cleaned or "Nouvelle conversation")


def _persist_turn(conversation_id: str, question: str, answer: str, sources: list, model: str | None) -> dict:
    store.add_message(conversation_id, role="user", content=question)
    assistant = store.add_message(
        conversation_id,
        role="assistant",
        content=answer,
        sources=[source.as_dict() if hasattr(source, "as_dict") else dict(source) for source in sources],
        model=model,
    )
    return assistant


@app.post("/api/chat")
def chat(payload: ChatRequest):
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Veuillez saisir une question.")
    conversation = _existing_conversation(payload)
    try:
        if not payload.stream:
            answer, sources = engine.answer(question)
            conversation = conversation or store.create_conversation(
                title=_title_from_question(question), category=payload.category
            )
            message = _persist_turn(conversation["id"], question, answer, sources, settings.groq_model)
            return {
                "answer": answer,
                "sources": [source.as_dict() for source in sources],
                "conversation_id": conversation["id"],
                "message_id": message["id"],
            }
        tokens, sources = engine.stream_answer(question)
    except HTTPException:
        raise
    except Exception as exc:  # RagConfigurationError, RagProviderError et tout imprévu
        raise public_error(exc) from exc

    conversation = conversation or store.create_conversation(
        title=_title_from_question(question), category=payload.category
    )
    store.add_message(conversation["id"], role="user", content=question)

    def event_stream():
        collected: list[str] = []
        yield f"data: {json.dumps({'type': 'sources', 'sources': [source.as_dict() for source in sources], 'conversation_id': conversation['id']}, ensure_ascii=False)}\n\n"
        try:
            for token in tokens:
                collected.append(token)
                yield f"data: {json.dumps({'type': 'token', 'content': token}, ensure_ascii=False)}\n\n"
            message = store.add_message(
                conversation["id"],
                role="assistant",
                content="".join(collected),
                sources=[source.as_dict() for source in sources],
                model=settings.groq_model,
            )
            yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation['id'], 'message_id': message['id']})}\n\n"
        except Exception:
            logger.exception("Interruption du flux de réponse")
            partial = "".join(collected)
            if partial:
                store.add_message(conversation["id"], role="assistant", content=partial,
                                  sources=[source.as_dict() for source in sources], model=settings.groq_model)
            yield 'data: {"type":"error","message":"La réponse a été interrompue. Réessayez."}\n\n'

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# --------------------------------------------------------------------------- #
# Conversations
# --------------------------------------------------------------------------- #

@app.get("/api/conversations")
def list_conversations() -> dict:
    return {"conversations": store.list_conversations()}


@app.post("/api/conversations", status_code=201)
def create_conversation(payload: ConversationCreate) -> dict:
    return store.create_conversation(title=payload.title.strip() or "Nouvelle conversation", category=payload.category)


@app.get("/api/conversations/{conversation_id}")
def get_conversation(conversation_id: str) -> dict:
    conversation = store.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")
    return conversation


@app.patch("/api/conversations/{conversation_id}")
def rename_conversation(conversation_id: str, payload: ConversationRename) -> dict:
    if not store.rename_conversation(conversation_id, payload.title):
        raise HTTPException(status_code=404, detail="Conversation introuvable.")
    return store.get_conversation(conversation_id)


@app.delete("/api/conversations/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str) -> None:
    if not store.delete_conversation(conversation_id):
        raise HTTPException(status_code=404, detail="Conversation introuvable.")


@app.post("/api/messages/{message_id}/feedback", status_code=204)
def message_feedback(message_id: str, payload: FeedbackRequest) -> None:
    if payload.feedback not in (None, "up", "down"):
        raise HTTPException(status_code=422, detail="Valeur attendue : « up », « down » ou nulle.")
    if not store.set_message_feedback(message_id, payload.feedback):
        raise HTTPException(status_code=404, detail="Message introuvable.")


@app.get("/api/search")
def search(q: str = "") -> dict:
    term = q.strip()
    if not term:
        return {"documents": [], "conversations": []}
    return {
        "documents": store.list_documents(query=term),
        "conversations": [item for item in store.list_conversations() if term.casefold() in item["title"].casefold()],
    }


# --------------------------------------------------------------------------- #
# Interface
# --------------------------------------------------------------------------- #

@app.get("/")
def index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")
