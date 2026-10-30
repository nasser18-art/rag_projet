"""Persistance SQLite : documents, conversations, messages."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from rag.store import Store


class StoreTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self._directory = tempfile.TemporaryDirectory()
        self.store = Store(Path(self._directory.name) / "test.db")

    def tearDown(self) -> None:
        self._directory.cleanup()

    def _document(self, **overrides) -> dict:
        payload = {
            "document_id": "doc-1",
            "sha256": "a" * 64,
            "name": "Contrat Atlas.pdf",
            "category": "Juridique",
            "ext": "pdf",
            "size_bytes": 1234,
            "stored_name": "doc-1.pdf",
            "pages": 2,
        }
        payload.update(overrides)
        return self.store.create_document(**payload)


class DocumentStoreTests(StoreTestCase):
    def test_create_and_read(self) -> None:
        document = self._document()
        self.assertEqual(document["status"], "en_attente")
        self.assertEqual(document["chunk_count"], 0)
        self.assertEqual(self.store.get_document("doc-1")["name"], "Contrat Atlas.pdf")

    def test_indexing_and_errors(self) -> None:
        self._document()
        self.store.mark_indexed("doc-1", chunk_count=7, pages=3)
        document = self.store.get_document("doc-1")
        self.assertEqual(document["status"], "indexe")
        self.assertEqual(document["chunk_count"], 7)
        self.assertEqual(document["pages"], 3)
        self.assertIsNotNone(document["indexed_at"])

        self.store.mark_error("doc-1", "modèle indisponible")
        document = self.store.get_document("doc-1")
        self.assertEqual(document["status"], "erreur")
        self.assertEqual(document["error"], "modèle indisponible")

    def test_duplicate_sha_is_refused(self) -> None:
        self._document()
        with self.assertRaises(Exception):
            self._document(document_id="doc-2")

    def test_listing_filters_and_counts(self) -> None:
        self._document()
        self._document(document_id="doc-2", sha256="b" * 64, name="Politique RH.docx", ext="docx", category="RH")
        self.store.mark_indexed("doc-1", chunk_count=3, pages=None)

        self.assertEqual(len(self.store.list_documents()), 2)
        self.assertEqual(len(self.store.list_documents(status="indexe")), 1)
        self.assertEqual(len(self.store.list_documents(query="Atlas")), 1)
        self.assertEqual(len(self.store.list_documents(category="RH")), 1)
        counts = {row["name"]: row for row in self.store.categories()}
        self.assertEqual(counts["Juridique"]["documents"], 1)
        self.assertEqual(counts["Juridique"]["chunks"], 3)

    def test_delete(self) -> None:
        self._document()
        self.assertTrue(self.store.delete_document("doc-1"))
        self.assertIsNone(self.store.get_document("doc-1"))
        self.assertFalse(self.store.delete_document("doc-1"))
        self.assertEqual(self.store.count_documents(), 0)


class ConversationStoreTests(StoreTestCase):
    def test_conversation_lifecycle(self) -> None:
        conversation = self.store.create_conversation(title="Résiliation Atlas", category="Juridique")
        self.assertEqual([item["id"] for item in self.store.list_conversations()], [conversation["id"]])

        first = self.store.add_message(conversation["id"], role="user", content="Question ?")
        second = self.store.add_message(
            conversation["id"], role="assistant", content="Réponse.", sources=[{"id": "a:0"}], model="test-model"
        )
        self.assertEqual((first["role"], second["role"]), ("user", "assistant"))

        detail = self.store.get_conversation(conversation["id"])
        self.assertEqual([message["content"] for message in detail["messages"]], ["Question ?", "Réponse."])
        self.assertEqual(detail["messages"][1]["sources"], [{"id": "a:0"}])

        self.assertTrue(self.store.rename_conversation(conversation["id"], "Nouveau titre"))
        self.assertEqual(self.store.get_conversation(conversation["id"])["title"], "Nouveau titre")

        self.assertTrue(self.store.set_message_feedback(second["id"], "up"))
        self.assertEqual(self.store.get_conversation(conversation["id"])["messages"][1]["feedback"], "up")

    def test_delete_cascades_messages(self) -> None:
        conversation = self.store.create_conversation()
        self.store.add_message(conversation["id"], role="user", content="Bonjour")
        self.assertTrue(self.store.delete_conversation(conversation["id"]))
        self.assertIsNone(self.store.get_conversation(conversation["id"]))
        self.assertEqual(self.store.count_messages(), 0)

    def test_persistence_across_reopen(self) -> None:
        conversation = self.store.create_conversation(title="Persistant")
        reopened = Store(Path(self._directory.name) / "test.db")
        self.assertEqual(reopened.get_conversation(conversation["id"])["title"], "Persistant")


if __name__ == "__main__":
    unittest.main()
