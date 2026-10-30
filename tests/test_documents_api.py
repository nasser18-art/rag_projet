"""API documents : import, liste, suppression, réindexation, téléchargement.

L'encodeur d'embeddings est remplacé par une fonction déterministe : ces tests
n'ont besoin ni de Hugging Face, ni de Groq, ni d'une connexion réseau.
"""

from __future__ import annotations

import dataclasses
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

import app as application
from rag.config import settings as base_settings
from rag.index import IndexManager
from rag.store import Store

from .factories import FakeEncoder, make_csv, make_docx, make_pdf


class DocumentsApiTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self._directory = tempfile.TemporaryDirectory()
        self.root = Path(self._directory.name)
        self.settings = dataclasses.replace(base_settings, data_dir=self.root, max_upload_bytes=64 * 1024)
        self.settings.ensure_directories()

        self._previous = (application.settings, application.store, application.index_manager)
        application.settings = self.settings
        application.store = Store(self.root / "rag.db")
        application.index_manager = IndexManager(self.root / "index", encoder=FakeEncoder())

        self.client = TestClient(application.app)

    def tearDown(self) -> None:
        application.settings, application.store, application.index_manager = self._previous
        self._directory.cleanup()

    def upload(self, name: str, content: bytes, category: str = "Juridique"):
        return self.client.post(
            "/api/documents",
            files={"file": (name, content, "application/octet-stream")},
            data={"category": category},
        )


class UploadTests(DocumentsApiTestCase):
    def test_upload_pdf_and_list_it(self) -> None:
        response = self.upload("Contrat Atlas.pdf", make_pdf(["Le preavis est de 90 jours."]))
        self.assertEqual(response.status_code, 201, response.text)
        payload = response.json()
        self.assertEqual(payload["status"], "indexe")
        self.assertEqual(payload["ext"], "pdf")
        self.assertGreaterEqual(payload["chunk_count"], 1)
        self.assertEqual(payload["category"], "Juridique")

        listing = self.client.get("/api/documents").json()
        self.assertEqual(listing["total"], 1)
        self.assertEqual(listing["counts"]["indexe"], 1)
        self.assertEqual(listing["documents"][0]["name"], "Contrat Atlas.pdf")
        self.assertNotIn("stored_name", listing["documents"][0])

    def test_upload_docx_and_csv(self) -> None:
        self.assertEqual(self.upload("Politique.docx", make_docx(["Les conges sont valides."]), "RH").status_code, 201)
        self.assertEqual(self.upload("Annuaire.csv", make_csv([["Atlas", "fournisseur"]]), "RH").status_code, 201)
        self.assertEqual(len(self.client.get("/api/documents").json()["documents"]), 2)

    def test_duplicate_is_refused(self) -> None:
        content = make_pdf(["Texte unique."])
        self.assertEqual(self.upload("a.pdf", content).status_code, 201)
        duplicate = self.upload("copie.pdf", content)
        self.assertEqual(duplicate.status_code, 409)
        self.assertIn("déjà présent", duplicate.json()["detail"])

    def test_unsupported_extension(self) -> None:
        response = self.upload("script.exe", b"MZ\x90\x00")
        self.assertEqual(response.status_code, 415)
        self.assertIn("Format non pris en charge", response.json()["detail"])

    def test_empty_file(self) -> None:
        response = self.upload("vide.pdf", b"")
        self.assertEqual(response.status_code, 422)

    def test_wrong_signature(self) -> None:
        response = self.upload("faux.pdf", b"pas un pdf du tout")
        self.assertEqual(response.status_code, 415)

    def test_too_large(self) -> None:
        application.settings = dataclasses.replace(self.settings, max_upload_bytes=1024)
        try:
            response = self.upload("gros.pdf", make_pdf(["x" * 4000]))
            self.assertEqual(response.status_code, 413)
            self.assertIn("trop volumineux", response.json()["detail"])
        finally:
            application.settings = self.settings

    def test_corrupted_pdf_leaves_no_document(self) -> None:
        response = self.upload("casse.pdf", b"%PDF-1.4\ncontenu illisible")
        self.assertIn(response.status_code, {422})
        self.assertEqual(self.client.get("/api/documents").json()["total"], 0)


class LifecycleTests(DocumentsApiTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.document = self.upload(
            "Contrat Atlas.pdf",
            make_pdf(["Le preavis de resiliation est de 90 jours.", "La confidentialite est obligatoire."]),
        ).json()

    def test_download_original(self) -> None:
        response = self.client.get(f"/api/documents/{self.document['id']}/file")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))
        disposition = response.headers["content-disposition"]
        self.assertTrue(disposition.startswith("inline"), disposition)
        self.assertIn("Contrat%20Atlas.pdf", disposition)

    def test_reindex(self) -> None:
        response = self.client.post(f"/api/documents/{self.document['id']}/reindex")
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["status"], "indexe")

    def test_delete_removes_document_index_and_file(self) -> None:
        document_id = self.document["id"]
        self.assertEqual(self.client.delete(f"/api/documents/{document_id}").status_code, 204)
        self.assertEqual(self.client.get("/api/documents").json()["total"], 0)
        self.assertEqual(self.client.delete(f"/api/documents/{document_id}").status_code, 404)
        self.assertEqual(self.client.get(f"/api/documents/{document_id}/file").status_code, 404)
        self.assertEqual(list(self.settings.index_dir.glob(f"{document_id}.*")), [])

    def test_source_lookup_from_index(self) -> None:
        results = application.index_manager.search("preavis resiliation", top_k=1)
        self.assertTrue(results)
        response = self.client.get(f"/api/sources/{results[0]['id']}")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("preavis", payload["excerpt"])
        self.assertEqual(payload["document"], "Contrat Atlas.pdf")
        self.assertEqual(payload["page"], "Page 1")
        self.assertEqual(payload["document_id"], self.document["id"])

    def test_unknown_source_is_404(self) -> None:
        self.assertEqual(self.client.get("/api/sources/inconnu:0").status_code, 404)

    def test_knowledge_bases_and_health(self) -> None:
        bases = self.client.get("/api/knowledge-bases").json()
        self.assertEqual(bases["categories"][0]["name"], "Juridique")
        self.assertEqual(bases["formats"], ["pdf", "docx", "csv", "xlsx"])

        health = self.client.get("/api/health").json()
        self.assertEqual(health["documents_count"], 1)
        self.assertGreaterEqual(health["chunks_indexed"], 1)
        self.assertNotIn("gsk_", str(health))

    def test_listing_filters(self) -> None:
        self.upload("Politique.docx", make_docx(["Les conges."]), "RH")
        self.assertEqual(len(self.client.get("/api/documents?category=RH").json()["documents"]), 1)
        self.assertEqual(len(self.client.get("/api/documents?q=Atlas").json()["documents"]), 1)
        self.assertEqual(len(self.client.get("/api/documents?status=erreur").json()["documents"]), 0)


if __name__ == "__main__":
    unittest.main()
