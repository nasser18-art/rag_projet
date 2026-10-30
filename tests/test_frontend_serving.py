"""Service de l'interface : build React en priorité, ancienne interface en repli.

Ces tests ne dépendent ni d'un build réel ni du réseau : un faux répertoire
`app-dist` est fabriqué dans un dossier temporaire, puis `app.REACT_DIST_DIR`
est redirigé dessus. L'ancienne interface de `frontend/` est vérifiée telle
quelle, puisqu'elle doit rester intacte et disponible.
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

import app as application
from rag.config import PROJECT_ROOT

REACT_INDEX = """<!doctype html>
<html lang="fr">
  <head><title>Nexus React</title><link rel="stylesheet" href="/assets/index-abc123.css"></head>
  <body><div id="root"></div><script type="module" src="/assets/index-abc123.js"></script></body>
</html>
"""


def make_dist(root: Path) -> Path:
    dist = root / "app-dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text(REACT_INDEX, encoding="utf-8")
    (dist / "assets" / "index-abc123.js").write_text("console.log('nexus-react')\n", encoding="utf-8")
    (dist / "assets" / "index-abc123.css").write_text(":root{--bg:#fbfbfd}\n", encoding="utf-8")
    (dist / "favicon.svg").write_text("<svg xmlns='http://www.w3.org/2000/svg'/>\n", encoding="utf-8")
    return dist


class ReactBuildMixin:
    """Installe un faux build React dans un dossier temporaire."""

    client: TestClient
    dist: Path

    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(application.app)
        cls.temp = tempfile.TemporaryDirectory()
        cls.dist = make_dist(Path(cls.temp.name))
        cls.previous = application.REACT_DIST_DIR
        application.REACT_DIST_DIR = cls.dist

    @classmethod
    def tearDownClass(cls) -> None:
        application.REACT_DIST_DIR = cls.previous
        cls.temp.cleanup()


class ReactBuildServedTests(ReactBuildMixin, unittest.TestCase):
    """Build présent : la racine sert React, les assets suivent, l'API est intacte."""

    def test_root_serves_the_react_build(self) -> None:
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/html", response.headers["content-type"])
        self.assertIn("</html>", response.text)
        self.assertIn("/assets/index-abc123.js", response.text)
        self.assertEqual(response.headers.get("cache-control"), "no-cache")

class ReactAssetsTests(ReactBuildMixin, unittest.TestCase):
    def test_assets_are_served_with_their_type(self) -> None:
        script = self.client.get("/assets/index-abc123.js")
        self.assertEqual(script.status_code, 200)
        self.assertIn("javascript", script.headers["content-type"])
        self.assertIn("nexus-react", script.text)
        self.assertIn("immutable", script.headers.get("cache-control", ""))

        style = self.client.get("/assets/index-abc123.css")
        self.assertEqual(style.status_code, 200)
        self.assertIn("text/css", style.headers["content-type"])

    def test_missing_asset_is_a_json_404(self) -> None:
        response = self.client.get("/assets/absent-000.js")
        self.assertEqual(response.status_code, 404)
        self.assertIn("application/json", response.headers["content-type"])
        self.assertNotIn("<html", response.text.lower())

    def test_asset_path_traversal_is_blocked(self) -> None:
        for path in ("/assets/%2e%2e/index.html", "/assets/..%2findex.html", "/assets/%2e%2e%2f%2e%2e%2fetc%2fpasswd"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 404)
                self.assertNotIn("root", response.text[:200].lower())

    def test_build_files_outside_assets_are_served(self) -> None:
        response = self.client.get("/favicon.svg")
        self.assertIn(response.status_code, (200,))
        self.assertIn("svg", response.headers["content-type"])


class FrontendRouteRefreshTests(ReactBuildMixin, unittest.TestCase):
    def test_frontend_routes_return_the_app_on_refresh(self) -> None:
        for path in ("/", "/documents", "/conversations/abc123", "/documents/"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertIn("text/html", response.headers["content-type"])
                self.assertIn("/assets/index-abc123.js", response.text)

    def test_api_prefix_is_never_handled_by_the_frontend(self) -> None:
        response = self.client.get("/api/inconnu")
        self.assertEqual(response.status_code, 404)
        self.assertIn("application/json", response.headers["content-type"])
        self.assertEqual(response.json()["detail"], "Not Found")

    def test_existing_api_routes_still_answer(self) -> None:
        health = self.client.get("/api/health")
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.json()["frontend"], "react")

        documents = self.client.get("/api/documents")
        self.assertEqual(documents.status_code, 200)
        self.assertIn("documents", documents.json())

        conversations = self.client.get("/api/conversations")
        self.assertEqual(conversations.status_code, 200)
        self.assertIn("conversations", conversations.json())

        knowledge = self.client.get("/api/knowledge-bases")
        self.assertEqual(knowledge.status_code, 200)
        self.assertIn("categories", knowledge.json())

        blank = self.client.post("/api/chat", json={"question": "   ", "stream": True})
        self.assertEqual(blank.status_code, 422)

    def test_legacy_static_files_remain_available(self) -> None:
        for path in ("/static/css/tokens.css", "/static/js/app.js", "/static/icons.svg"):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 200)


class LegacyFallbackTests(unittest.TestCase):
    """Build absent : l'ancienne interface prend le relais, sans casser l'API."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(application.app)
        cls.previous = application.REACT_DIST_DIR

    @classmethod
    def tearDownClass(cls) -> None:
        application.REACT_DIST_DIR = cls.previous

    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        application.REACT_DIST_DIR = Path(self.temp.name) / "absent"
        self.addCleanup(setattr, application, "REACT_DIST_DIR", self.previous)

    def test_root_falls_back_to_the_legacy_interface(self) -> None:
        legacy_index = (PROJECT_ROOT / "frontend" / "index.html").read_text(encoding="utf-8")
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/html", response.headers["content-type"])
        self.assertIn("<html", response.text.lower())
        self.assertNotIn("/assets/index-abc123.js", response.text)
        self.assertIn(legacy_index.strip()[:40], response.text)

    def test_react_assets_are_404_without_a_build(self) -> None:
        response = self.client.get("/assets/index-abc123.js")
        self.assertEqual(response.status_code, 404)
        self.assertIn("application/json", response.headers["content-type"])

    def test_frontend_routes_fall_back_too(self) -> None:
        response = self.client.get("/documents")
        self.assertEqual(response.status_code, 200)
        self.assertIn("<html", response.text.lower())

    def test_health_reports_the_legacy_frontend(self) -> None:
        payload = self.client.get("/api/health").json()
        self.assertEqual(payload["frontend"], "legacy")

    def test_api_still_works(self) -> None:
        self.assertEqual(self.client.get("/api/documents").status_code, 200)
        self.assertEqual(self.client.get("/api/inconnu").status_code, 404)


class LegacyInterfacePreservedTests(unittest.TestCase):
    """L'ancienne interface ne doit jamais être supprimée par l'intégration."""

    def test_legacy_files_are_still_in_the_repository(self) -> None:
        legacy = PROJECT_ROOT / "frontend"
        for relative in ("index.html", "css/tokens.css", "js/app.js", "icons.svg"):
            with self.subTest(file=relative):
                self.assertTrue((legacy / relative).is_file(), relative)

    def test_react_sources_are_in_the_repository(self) -> None:
        web = PROJECT_ROOT / "web"
        for relative in ("package.json", "src/App.tsx", "src/api/client.ts"):
            with self.subTest(file=relative):
                self.assertTrue((web / relative).is_file(), relative)


if __name__ == "__main__":
    unittest.main()
