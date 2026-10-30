"""Configuration centralisée, chargée depuis .env sans secret en dur."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    project_root: Path = PROJECT_ROOT
    groq_api_key: str | None = os.getenv("GROQ_API_KEY") or None
    groq_model: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    top_k: int = int(os.getenv("TOP_K", "5"))
    min_relevance_score: float = float(os.getenv("MIN_RELEVANCE_SCORE", "0.20"))
    allowed_origins: tuple[str, ...] = tuple(origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "").split(",") if origin.strip())
    log_level: str = os.getenv("LOG_LEVEL", "INFO")

    # --- base documentaire (P1) --------------------------------------------
    data_dir: Path = Path(os.getenv("DATA_DIR") or PROJECT_ROOT / "data")
    max_upload_bytes: int = int(float(os.getenv("MAX_UPLOAD_MB", "25")) * 1024 * 1024)
    chunk_size: int = int(os.getenv("CHUNK_SIZE", "1000"))
    chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", "150"))

    @property
    def chunks_path(self) -> Path:
        return self.project_root / "chunks.json"

    @property
    def embeddings_path(self) -> Path:
        return self.project_root / "embeddings.npy"

    @property
    def database_path(self) -> Path:
        return self.data_dir / "rag.db"

    @property
    def index_dir(self) -> Path:
        return self.data_dir / "index"

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "documents"

    @property
    def allowed_extensions(self) -> tuple[str, ...]:
        """Formats réellement extractibles par rag/documents.py.

        Cette liste est la seule source de vérité : c'est elle qui alimente
        l'interface (voir GET /api/knowledge-bases) et la validation d'upload.
        """
        return ("pdf", "docx", "csv", "xlsx")

    def ensure_directories(self) -> None:
        for path in (self.data_dir, self.index_dir, self.uploads_dir):
            path.mkdir(parents=True, exist_ok=True)


settings = Settings()
