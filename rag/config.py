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

    @property
    def chunks_path(self) -> Path:
        return self.project_root / "chunks.json"

    @property
    def embeddings_path(self) -> Path:
        return self.project_root / "embeddings.npy"


settings = Settings()
