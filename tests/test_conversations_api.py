"""Conversations et messages : routes, persistance après chat, retours, recherche.

Le moteur est bouchonné (Groq injoignable ici) mais tout le reste est réel :
SQLite sur disque, générateur SSE, transactions.
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

import app as application
from rag.engine import Source
from rag.store import Store


class StubEngine:
    def health(self) -> dict:
        return {"status": "ok", "knowledge_base_ready": True, "llm_configured": True, "model": "stub"}

    def stream_answer(self, question: str, category: str | None = None):
        return iter(["Réponse ", "en flux."]), [
            Source("doc:0", "Contrat Atlas.pdf", "Juridique", 0, "Le préavis est de 90 jours.", 0.91)
        ]

    def answer(self, question: str, category: str | None = None):
        return "Réponse complète.", [
            Source("doc:0", "Contrat Atlas.pdf", "Juridique", 0, "Le préavis est de 90 jours.", 0.91)
        ]

    def get_source(self, source_id: str):
        return None


class ConversationsApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self._directory = tempfile.TemporaryDirectory()
        self._previous = (application.engine, application.store)
        application.engine = StubEngine()
        application.store = Store(Path(self._directory.name) / "conv.db")
        self.client = TestClient(application.app)

    def tearDown(self) -> None:
        application.engine, application.store = self._previous
        self._directory.cleanup()

    # --- CRUD --------------------------------------------------------------

    def test_create_list_rename_delete(self) -> None:
        created = self.client.post("/api/conversations", json={"title": "Résiliation Atlas", "category": "Juridique"})
        self.assertEqual(created.status_code, 201)
        conversation = created.json()
        self.assertEqual(conversation["title"], "Résiliation Atlas")

        listing = self.client.get("/api/conversations").json()["conversations"]
        self.assertEqual([item["id"] for item in listing], [conversation["id"]])

        renamed = self.client.patch(f"/api/conversations/{conversation['id']}", json={"title": "Nouveau titre"})
        self.assertEqual(renamed.status_code, 200)
        self.assertEqual(renamed.json()["title"], "Nouveau titre")

        self.assertEqual(self.client.delete(f"/api/conversations/{conversation['id']}").status_code, 204)
        self.assertEqual(self.client.get(f"/api/conversations/{conversation['id']}").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/conversations/{conversation['id']}").status_code, 404)

    def test_unknown_conversation_is_404(self) -> None:
        self.assertEqual(self.client.get("/api/conversations/inconnu").status_code, 404)
        self.assertEqual(self.client.patch("/api/conversations/inconnu", json={"title": "x"}).status_code, 404)

    def test_invalid_title_is_rejected(self) -> None:
        self.assertEqual(self.client.post("/api/conversations", json={"title": ""}).status_code, 422)

    # --- chat + persistance -------------------------------------------------

    def test_stream_chat_creates_conversation_and_messages(self) -> None:
        response = self.client.post("/api/chat", json={"question": "Quel est le préavis ?", "stream": True})
        self.assertEqual(response.status_code, 200)

        events = [
            json.loads(block.strip()[6:])
            for block in response.text.split("\n\n")
            if block.strip().startswith("data: ")
        ]
        conversation_id = events[0]["conversation_id"]
        self.assertEqual(events[-1]["conversation_id"], conversation_id)

        detail = self.client.get(f"/api/conversations/{conversation_id}").json()
        self.assertEqual(detail["title"], "Quel est le préavis ?")
        self.assertEqual([message["role"] for message in detail["messages"]], ["user", "assistant"])
        self.assertEqual(detail["messages"][1]["content"], "Réponse en flux.")
        self.assertEqual(detail["messages"][1]["sources"][0]["document"], "Contrat Atlas.pdf")
        self.assertEqual(detail["messages"][1]["model"], application.settings.groq_model)

    def test_chat_in_existing_conversation_appends(self) -> None:
        conversation = self.client.post("/api/conversations", json={"title": "Existante"}).json()
        self.client.post(
            "/api/chat",
            json={"question": "Première question", "conversation_id": conversation["id"]},
        )
        self.client.post(
            "/api/chat",
            json={"question": "Seconde question", "conversation_id": conversation["id"]},
        )
        detail = self.client.get(f"/api/conversations/{conversation['id']}").json()
        self.assertEqual(len(detail["messages"]), 4)
        self.assertEqual(detail["title"], "Existante")
        self.assertEqual([m["content"] for m in detail["messages"] if m["role"] == "user"],
                         ["Première question", "Seconde question"])

    def test_chat_with_unknown_conversation_is_404(self) -> None:
        response = self.client.post(
            "/api/chat", json={"question": "Question", "conversation_id": "inconnu"}
        )
        self.assertEqual(response.status_code, 404)

    def test_non_streaming_chat_persists_too(self) -> None:
        response = self.client.post("/api/chat", json={"question": "Question simple", "stream": False})
        payload = response.json()
        detail = self.client.get(f"/api/conversations/{payload['conversation_id']}").json()
        self.assertEqual(detail["messages"][1]["content"], "Réponse complète.")

    def test_failed_chat_does_not_store_messages(self) -> None:
        writer = self.client.post("/api/conversations", json={"title": "Vide"}).json()
        application.engine = type("Broken", (StubEngine,), {
            "stream_answer": lambda self, question, category=None: (_ for _ in ()).throw(Exception("boom"))
        })()
        try:
            response = self.client.post(
                "/api/chat", json={"question": "Question", "conversation_id": writer["id"]}
            )
            self.assertEqual(response.status_code, 502)
            detail = self.client.get(f"/api/conversations/{writer['id']}").json()
            self.assertEqual(detail["messages"], [])
        finally:
            application.engine = StubEngine()

    def test_failed_engine_leaves_no_empty_conversation(self) -> None:
        from rag.engine import RagConfigurationError

        application.engine = type("Degraded", (StubEngine,), {
            "stream_answer": lambda self, question, category=None: (_ for _ in ()).throw(RagConfigurationError("index absent"))
        })()
        try:
            response = self.client.post("/api/chat", json={"question": "Question sans index"})
            self.assertEqual(response.status_code, 503)
            self.assertEqual(self.client.get("/api/conversations").json()["conversations"], [])
        finally:
            application.engine = StubEngine()

    # --- retours ------------------------------------------------------------

    def test_feedback_on_message(self) -> None:
        payload = self.client.post("/api/chat", json={"question": "Q", "stream": False}).json()
        message_id = payload["message_id"]

        self.assertEqual(self.client.post(f"/api/messages/{message_id}/feedback", json={"feedback": "up"}).status_code, 204)
        detail = self.client.get(f"/api/conversations/{payload['conversation_id']}").json()
        self.assertEqual(detail["messages"][1]["feedback"], "up")

        self.assertEqual(self.client.post(f"/api/messages/{message_id}/feedback", json={"feedback": None}).status_code, 204)
        self.assertEqual(self.client.post("/api/messages/inconnu/feedback", json={"feedback": "up"}).status_code, 404)
        self.assertEqual(self.client.post(f"/api/messages/{message_id}/feedback", json={"feedback": "peut-être"}).status_code, 422)

    # --- recherche transverse ----------------------------------------------

    def test_search_finds_conversations_and_documents(self) -> None:
        self.client.post("/api/conversations", json={"title": "Résiliation du contrat Atlas"})
        self.client.post("/api/conversations", json={"title": "Congés payés"})

        empty = self.client.get("/api/search").json()
        self.assertEqual(empty, {"documents": [], "conversations": []})

        found = self.client.get("/api/search?q=atlas").json()
        self.assertEqual(len(found["conversations"]), 1)
        self.assertIn("Atlas", found["conversations"][0]["title"])


if __name__ == "__main__":
    unittest.main()
