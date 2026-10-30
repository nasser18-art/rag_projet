"""Index par document : ajout, recherche, filtre, suppression, rechargement."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from rag.documents import Chunk
from rag.index import IndexManager

from .factories import FakeEncoder


def chunks_for(*texts: str) -> list[Chunk]:
    return [Chunk(ordinal=index, label=f"Page {index + 1}", text=text) for index, text in enumerate(texts)]


class IndexTests(unittest.TestCase):
    def setUp(self) -> None:
        self._directory = tempfile.TemporaryDirectory()
        self.path = Path(self._directory.name) / "index"
        self.encoder = FakeEncoder()
        self.index = IndexManager(self.path, encoder=self.encoder)

    def tearDown(self) -> None:
        self._directory.cleanup()

    def _add_contract(self) -> None:
        self.index.add_document(
            "contrat",
            document="Contrat Atlas.pdf",
            category="Juridique",
            chunks=chunks_for(
                "Le preavis de resiliation du contrat Atlas est de quatre-vingt-dix jours.",
                "La confidentialite des donnees est obligatoire pendant dix ans.",
            ),
        )

    def test_empty_index(self) -> None:
        self.assertFalse(self.index.ready)
        self.assertEqual(self.index.search("resiliation"), [])
        self.assertEqual(self.index.chunk_count, 0)

    def test_add_and_search(self) -> None:
        self._add_contract()
        self.assertEqual(self.index.chunk_count, 2)
        results = self.index.search("preavis de resiliation", top_k=2)
        self.assertTrue(results)
        self.assertIn("preavis", results[0]["text"])
        self.assertEqual(results[0]["document"], "Contrat Atlas.pdf")
        self.assertEqual(results[0]["id"], "contrat:0")
        self.assertGreater(results[0]["score"], 0)

    def test_category_filter(self) -> None:
        self._add_contract()
        self.index.add_document(
            "rh",
            document="Politique RH.docx",
            category="RH",
            chunks=chunks_for("Les conges sont valides par le manager."),
        )
        self.assertEqual(len(self.index.search("conges manager", category="RH")), 1)
        self.assertEqual(self.index.search("conges", category="Juridique")[0]["document"], "Contrat Atlas.pdf")
        self.assertEqual(self.index.search("conges", category="Inconnue"), [])

    def test_get_source(self) -> None:
        self._add_contract()
        source = self.index.get_source("contrat:1")
        self.assertIsNotNone(source)
        self.assertIn("confidentialite", source["text"])
        self.assertEqual(source["label"], "Page 2")
        self.assertIsNone(self.index.get_source("contrat:99"))
        self.assertIsNone(self.index.get_source("inconnu:0"))

    def test_persistence_and_reload(self) -> None:
        self._add_contract()
        reopened = IndexManager(self.path, encoder=self.encoder)
        self.assertEqual(reopened.chunk_count, 2)
        self.assertEqual(len(reopened.search("confidentialite")), 2)

    def test_reload_picks_up_external_changes(self) -> None:
        self._add_contract()
        self.index.chunk_count  # force le chargement
        self.index.add_document(
            "rh", document="Politique RH.docx", category="RH", chunks=chunks_for("Les conges sont valides.")
        )
        self.assertEqual(self.index.chunk_count, 3)

    def test_remove_document(self) -> None:
        self._add_contract()
        self.index.remove_document("contrat")
        self.assertEqual(self.index.chunk_count, 0)
        self.assertEqual(list(self.path.glob("contrat.*")), [])

    def test_empty_question_returns_nothing(self) -> None:
        self._add_contract()
        self.assertEqual(self.index.search("   "), [])


if __name__ == "__main__":
    unittest.main()
