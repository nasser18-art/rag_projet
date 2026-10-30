"""Calcule les ratios de contraste WCAG 2.1 (AA) de la palette du projet.

Deux sections :
  1. « Après refonte » : les couples de jetons sont LUS dans frontend/styles.css
     (bloc clair et bloc sombre). Si quelqu'un change une couleur, ce script
     mesure la nouvelle valeur — rien n'est recopié à la main.
  2. « Avant refonte » : la palette d'origine, conservée ici parce que les
     valeurs n'existent plus dans le CSS. Elle sert de référence à
     docs/design/audit.md.

Seuils appliqués (accessibility.md › Vision, tableau WCAG AA) :
  - texte jusqu'à 17 pt : 4,5:1
  - texte de 18 pt ou plus, ou gras : 3:1
  - éléments non textuels (limites de contrôles, anneau de focus) : 3:1,
    seuil WCAG 1.4.11 — le skill ne le cite pas, c'est un ajout explicite.

Usage :
    python3 docs/design/tools/contrast.py            # tout
    python3 docs/design/tools/contrast.py --strict   # code de sortie 1 si un échec

Aucune dépendance externe.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

STYLESHEET = Path(__file__).resolve().parents[3] / "frontend" / "styles.css"

# (avant-plan, arrière-plan, libellé, type de seuil)
PAIRS = [
    ("--color-text", "--color-bg", "texte principal / fond", "text"),
    ("--color-text", "--color-surface", "texte principal / surface", "text"),
    ("--color-text-muted", "--color-bg", "texte secondaire / fond", "text"),
    ("--color-text-muted", "--color-surface", "texte secondaire / surface", "text"),
    ("--color-text-muted", "--color-surface-sunken", "texte secondaire / zone en creux", "text"),
    ("--color-text-placeholder", "--color-surface", "placeholder / surface", "text"),
    ("--color-text-on-accent", "--color-accent-solid", "texte / aplat d'action primaire", "text"),
    ("--color-accent", "--color-surface", "lien et icône / surface", "text"),
    ("--color-accent", "--color-accent-soft", "accent / fond d'accent", "text"),
    ("--color-text", "--color-user-bubble", "texte / bulle de l'utilisateur", "text"),
    ("--color-text-on-accent", "--color-avatar-assistant", "glyphe / avatar assistant", "text"),
    ("--color-text", "--color-avatar-user", "glyphe / avatar utilisateur", "text"),
    ("--color-danger", "--color-surface", "erreur / surface", "text"),
    ("--color-danger", "--color-danger-soft", "erreur / fond d'erreur", "text"),
    ("--color-success", "--color-surface", "confirmation / surface", "text"),
    ("--color-border-strong", "--color-surface", "limite de contrôle / surface", "ui"),
    ("--color-border-strong", "--color-bg", "limite de contrôle / fond", "ui"),
    ("--color-focus-ring", "--color-bg", "anneau de focus / fond", "ui"),
    ("--color-focus-ring", "--color-surface", "anneau de focus / surface", "ui"),
]

# Palette d'origine (avant refonte), pour la traçabilité de l'audit.
BEFORE = [
    ("#1d2733", "#f7f8fa", "texte principal / fond", "text"),
    ("#65727f", "#f7f8fa", "texte secondaire / fond", "text"),
    ("#828d97", "#ffffff", "placeholder (muted à 82 %) / surface", "text"),
    ("#ffffff", "#126e62", "blanc / accent clair (bouton)", "text"),
    ("#ffffff", "#5ac8b8", "blanc / accent sombre (bouton)", "text"),
    ("#1d2733", "#126e62", "glyphe / avatar assistant (clair)", "text"),
    ("#1d2733", "#536577", "glyphe / avatar utilisateur (clair)", "text"),
    ("#edf2f7", "#5ac8b8", "glyphe / avatar assistant (sombre)", "text"),
    ("#e3e7eb", "#f7f8fa", "bordure / fond", "ui"),
]


def hex_to_rgb(value: str) -> tuple[float, float, float]:
    value = value.strip().lstrip("#")
    if len(value) == 3:
        value = "".join(char * 2 for char in value)
    return tuple(int(value[i:i + 2], 16) / 255 for i in (0, 2, 4))  # type: ignore[return-value]


def luminance(rgb: tuple[float, float, float]) -> float:
    def channel(c: float) -> float:
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (channel(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(foreground: str, background: str) -> float:
    l1, l2 = luminance(hex_to_rgb(foreground)), luminance(hex_to_rgb(background))
    high, low = max(l1, l2), min(l1, l2)
    return (high + 0.05) / (low + 0.05)


def threshold(kind: str) -> float:
    return 3.0 if kind == "ui" else 4.5


def parse_blocks(css: str) -> tuple[dict[str, str], dict[str, str]]:
    without_comments = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    light_match = re.search(r":root\s*\{(?P<body>[^}]*)\}", without_comments, re.S)
    dark_match = re.search(r':root\[data-theme="dark"\]\s*\{(?P<body>[^}]*)\}', without_comments, re.S)
    if not light_match or not dark_match:
        raise SystemExit("Blocs de jetons introuvables dans frontend/styles.css")

    def collect(body: str) -> dict[str, str]:
        return dict(re.findall(r"(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;", body))

    return collect(light_match.group("body")), collect(dark_match.group("body"))


def report(rows: list[tuple[str, str, str, str]], tokens: dict[str, str], title: str) -> int:
    print(title)
    print("-" * len(title))
    width = max(len(label) for _, _, label, _ in rows)
    failures = 0
    for foreground, background, label, kind in rows:
        if foreground not in tokens or background not in tokens:
            print(f"  {label.ljust(width)}  JETON MANQUANT ({foreground} / {background})")
            failures += 1
            continue
        value = ratio(tokens[foreground], tokens[background])
        limit = threshold(kind)
        status = "OK" if value >= limit else "ECHEC"
        if value < limit:
            failures += 1
        print(f"  {label.ljust(width)}  {value:5.2f}:1  seuil {limit:.1f}  {status}"
              f"   [{tokens[foreground]} sur {tokens[background]}]")
    print()
    return failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strict", action="store_true", help="code de sortie 1 si un échec")
    args = parser.parse_args()

    css = STYLESHEET.read_text(encoding="utf-8")
    light, dark = parse_blocks(css)

    failures = 0
    failures += report(PAIRS, light, "Après refonte — apparence claire")
    failures += report(PAIRS, dark, "Après refonte — apparence sombre")

    before_rows = [(fg, bg, label, kind) for fg, bg, label, kind in BEFORE]
    before_tokens = {}
    for index, (foreground, background, _, _) in enumerate(before_rows):
        before_tokens[f"fg{index}"] = foreground
        before_tokens[f"bg{index}"] = background
    remapped = [(f"fg{index}", f"bg{index}", label, kind)
                for index, (_, _, label, kind) in enumerate(before_rows)]
    before_failures = report(remapped, before_tokens, "Avant refonte — pour mémoire (audit)")

    print(f"Échecs actuels : {failures} · échecs d'origine documentés : {before_failures}")
    if args.strict and failures:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
