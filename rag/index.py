"""Index vectoriel rechargeable, un fichier par document.

Le moteur historique (`rag/engine.py`) charge un unique `embeddings.npy` et ne
peut ni ajouter ni retirer un document à chaud. Cet index-ci conserve le même
principe — vecteurs normalisés, similarité = produit scalaire — mais stocke un
couple `<document_id>.json` / `<document_id>.npy` par document, ce qui permet
l'ajout, la suppression et le rechargement sans redémarrage du serveur.
"""

from __future__ import annotations

import json
import logging
import threading
from pathlib import Path
from typing import Callable

import numpy as np

from .documents import Chunk

logger = logging.getLogger(__name__)

Encoder = Callable[[list[str]], np.ndarray]


class IndexUnavailable(RuntimeError):
    """Encodeur ou index indisponible (modèle manquant, dossier illisible...)."""


class IndexManager:
    def __init__(
        self,
        directory: Path,
        *,
        encoder: Encoder | None = None,
        model_name: str | None = None,
    ) -> None:
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self._encoder = encoder
        self._model_name = model_name
        self._model = None
        self._lock = threading.RLock()
        self._vectors: np.ndarray | None = None
        self._entries: list[dict] = []
        self._signature: tuple = ()

    # --- encodeur ---------------------------------------------------------

    def set_encoder(self, encoder: Encoder | None) -> None:
        """Injection utilisée par les tests (et par un futur autre fournisseur)."""
        with self._lock:
            self._encoder = encoder
            self._model = None

    def _encode(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, 0), dtype=np.float32)
        if self._encoder is not None:
            vectors = np.asarray(self._encoder(texts), dtype=np.float32)
            return vectors
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as exc:
                raise IndexUnavailable(
                    "Les dépendances d'embeddings ne sont pas installées (sentence-transformers)."
                ) from exc
            name = self._model_name or "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
            logger.info("Chargement du modèle d'embeddings : %s", name)
            try:
                self._model = SentenceTransformer(name)
            except Exception as exc:  # téléchargement impossible, cache absent...
                raise IndexUnavailable(
                    "Le modèle d'embeddings ne peut pas être chargé (téléchargement impossible ou cache absent)."
                ) from exc
        return np.asarray(self._model.encode(texts, normalize_embeddings=True), dtype=np.float32)

    # --- chemins ----------------------------------------------------------

    def _paths(self, document_id: str) -> tuple[Path, Path]:
        safe = "".join(character for character in document_id if character.isalnum() or character in "-_")
        return self.directory / f"{safe}.json", self.directory / f"{safe}.npy"

    def document_chunk_count(self, document_id: str) -> int:
        meta_path, _ = self._paths(document_id)
        if not meta_path.is_file():
            return 0
        try:
            return len(json.loads(meta_path.read_text(encoding="utf-8")).get("chunks", []))
        except (OSError, ValueError):
            return 0

    # --- écriture ---------------------------------------------------------

    def add_document(
        self,
        document_id: str,
        *,
        document: str,
        category: str,
        chunks: list[Chunk],
    ) -> int:
        """Vectorise et persiste un document. Retourne le nombre de chunks."""
        if not chunks:
            raise ValueError("Aucun chunk à indexer.")
        vectors = self._encode([chunk.text for chunk in chunks])
        if vectors.ndim != 2 or len(vectors) != len(chunks):
            raise IndexUnavailable("L'encodeur a renvoyé une matrice incohérente.")

        meta_path, vector_path = self._paths(document_id)
        payload = {
            "document_id": document_id,
            "document": document,
            "category": category,
            "chunks": [
                {"chunk_id": chunk.ordinal, "label": chunk.label, "text": chunk.text}
                for chunk in chunks
            ],
        }
        tmp_meta = meta_path.with_suffix(".json.tmp")
        tmp_vectors = vector_path.with_suffix(".npy.tmp")
        tmp_meta.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        with open(tmp_vectors, "wb") as stream:  # np.save ajouterait « .npy » à un chemin suffixé
            np.save(stream, vectors)
        tmp_meta.replace(meta_path)
        tmp_vectors.replace(vector_path)

        with self._lock:
            self._vectors = None
            self._entries = []
            self._signature = ()
        return len(chunks)

    def remove_document(self, document_id: str) -> None:
        for path in self._paths(document_id):
            path.unlink(missing_ok=True)
            Path(str(path) + ".tmp").unlink(missing_ok=True)
        with self._lock:
            self._vectors = None
            self._entries = []
            self._signature = ()

    # --- lecture ----------------------------------------------------------

    def _signature_now(self) -> tuple:
        try:
            return tuple(sorted((path.name, path.stat().st_mtime_ns) for path in self.directory.glob("*.json")))
        except OSError:
            return ()

    def reload(self) -> None:
        with self._lock:
            entries: list[dict] = []
            matrices: list[np.ndarray] = []
            for meta_path in sorted(self.directory.glob("*.json")):
                vector_path = meta_path.with_suffix(".npy")
                if not vector_path.is_file():
                    logger.warning("Index incomplet, vecteurs absents pour %s", meta_path.name)
                    continue
                try:
                    payload = json.loads(meta_path.read_text(encoding="utf-8"))
                    vectors = np.load(vector_path)
                except (OSError, ValueError) as exc:
                    logger.warning("Index illisible pour %s : %s", meta_path.name, exc)
                    continue
                chunks = payload.get("chunks", [])
                if len(chunks) != len(vectors):
                    logger.warning("Index incohérent pour %s (chunks/vecteurs)", meta_path.name)
                    continue
                for chunk in chunks:
                    entries.append(
                        {
                            "id": f"{payload['document_id']}:{chunk['chunk_id']}",
                            "document_id": payload["document_id"],
                            "document": payload.get("document", "Document"),
                            "category": payload.get("category", "Général"),
                            "label": chunk.get("label", "Document"),
                            "chunk_id": int(chunk["chunk_id"]),
                            "text": chunk.get("text", ""),
                        }
                    )
                matrices.append(vectors)

            self._entries = entries
            self._vectors = np.vstack(matrices) if matrices else None
            self._signature = self._signature_now()
            logger.debug("Index rechargé : %s chunks, %s documents", len(entries), len(matrices))

    def _ensure_loaded(self) -> None:
        with self._lock:
            if self._vectors is None and not self._entries:
                self.reload()
            elif self._signature != self._signature_now():
                self.reload()

    @property
    def chunk_count(self) -> int:
        self._ensure_loaded()
        return len(self._entries)

    @property
    def document_count(self) -> int:
        return len(list(self.directory.glob("*.json")))

    @property
    def ready(self) -> bool:
        return self.chunk_count > 0

    def search(self, question: str, *, top_k: int = 5, category: str | None = None) -> list[dict]:
        """Recherche cosinus. Retourne des dictionnaires triés par score décroissant."""
        if not question or not question.strip():
            return []
        self._ensure_loaded()
        if self._vectors is None or not self._entries:
            return []

        question_vector = self._encode([question.strip()])[0]
        scores = np.dot(self._vectors, question_vector)

        candidates = range(len(self._entries))
        if category:
            wanted = category.strip().casefold()
            candidates = [index for index in candidates if self._entries[index]["category"].casefold() == wanted]
        if not candidates:
            return []

        ordered = sorted(candidates, key=lambda index: float(scores[index]), reverse=True)[: max(1, top_k)]
        results = []
        for index in ordered:
            entry = dict(self._entries[index])
            entry["score"] = float(scores[index])
            results.append(entry)
        return results

    def get_source(self, source_id: str) -> dict | None:
        document_id, _, chunk = source_id.rpartition(":")
        if not document_id:
            return None
        meta_path, _ = self._paths(document_id)
        if not meta_path.is_file():
            return None
        try:
            payload = json.loads(meta_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return None
        for item in payload.get("chunks", []):
            if str(item.get("chunk_id")) == chunk:
                return {
                    "id": source_id,
                    "document_id": document_id,
                    "document": payload.get("document", "Document"),
                    "category": payload.get("category", "Général"),
                    "label": item.get("label", "Document"),
                    "chunk_id": int(item["chunk_id"]),
                    "text": item.get("text", ""),
                    "score": None,
                }
        return None
