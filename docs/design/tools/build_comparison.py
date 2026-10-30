"""Génère docs/design/comparison.html : avant/après côte à côte.

Pourquoi ce fichier existe : aucun navigateur n'est installable dans
l'environnement d'audit (CDN de Playwright bloqué, aucune distribution de
Chromium disponible). Des captures d'écran sont donc impossibles à produire.
À la place, ce script assemble une page autonome qui rend le VRAI HTML et le
VRAI CSS de chaque version dans des iframes `srcdoc`. Elle ne simule rien :
c'est le même balisage et la même feuille de style, affichés par le navigateur
du lecteur. À ouvrir directement (double-clic), aucune installation requise.

Les fichiers « avant » sont lus depuis Git (commit de référence), pas depuis
une copie manuelle : ce qui s'affiche est bien la version d'origine.

Usage :
    python3 docs/design/tools/build_comparison.py [--before REF]

REF par défaut : 9deec4f (master avant la refonte).
"""
from __future__ import annotations

import argparse
import html
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DOCS = ROOT / "docs" / "design"
OUTPUT = DOCS / "comparison.html"
DEFAULT_BEFORE = "9deec4f"

FRAME_CSS = """
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 32px 24px 64px;
    background: #f2f4f7;
    color: #101820;
    font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  }
  header { max-width: 1180px; margin: 0 auto 32px; }
  h1 { font-size: 1.6rem; margin: 0 0 8px; letter-spacing: -0.01em; }
  p.lede { margin: 0; color: #4a5661; max-width: 70ch; }
  .notice {
    margin: 20px 0 0; padding: 12px 16px; border-left: 4px solid #a4232a;
    background: #fdeceb; color: #101820; font-size: 0.95rem; max-width: 78ch;
  }
  section { max-width: 1180px; margin: 0 auto 48px; }
  h2 { font-size: 1.1rem; margin: 0 0 4px; }
  .caption { margin: 0 0 16px; color: #4a5661; font-size: 0.9rem; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
  .pair figure { margin: 0; }
  .pair figcaption {
    margin-bottom: 8px; font-size: 0.85rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.06em; color: #4a5661;
  }
  .viewport {
    overflow: hidden; border: 1px solid #c9d2db; border-radius: 10px;
    background: #fff; box-shadow: 0 6px 18px rgba(16, 30, 42, 0.08);
  }
  .viewport iframe { border: 0; display: block; transform-origin: top left; }
  .desktop iframe { width: 1440px; height: 900px; transform: scale(0.395); }
  .desktop { width: 100%; height: 356px; }
  .mobile iframe { width: 390px; height: 780px; }
  .mobile { width: 390px; margin: 0 auto; }
  .mobile-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; justify-items: center; }
  @media (max-width: 900px) {
    .pair, .mobile-pair { grid-template-columns: 1fr; }
    .desktop iframe { transform: scale(0.24); }
    .desktop { height: 216px; }
  }
  footer { max-width: 1180px; margin: 0 auto; color: #4a5661; font-size: 0.85rem; }
"""


def git_show(ref: str, path: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(ROOT), "show", f"{ref}:{path}"],
        capture_output=True, text=True, check=False,
    )
    if result.returncode != 0:
        raise SystemExit(f"Impossible de lire {path} à la révision {ref} :\n{result.stderr}")
    return result.stdout


def strip_runtime(document: str) -> str:
    """Retire le script applicatif : on compare l'apparence, pas le comportement."""
    document = document.replace('  <script src="/static/app.js"></script>\n', "")
    document = document.replace('  <script src="/static/app.js"></script>', "")
    return document


def inline_css(document: str, css: str) -> str:
    marker = '<link rel="stylesheet" href="/static/styles.css">'
    if marker not in document:
        raise SystemExit("Lien de feuille de style introuvable dans index.html")
    return document.replace(marker, f"<style>\n{css}\n</style>")


def force_theme(document: str, theme: str) -> str:
    """Fixe l'apparence et neutralise le script de résolution du thème."""
    start = document.find("<script>\n    (function () {")
    end = document.find("</script>", start)
    document = document[:start] + document[end + len("</script>"):]
    document = document.replace(
        '<html lang="fr">',
        f'<html lang="fr" data-theme="{theme}" data-theme-mode="{theme}">',
    )
    if theme == "light":
        # La version d'origine n'avait pas d'attribut en clair ; on le retire
        # pour reproduire exactement son apparence par défaut.
        document = document.replace(
            '<html lang="fr" data-theme="light" data-theme-mode="light">',
            '<html lang="fr">',
        )
    return document


def frame(document: str) -> str:
    return f'<iframe title="aperçu" loading="lazy" srcdoc="{html.escape(document, quote=True)}"></iframe>'


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--before", default=DEFAULT_BEFORE)
    args = parser.parse_args()

    before_html = inline_css(strip_runtime(git_show(args.before, "frontend/index.html")),
                             git_show(args.before, "frontend/styles.css"))
    after_html_raw = (ROOT / "frontend/index.html").read_text(encoding="utf-8")
    after_css = (ROOT / "frontend/styles.css").read_text(encoding="utf-8")
    after_html = inline_css(strip_runtime(after_html_raw), after_css)

    def light(doc: str) -> str:
        return doc

    def dark(doc: str) -> str:
        if 'data-theme-mode' in doc and "<script>" in doc:
            return force_theme(doc, "dark")
        return doc.replace('<html lang="fr">', '<html lang="fr" data-theme="dark">')

    frames = {
        "before-light": light(before_html),
        "after-light": light(after_html),
        "before-dark": dark(before_html),
        "after-dark": dark(after_html),
    }

    page = f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Assistant documentaire — avant / après</title>
<style>{FRAME_CSS}</style>
</head>
<body>
<header>
  <h1>Assistant documentaire — avant / après refonte</h1>
  <p class="lede">Chaque cadre rend le <strong>vrai</strong> balisage et la <strong>vraie</strong>
  feuille de style de la version correspondante (l'« avant » est lu depuis Git à la révision
  <code>{html.escape(args.before)}</code>). Bureau à 1440 px de large, mobile à 390 px.</p>
  <p class="notice"><strong>Ce ne sont pas des captures d'écran.</strong> Aucun navigateur
  n'était exécutable dans l'environnement d'audit (téléchargement de Chromium bloqué par le
  réseau). Cette page est le substitut honnête : ce que vous voyez est rendu par votre propre
  navigateur, à partir des mêmes fichiers. Le script applicatif est retiré : on compare
  l'apparence, pas les interactions.</p>
</header>

<section>
  <h2>Bureau — 1440 px</h2>
  <p class="caption">État d'accueil. À gauche l'ancienne interface, à droite la nouvelle.</p>
  <div class="pair">
    <figure>
      <figcaption>Avant — clair</figcaption>
      <div class="viewport desktop">{frame(frames['before-light'])}</div>
    </figure>
    <figure>
      <figcaption>Après — clair</figcaption>
      <div class="viewport desktop">{frame(frames['after-light'])}</div>
    </figure>
  </div>
</section>

<section>
  <h2>Bureau — 1440 px, apparence sombre</h2>
  <p class="caption">Le texte blanc sur l'aplat accent de l'ancienne version tombait à 2,02:1.</p>
  <div class="pair">
    <figure>
      <figcaption>Avant — sombre</figcaption>
      <div class="viewport desktop">{frame(frames['before-dark'])}</div>
    </figure>
    <figure>
      <figcaption>Après — sombre</figcaption>
      <div class="viewport desktop">{frame(frames['after-dark'])}</div>
    </figure>
  </div>
</section>

<section>
  <h2>Mobile — 390 px</h2>
  <p class="caption">Sous 700 px, l'ancienne version supprimait l'historique ; la nouvelle
  l'ouvre dans un tiroir (bouton ☰ de l'en-tête).</p>
  <div class="mobile-pair">
    <figure>
      <figcaption>Avant — mobile</figcaption>
      <div class="viewport mobile">{frame(frames['before-light'])}</div>
    </figure>
    <figure>
      <figcaption>Après — mobile</figcaption>
      <div class="viewport mobile">{frame(frames['after-light'])}</div>
    </figure>
  </div>
</section>

<footer>
  Généré par <code>docs/design/tools/build_comparison.py</code>. Les ratios de contraste cités
  sont calculés par <code>docs/design/tools/contrast.py</code>, pas estimés à l'œil.
</footer>
</body>
</html>
"""
    OUTPUT.write_text(page, encoding="utf-8")
    size_kb = OUTPUT.stat().st_size / 1024
    print(f"Écrit : {OUTPUT.relative_to(ROOT)} ({size_kb:.0f} Ko, {len(page)} caractères)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
