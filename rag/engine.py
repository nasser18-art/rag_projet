"""Moteur RAG : chargement, recherche, génération et citations."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Iterator

import numpy as np
from groq import Groq

from .config import Settings, settings

logger = logging.getLogger(__name__)
SYSTEM_PROMPT = """Tu es un assistant interne d'entreprise francophone. Réponds uniquement à partir des extraits documentaires fournis. Si l'information est absente, réponds exactement : « Je ne trouve pas cette information dans les documents fournis. » N'invente rien, n'utilise aucune connaissance extérieure et reste clair, concis et professionnel."""


class RagConfigurationError(RuntimeError):
    """Configuration ou index RAG indisponible."""


class RagProviderError(RuntimeError):
    """Erreur lors de l'appel au fournisseur de génération."""


@dataclass(frozen=True)
class Source:
    id: str
    document: str
    category: str
    chunk_id: int
    excerpt: str
    score: float

    def as_dict(self) -> dict:
        return {"id": self.id, "document": self.document, "category": self.category, "chunk_id": self.chunk_id, "excerpt": self.excerpt, "score": round(self.score, 4)}


class RagEngine:
    """Charge les artefacts une fois et répond aux questions du corpus."""

    def __init__(self, config: Settings = settings) -> None:
        self.config = config
        self._chunks: list[dict] | None = None
        self._embeddings: np.ndarray | None = None
        self._model: object | None = None
        self._client: Groq | None = None

    def _load_knowledge_base(self) -> None:
        if self._chunks is not None:
            return
        for path in (self.config.chunks_path, self.config.embeddings_path):
            if not path.is_file():
                raise RagConfigurationError(f"Artefact RAG introuvable : {path.name}")
        try:
            self._chunks = json.loads(self.config.chunks_path.read_text(encoding="utf-8"))
            self._embeddings = np.load(self.config.embeddings_path)
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            raise RagConfigurationError("Les artefacts RAG ne peuvent pas être chargés.") from exc
        if self._embeddings.ndim != 2 or len(self._chunks) != len(self._embeddings):
            raise RagConfigurationError("chunks.json et embeddings.npy sont incohérents. Réindexez le corpus.")

    def _load_model(self):
        if self._model is None:
            logger.info("Chargement du modèle d'embeddings : %s", self.config.embedding_model)
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as exc:
                raise RagConfigurationError("Les dépendances de recherche ne sont pas installées.") from exc
            self._model = SentenceTransformer(self.config.embedding_model)
        return self._model

    def _get_client(self) -> Groq:
        if not self.config.groq_api_key:
            raise RagConfigurationError("La variable GROQ_API_KEY n'est pas configurée.")
        if self._client is None:
            self._client = Groq(api_key=self.config.groq_api_key)
        return self._client

    def health(self) -> dict:
        ready = self.config.chunks_path.is_file() and self.config.embeddings_path.is_file()
        return {"status": "ok" if ready else "degraded", "knowledge_base_ready": ready, "llm_configured": bool(self.config.groq_api_key), "model": self.config.groq_model}

    def search(self, question: str, top_k: int | None = None) -> list[Source]:
        if not question.strip():
            return []
        self._load_knowledge_base()
        assert self._chunks is not None and self._embeddings is not None
        vector = self._load_model().encode(question, normalize_embeddings=True)
        scores = np.dot(self._embeddings, vector)
        count = min(top_k or self.config.top_k, len(self._chunks))
        indices = np.argsort(scores)[-count:][::-1]
        return [Source(f"{self._chunks[i]['source']}:{self._chunks[i]['chunk_id']}", self._chunks[i]["source"], self._chunks[i]["categorie"], int(self._chunks[i]["chunk_id"]), self._chunks[i]["texte"], float(scores[i])) for i in indices]

    def get_source(self, source_id: str) -> Source | None:
        self._load_knowledge_base()
        assert self._chunks is not None
        for chunk in self._chunks:
            if f"{chunk['source']}:{chunk['chunk_id']}" == source_id:
                return Source(source_id, chunk["source"], chunk["categorie"], int(chunk["chunk_id"]), chunk["texte"], 0.0)
        return None

    @staticmethod
    def _context(sources: list[Source]) -> str:
        return "\n".join(f"--- Extrait du document : {s.document} ---\n{s.excerpt}" for s in sources)

    def _messages(self, question: str, sources: list[Source]) -> list[dict[str, str]]:
        return [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": f"Extraits :\n{self._context(sources)}\n\nQuestion : {question}"}]

    def answer(self, question: str) -> tuple[str, list[Source]]:
        sources = self.search(question)
        if not sources or sources[0].score < self.config.min_relevance_score:
            return "Je ne trouve pas cette information dans les documents fournis.", []
        try:
            response = self._get_client().chat.completions.create(model=self.config.groq_model, messages=self._messages(question, sources), temperature=0.1)
            return response.choices[0].message.content or "", sources
        except RagConfigurationError:
            raise
        except Exception as exc:
            logger.exception("Échec de génération Groq")
            raise RagProviderError("Le service de génération est temporairement indisponible.") from exc

    def stream_answer(self, question: str) -> tuple[Iterator[str], list[Source]]:
        sources = self.search(question)
        if not sources or sources[0].score < self.config.min_relevance_score:
            return iter(["Je ne trouve pas cette information dans les documents fournis."]), []
        try:
            completion = self._get_client().chat.completions.create(model=self.config.groq_model, messages=self._messages(question, sources), temperature=0.1, stream=True)
            def tokens() -> Iterator[str]:
                for chunk in completion:
                    content = chunk.choices[0].delta.content
                    if content:
                        yield content
            return tokens(), sources
        except RagConfigurationError:
            raise
        except Exception as exc:
            logger.exception("Échec de génération Groq en streaming")
            raise RagProviderError("Le service de génération est temporairement indisponible.") from exc


@lru_cache(maxsize=1)
def get_engine() -> RagEngine:
    return RagEngine()
