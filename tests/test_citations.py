"""P3 — citations numérotées, provenance des sources, filtre de catégorie.

Le client Groq est bouchonné (aucun réseau) mais le moteur, l'index et les
routes sont les vrais : on vérifie ce qui est réellement envoyé au modèle et
ce qui est réellement renvoyé au navigateur.
"""

from __future__ import annotations

import dataclasses
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient

import app as application
from rag.config import settings as base_settings
from rag.documents import Chunk
from rag.engine import RagEngine
from rag.index import IndexManager
from rag.store import Store

from .factories import FakeEncoder


class FakeGroq:
    """Client minimal : capture la requête, rend une réponse ou un flux."""

    def __init__(self, content: str = "Le préavis est de 90 jours [1].", tokens=("Le préavis ", "est de 90 jours [1].")) -> None:
        self.content = content
        self.tokens = tokens
        self.captured: dict | None = None
        self.calls = 0
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.calls += 1
        self.captured = kwargs
        if kwargs.get("stream"):
            tokens = self.tokens

            def generator():
                for token in tokens:
                    yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=token))])

            return generator()
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=self.content))])


class CitationTests(unittest.TestCase):
    def setUp(self) -> None:
        self._directory = tempfile.TemporaryDirectory()
        self.root = Path(self._directory.name)
        self.index = IndexManager(self.root / "index", encoder=FakeEncoder())
        self.index.add_document(
            "contrat",
            document="Contrat Atlas.pdf",
            category="Juridique",
            chunks=[
                Chunk(0, "Page 1", "Le preavis de resiliation est de quatre-vingt-dix jours."),
                Chunk(1, "Page 2", "La confidentialite est obligatoire pendant dix ans."),
            ],
        )
        self.index.add_document(
            "rh",
            document="Politique RH.docx",
            category="RH",
            chunks=[Chunk(0, "Document", "Les conges sont valides par le responsable.")],
        )
        self.settings = dataclasses.replace(base_settings, groq_api_key="cle-de-test", min_relevance_score=0.0)
        self.engine = RagEngine(self.settings, index_provider=lambda: self.index)
        self.groq = FakeGroq()
        self.engine._client = self.groq  # client injecté : aucun appel réseau

    def tearDown(self) -> None:
        self._directory.cleanup()

    def test_context_is_numbered_and_keeps_provenance(self) -> None:
        answer, sources = self.engine.answer("preavis de resiliation")
        self.assertEqual(answer, "Le préavis est de 90 jours [1].")

        payload = json.loads(json.dumps(self.groq.captured["messages"], ensure_ascii=False))
        system, user = payload[0]["content"], payload[1]["content"]
        self.assertIn("[1]", user)
        self.assertIn("Contrat Atlas.pdf — Page 1", user)
        self.assertIn("cite son numéro", system)
        self.assertIn("Je ne trouve pas cette information", system)
        self.assertTrue(sources[0].page)

    def test_category_filter_is_applied_to_retrieval(self) -> None:
        _, sources = self.engine.answer("conges", category="RH")
        self.assertTrue(all(source.category == "RH" for source in sources))
        self.assertIn("Politique RH.docx", sources[0].document)

    def test_stream_answer_yields_tokens_and_sources(self) -> None:
        tokens, sources = self.engine.stream_answer("preavis")
        self.assertEqual("".join(tokens), "Le préavis est de 90 jours [1].")
        self.assertEqual(sources[0].document, "Contrat Atlas.pdf")
        self.assertTrue(self.groq.captured["stream"])

    def test_source_reload_has_page_but_no_score(self) -> None:
        source = self.engine.get_source("contrat:0")
        self.assertEqual(source.page, "Page 1")
        self.assertIsNone(source.score)
        self.assertIsNone(source.as_dict()["score"])


class CitationApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self._directory = tempfile.TemporaryDirectory()
        self.root = Path(self._directory.name)
        self.index = IndexManager(self.root / "index", encoder=FakeEncoder())
        self.index.add_document(
            "contrat",
            document="Contrat Atlas.pdf",
            category="Juridique",
            chunks=[Chunk(0, "Page 1", "Le preavis de resiliation est de quatre-vingt-dix jours.")],
        )
        self.settings = dataclasses.replace(base_settings, groq_api_key="cle-de-test", min_relevance_score=0.0)
        engine = RagEngine(self.settings, index_provider=lambda: self.index)
        engine._client = FakeGroq()

        self._previous = (application.engine, application.store)
        application.engine = engine
        application.store = Store(self.root / "rag.db")
        self.client = TestClient(application.app)

    def tearDown(self) -> None:
        application.engine, application.store = self._previous
        self._directory.cleanup()

    def test_stream_exposes_page_and_score_then_persists_them(self) -> None:
        response = self.client.post("/api/chat", json={"question": "preavis de resiliation", "stream": True})
        self.assertEqual(response.status_code, 200, response.text)
        events = [
            json.loads(block.strip()[6:])
            for block in response.text.split("\n\n")
            if block.strip().startswith("data: ")
        ]
        first_source = events[0]["sources"][0]
        self.assertEqual(first_source["page"], "Page 1")
        self.assertGreater(first_source["score"], 0)
        self.assertEqual(first_source["document"], "Contrat Atlas.pdf")

        conversation_id = events[0]["conversation_id"]
        detail = self.client.get(f"/api/conversations/{conversation_id}").json()
        stored = detail["messages"][1]["sources"][0]
        self.assertEqual(stored["page"], "Page 1")
        self.assertGreater(stored["score"], 0)
        self.assertIn("[1]", detail["messages"][1]["content"])

    def test_source_endpoint_returns_page_and_no_fake_score(self) -> None:
        response = self.client.get("/api/sources/contrat:0")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["page"], "Page 1")
        self.assertIsNone(payload["score"])

    def test_category_is_forwarded_to_the_engine(self) -> None:
        captured: dict = {}

        class RecordingEngine:
            def answer(self, question, category=None):
                captured["category"] = category
                return "ok", []

            def stream_answer(self, question, category=None):
                captured["category"] = category
                return iter(["ok"]), []

            def health(self):
                return {}

            def get_source(self, source_id):
                return None

        application.engine = RecordingEngine()
        self.client.post("/api/chat", json={"question": "Question", "stream": False, "category": "RH"})
        self.assertEqual(captured["category"], "RH")


if __name__ == "__main__":
    unittest.main()
