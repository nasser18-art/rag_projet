"""Le moteur historique doit savoir lire le nouvel index, sans changer d'API.

Aucun appel réseau : l'encodeur est simulé et le client Groq n'est jamais
instancié (les cas testés s'arrêtent au refus par seuil de pertinence).
"""

from __future__ import annotations

import dataclasses
import tempfile
import unittest
from pathlib import Path

from rag.config import settings as base_settings
from rag.documents import Chunk
from rag.engine import RagConfigurationError, RagEngine
from rag.index import IndexManager

from .factories import FakeEncoder

REFUSAL = "Je ne trouve pas cette information dans les documents fournis."


class EngineBridgeTests(unittest.TestCase):
    def setUp(self) -> None:
        self._directory = tempfile.TemporaryDirectory()
        self.index = IndexManager(Path(self._directory.name) / "index", encoder=FakeEncoder())
        self.index.add_document(
            "contrat",
            document="Contrat Atlas.pdf",
            category="Juridique",
            chunks=[
                Chunk(0, "Page 1", "Le preavis de resiliation du contrat Atlas est de quatre-vingt-dix jours."),
                Chunk(1, "Page 2", "La confidentialite des donnees est obligatoire."),
            ],
        )
        self.settings = dataclasses.replace(base_settings, min_relevance_score=0.20)
        self.engine = RagEngine(self.settings, index_provider=lambda: self.index)

    def tearDown(self) -> None:
        self._directory.cleanup()

    def test_search_uses_document_index(self) -> None:
        sources = self.engine.search("preavis de resiliation", top_k=2)
        self.assertTrue(sources)
        self.assertEqual(sources[0].document, "Contrat Atlas.pdf")
        self.assertEqual(sources[0].category, "Juridique")
        self.assertIn("preavis", sources[0].excerpt)
        self.assertGreater(sources[0].score, 0)

    def test_health_reports_ready(self) -> None:
        health = self.engine.health()
        self.assertTrue(health["knowledge_base_ready"])
        self.assertEqual(health["status"], "ok")

    def test_get_source_from_index(self) -> None:
        source = self.engine.get_source("contrat:1")
        self.assertIsNotNone(source)
        self.assertIn("confidentialite", source.excerpt)
        self.assertIsNone(self.engine.get_source("inconnu:0"))

    def test_answer_refuses_below_threshold_without_calling_the_model(self) -> None:
        strict = dataclasses.replace(self.settings, min_relevance_score=0.999)
        engine = RagEngine(strict, index_provider=lambda: self.index)
        answer, sources = engine.answer("question hors corpus sur les salaires")
        self.assertEqual(answer, REFUSAL)
        self.assertEqual(sources, [])

    def test_stream_answer_refuses_below_threshold(self) -> None:
        strict = dataclasses.replace(self.settings, min_relevance_score=0.999)
        engine = RagEngine(strict, index_provider=lambda: self.index)
        tokens, sources = engine.stream_answer("question hors corpus")
        self.assertEqual("".join(tokens), REFUSAL)
        self.assertEqual(sources, [])

    def test_without_index_nor_artifacts_the_error_is_explicit(self) -> None:
        empty = IndexManager(Path(self._directory.name) / "vide", encoder=FakeEncoder())
        engine = RagEngine(self.settings, index_provider=lambda: empty)
        with self.assertRaises(RagConfigurationError):
            engine.search("preavis")


if __name__ == "__main__":
    unittest.main()
