"""Persistance SQLite : documents indexés, conversations, messages.

Aucune dépendance externe : `sqlite3` de la bibliothèque standard. Une connexion
par opération (WAL activé) évite les problèmes de partage entre les threads du
pool FastAPI. Les embeddings ne sont pas stockés ici mais dans `data/index/`.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id            TEXT PRIMARY KEY,
    sha256        TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    category      TEXT NOT NULL DEFAULT 'Général',
    ext           TEXT NOT NULL,
    size_bytes    INTEGER NOT NULL,
    pages         INTEGER,
    chunk_count   INTEGER NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'en_attente',
    error         TEXT,
    stored_name   TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    indexed_at    TEXT
);

CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    category    TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id               TEXT PRIMARY KEY,
    conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content          TEXT NOT NULL,
    sources_json     TEXT,
    model            TEXT,
    feedback         TEXT CHECK (feedback IN ('up', 'down') OR feedback IS NULL),
    position         INTEGER NOT NULL,
    created_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, position);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
"""

DOCUMENT_STATUSES = ("en_attente", "indexe", "erreur")


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def new_id() -> str:
    return uuid.uuid4().hex


class Store:
    """Accès SQLite minimal et explicite."""

    def __init__(self, database_path: Path) -> None:
        self.path = Path(database_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.initialize()

    # --- plomberie --------------------------------------------------------

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path, timeout=15)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA foreign_keys=ON")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.executescript(SCHEMA)

    # --- documents --------------------------------------------------------

    @staticmethod
    def _document(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "name": row["name"],
            "category": row["category"],
            "ext": row["ext"],
            "size_bytes": row["size_bytes"],
            "pages": row["pages"],
            "chunk_count": row["chunk_count"],
            "status": row["status"],
            "error": row["error"],
            "created_at": row["created_at"],
            "indexed_at": row["indexed_at"],
        }

    def create_document(
        self,
        *,
        document_id: str,
        sha256: str,
        name: str,
        category: str,
        ext: str,
        size_bytes: int,
        stored_name: str,
        pages: int | None = None,
    ) -> dict[str, Any]:
        with self.connect() as connection:
            connection.execute(
                """INSERT INTO documents
                   (id, sha256, name, category, ext, size_bytes, pages, chunk_count,
                    status, stored_name, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'en_attente', ?, ?)""",
                (document_id, sha256, name, category, ext, size_bytes, pages, stored_name, now_iso()),
            )
        return self.get_document(document_id)  # type: ignore[return-value]

    def get_document(self, document_id: str) -> dict[str, Any] | None:
        with self.connect() as connection:
            row = connection.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
        return self._document(row) if row else None

    def get_document_by_sha(self, sha256: str) -> dict[str, Any] | None:
        with self.connect() as connection:
            row = connection.execute("SELECT * FROM documents WHERE sha256 = ?", (sha256,)).fetchone()
        return self._document(row) if row else None

    def get_stored_name(self, document_id: str) -> str | None:
        with self.connect() as connection:
            row = connection.execute("SELECT stored_name FROM documents WHERE id = ?", (document_id,)).fetchone()
        return row["stored_name"] if row else None

    def list_documents(
        self,
        *,
        status: str | None = None,
        query: str | None = None,
        category: str | None = None,
    ) -> list[dict[str, Any]]:
        clauses: list[str] = []
        values: list[Any] = []
        if status:
            clauses.append("status = ?")
            values.append(status)
        if category:
            clauses.append("category = ?")
            values.append(category)
        if query:
            clauses.append("name LIKE ?")
            values.append(f"%{query}%")
        sql = "SELECT * FROM documents"
        if clauses:
            sql += " WHERE " + " AND ".join(clauses)
        sql += " ORDER BY created_at DESC, name COLLATE NOCASE ASC"
        with self.connect() as connection:
            rows = connection.execute(sql, values).fetchall()
        return [self._document(row) for row in rows]

    def mark_indexed(self, document_id: str, *, chunk_count: int, pages: int | None) -> None:
        with self.connect() as connection:
            connection.execute(
                """UPDATE documents
                   SET status = 'indexe', chunk_count = ?, pages = COALESCE(?, pages),
                       error = NULL, indexed_at = ?
                   WHERE id = ?""",
                (chunk_count, pages, now_iso(), document_id),
            )

    def mark_error(self, document_id: str, message: str) -> None:
        with self.connect() as connection:
            connection.execute(
                "UPDATE documents SET status = 'erreur', error = ? WHERE id = ?",
                (message[:500], document_id),
            )

    def delete_document(self, document_id: str) -> bool:
        with self.connect() as connection:
            cursor = connection.execute("DELETE FROM documents WHERE id = ?", (document_id,))
        return cursor.rowcount > 0

    def count_documents(self) -> int:
        with self.connect() as connection:
            return int(connection.execute("SELECT COUNT(*) AS n FROM documents").fetchone()["n"])

    def categories(self) -> list[dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(
                """SELECT category, COUNT(*) AS total,
                          SUM(CASE WHEN status = 'indexe' THEN 1 ELSE 0 END) AS indexed,
                          COALESCE(SUM(chunk_count), 0) AS chunks
                   FROM documents GROUP BY category ORDER BY category COLLATE NOCASE"""
            ).fetchall()
        return [
            {"name": row["category"], "documents": int(row["total"]),
             "indexed": int(row["indexed"] or 0), "chunks": int(row["chunks"] or 0)}
            for row in rows
        ]

    # --- conversations ----------------------------------------------------

    @staticmethod
    def _conversation(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "title": row["title"],
            "category": row["category"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    @staticmethod
    def _message(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "conversation_id": row["conversation_id"],
            "role": row["role"],
            "content": row["content"],
            "sources": json.loads(row["sources_json"]) if row["sources_json"] else [],
            "model": row["model"],
            "feedback": row["feedback"],
            "created_at": row["created_at"],
        }

    def create_conversation(self, *, title: str = "Nouvelle conversation", category: str | None = None) -> dict[str, Any]:
        conversation_id = new_id()
        timestamp = now_iso()
        with self.connect() as connection:
            connection.execute(
                "INSERT INTO conversations (id, title, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (conversation_id, title, category, timestamp, timestamp),
            )
        return {"id": conversation_id, "title": title, "category": category,
                "created_at": timestamp, "updated_at": timestamp}

    def list_conversations(self, limit: int = 100) -> list[dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(
                "SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?", (limit,)
            ).fetchall()
        return [self._conversation(row) for row in rows]

    def get_conversation(self, conversation_id: str) -> dict[str, Any] | None:
        with self.connect() as connection:
            row = connection.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
            if not row:
                return None
            messages = connection.execute(
                "SELECT * FROM messages WHERE conversation_id = ? ORDER BY position ASC", (conversation_id,)
            ).fetchall()
        conversation = self._conversation(row)
        conversation["messages"] = [self._message(message) for message in messages]
        return conversation

    def rename_conversation(self, conversation_id: str, title: str) -> bool:
        with self.connect() as connection:
            cursor = connection.execute(
                "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
                (title.strip()[:200], now_iso(), conversation_id),
            )
        return cursor.rowcount > 0

    def delete_conversation(self, conversation_id: str) -> bool:
        with self.connect() as connection:
            cursor = connection.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
        return cursor.rowcount > 0

    def add_message(
        self,
        conversation_id: str,
        *,
        role: str,
        content: str,
        sources: list[dict[str, Any]] | None = None,
        model: str | None = None,
    ) -> dict[str, Any]:
        message_id = new_id()
        timestamp = now_iso()
        with self.connect() as connection:
            row = connection.execute(
                "SELECT COALESCE(MAX(position), -1) AS last FROM messages WHERE conversation_id = ?",
                (conversation_id,),
            ).fetchone()
            position = int(row["last"]) + 1
            connection.execute(
                """INSERT INTO messages
                   (id, conversation_id, role, content, sources_json, model, position, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (message_id, conversation_id, role, content,
                 json.dumps(sources, ensure_ascii=False) if sources else None,
                 model, position, timestamp),
            )
            connection.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (timestamp, conversation_id))
        return {"id": message_id, "conversation_id": conversation_id, "role": role,
                "content": content, "sources": sources or [], "model": model,
                "feedback": None, "created_at": timestamp}

    def set_message_feedback(self, message_id: str, feedback: str | None) -> bool:
        with self.connect() as connection:
            cursor = connection.execute("UPDATE messages SET feedback = ? WHERE id = ?", (feedback, message_id))
        return cursor.rowcount > 0

    def count_messages(self) -> int:
        with self.connect() as connection:
            return int(connection.execute("SELECT COUNT(*) AS n FROM messages").fetchone()["n"])
