"""Tests de base de l'API existante (aucune dépendance réseau, aucun secret).

Ces tests décrivent le contrat AVANT intégration : ils doivent rester verts
après chaque étape du chantier. Ils n'initialisent ni modèle d'embeddings ni
appel Groq : ils n'exercent que les chemins configurables hors ligne.

Lancement :  python -m unittest discover -s tests -v
"""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

import app as application
from rag.config import settings


class BaseApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(application.app)
        cls.index_ready = settings.chunks_path.is_file() and settings.embeddings_path.is_file()

    # --- page et assets -----------------------------------------------------

    def test_root_serves_the_interface(self) -> None:
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/html", response.headers["content-type"])
        self.assertIn("<html", response.text.lower())

    def test_static_assets_are_served(self) -> None:
        for path in ("/static/css/tokens.css", "/static/js/app.js", "/static/icons.svg"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200, path)

    def test_unknown_route_is_404(self) -> None:
        self.assertEqual(self.client.get("/api/inconnu").status_code, 404)

    # --- santé --------------------------------------------------------------

    def test_health_exposes_no_secret(self) -> None:
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn(payload["status"], {"ok", "degraded"})
        self.assertIsInstance(payload["knowledge_base_ready"], bool)
        self.assertIsInstance(payload["llm_configured"], bool)
        self.assertNotIn("key", " ".join(payload).lower())
        self.assertNotIn("gsk_", response.text)

    # --- validation ---------------------------------------------------------

    def test_blank_question_is_rejected(self) -> None:
        response = self.client.post("/api/chat", json={"question": "   ", "stream": True})
        self.assertEqual(response.status_code, 422)

    def test_missing_question_is_rejected(self) -> None:
        response = self.client.post("/api/chat", json={"stream": True})
        self.assertEqual(response.status_code, 422)

    def test_too_long_question_is_rejected(self) -> None:
        response = self.client.post("/api/chat", json={"question": "a" * 4_001, "stream": True})
        self.assertEqual(response.status_code, 422)

    # --- chemins dégradés ---------------------------------------------------

    def test_chat_without_index_or_key_is_503_and_readable(self) -> None:
        if self.index_ready and settings.groq_api_key:
            self.skipTest("Corpus et clé configurés : ce test ne vise le chemin dégradé.")
        response = self.client.post("/api/chat", json={"question": "Question de test", "stream": True})
        self.assertEqual(response.status_code, 503)
        detail = response.json()["detail"]
        self.assertIn("configur", detail.lower())
        self.assertNotIn("Traceback", response.text)
        self.assertNotIn("gsk_", response.text)

    def test_unknown_source_is_404_or_503(self) -> None:
        response = self.client.get("/api/sources/inexistant:0")
        self.assertIn(response.status_code, {404, 503})
        self.assertNotIn("gsk_", response.text)


if __name__ == "__main__":
    unittest.main()
