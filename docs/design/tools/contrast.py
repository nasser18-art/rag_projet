"""Calcule les ratios de contraste WCAG 2.1 (AA) de la palette du projet.

Deux sections :
  1. « Après refonte » : les couples de jetons sont LUS dans frontend/css/tokens.css
     (bloc clair et bloc sombre). Si quelqu'un change une couleur, ce script
     mesure la nouvelle valeur — rien n'est recopié à la main.
  2. « Avant refonte » : la palette d'origine, conservée ici parce que les
     valeurs n'existent plus dans le CSS. Elle sert de référence à
     docs/design/audit.md.

Les jetons translucides (rgba) ne peuvent pas être mesurés deux à deux : ils
sont contrôlés à la main sur la surface qu'ils recouvrent (voir verification.md).

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

STYLESHEET = Path(__file__).resolve().parents[3] / "frontend" / "css" / "tokens.css"

# (avant-plan, arrière-plan, libellé, type de seuil)
PAIRS = [
    ("--label", "--bg", "texte principal / fond", "text"),
    ("--label", "--bg-surface", "texte principal / surface", "text"),
    ("--label-secondary", "--bg", "texte secondaire / fond", "text"),
    ("--label-secondary", "--bg-surface", "texte secondaire / surface", "text"),
    ("--accent", "--bg", "accent / fond", "text"),
    ("--accent", "--bg-surface", "accent / surface", "text"),
    ("--on-accent-fill", "--accent-fill", "libelle / aplat d'action", "text"),
    ("--danger", "--bg", "erreur / fond", "text"),
    ("--danger", "--bg-surface", "erreur / surface", "text"),
    ("--status-ok", "--bg-surface", "pastille d'etat / surface", "ui"),
    ("--grabber", "--bg-surface", "poignee de feuille / surface", "ui"),
    ("--separator", "--bg-surface", "filet de carte / surface", "decor"),
    ("--separator-opaque", "--bg-surface", "barre de defilement / surface", "decor"),
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


def to_rgb(value: str, backdrop: tuple[float, float, float] = (1.0, 1.0, 1.0)) -> tuple[float, float, float]:
    """Convertit un jeton en RGB, en compositant les rgba sur leur support."""
    value = value.strip()
    if value.startswith("#"):
        return hex_to_rgb(value)
    numbers = re.findall(r"[\d.]+", value)
    r, g, b = (float(number) / 255 for number in numbers[:3])
    alpha = float(numbers[3]) if len(numbers) > 3 else 1.0
    return tuple(channel * alpha + base * (1 - alpha) for channel, base in zip((r, g, b), backdrop))  # type: ignore[return-value]


def ratio(foreground: str, background: str) -> float:
    background_rgb = to_rgb(background)
    l1, l2 = luminance(to_rgb(foreground, background_rgb)), luminance(background_rgb)
    high, low = max(l1, l2), min(l1, l2)
    return (high + 0.05) / (low + 0.05)


def threshold(kind: str) -> float:
    return {"ui": 3.0, "decor": 0.0}.get(kind, 4.5)


def parse_blocks(css: str) -> tuple[dict[str, str], dict[str, str]]:
    without_comments = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    light_match = re.search(r":root\s*\{(?P<body>[^}]*)\}", without_comments, re.S)
    dark_match = re.search(r':root\[data-theme="dark"\]\s*\{(?P<body>[^}]*)\}', without_comments, re.S)
    if not light_match or not dark_match:
        raise SystemExit("Blocs de jetons introuvables dans frontend/css/tokens.css")

    def collect(body: str) -> dict[str, str]:
        return dict(re.findall(
            r"(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))\s*;", body))

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
        if kind == "decor":
            print(f"  {label.ljust(width)}  {value:5.2f}:1  decoratif, hors seuil"
                  f"   [{tokens[foreground]} sur {tokens[background]}]")
            continue
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
