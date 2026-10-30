"""Contrat SSE de /api/chat, vérifié avec un moteur bouchonné.

Le vrai flux dépend de Groq (injoignable depuis cet environnement) : ce test
valide le format exact des trames, pas la génération.
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

import app as application
from rag.engine import RagConfigurationError, Source
from rag.store import Store


class StubEngine:
    def __init__(self, tokens=("Bonjour", " monde"), sources=None) -> None:
        self._tokens = tokens
        self._sources = sources or [
            Source("contrat:0", "Contrat Atlas.pdf", "Juridique", 0, "Le préavis est de 90 jours.", 0.87)
        ]
        self.calls = 0

    def health(self) -> dict:
        return {"status": "ok", "knowledge_base_ready": True, "llm_configured": True, "model": "stub"}

    def answer(self, question: str, category: str | None = None):
        return "".join(self._tokens), self._sources

    def stream_answer(self, question: str, category: str | None = None):
        self.calls += 1
        return iter(self._tokens), self._sources

    def get_source(self, source_id: str):
        return None


class FailingEngine(StubEngine):
    def stream_answer(self, question: str, category: str | None = None):
        raise RagConfigurationError("index absent")


class ChatStreamTests(unittest.TestCase):
    def setUp(self) -> None:
        self._directory = tempfile.TemporaryDirectory()
        self._previous = (application.engine, application.store)
        application.store = Store(Path(self._directory.name) / "chat.db")
        self.client = TestClient(application.app)

    def tearDown(self) -> None:
        application.engine, application.store = self._previous
        self._directory.cleanup()

    def _events(self, response) -> list[dict]:
        events = []
        for block in response.text.split("\n\n"):
            line = block.strip()
            if line.startswith("data: "):
                events.append(json.loads(line[6:]))
        return events

    def test_stream_sends_sources_then_tokens_then_done(self) -> None:
        application.engine = StubEngine()
        response = self.client.post("/api/chat", json={"question": "Quel est le préavis ?", "stream": True})
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/event-stream", response.headers["content-type"])

        events = self._events(response)
        self.assertEqual(events[0]["type"], "sources")
        self.assertEqual(events[0]["sources"][0]["document"], "Contrat Atlas.pdf")
        self.assertEqual([event["type"] for event in events[1:-1]], ["token", "token"])
        self.assertEqual("".join(event["content"] for event in events[1:-1]), "Bonjour monde")
        self.assertEqual(events[-1]["type"], "done")
        self.assertIn("conversation_id", events[-1])
        self.assertIn("message_id", events[-1])

    def test_non_streaming_mode_returns_json(self) -> None:
        application.engine = StubEngine()
        response = self.client.post("/api/chat", json={"question": "Quel est le préavis ?", "stream": False})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["answer"], "Bonjour monde")
        self.assertIn("conversation_id", response.json())
        self.assertEqual(len(response.json()["sources"]), 1)

    def test_configuration_error_is_503(self) -> None:
        application.engine = FailingEngine()
        response = self.client.post("/api/chat", json={"question": "Question", "stream": True})
        self.assertEqual(response.status_code, 503)
        self.assertIn("configur", response.json()["detail"].lower())

    def test_blank_question_is_rejected_before_the_engine(self) -> None:
        application.engine = StubEngine()
        response = self.client.post("/api/chat", json={"question": "  ", "stream": True})
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
