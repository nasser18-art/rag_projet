"""Vérifie que la feuille de style est cohérente avec elle-même.

Trois contrôles, sans dépendance externe :
  1. chaque `var(--jeton)` utilisé est défini au moins une fois ;
  2. chaque jeton de couleur défini en clair possède une contrepartie en sombre
     (bloc `:root[data-theme="dark"]`), et réciproquement ;
  3. les accolades sont équilibrées.

Usage : python3 docs/design/tools/check_tokens.py
Code de sortie 1 si un contrôle échoue (utilisable en pré-commit ou en CI).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

STYLESHEET = Path(__file__).resolve().parents[3] / "frontend" / "styles.css"
DARK_BLOCK = re.compile(r':root\[data-theme="dark"\]\s*\{(?P<body>[^}]*)\}', re.S)


def strip_comments(css: str) -> str:
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def declarations(body: str) -> set[str]:
    return set(re.findall(r"(--[a-z0-9-]+)\s*:", body))


def main() -> int:
    css = strip_comments(STYLESHEET.read_text(encoding="utf-8"))
    used = set(re.findall(r"var\(\s*(--[a-z0-9-]+)", css))

    light_match = re.search(r":root\s*\{(?P<body>[^}]*)\}", css, re.S)
    dark_match = DARK_BLOCK.search(css)
    if not light_match or not dark_match:
        print("ECHEC : impossible de localiser les blocs de jetons.")
        return 1

    light = declarations(light_match.group("body"))
    dark = declarations(dark_match.group("body"))
    defined = set(re.findall(r"(--[a-z0-9-]+)\s*:", css))

    failures = 0

    missing = sorted(used - defined)
    print(f"1. jetons utilises mais non definis : {len(missing)}")
    for token in missing:
        print(f"   - {token}")
    failures += len(missing)

    # Seuls les jetons de couleur doivent exister dans les deux apparences : les
    # espacements, rayons, durées et polices sont communs par construction.
    light_colors = {token for token in light if token.startswith("--color-")}
    dark_colors = {token for token in dark if token.startswith("--color-")}
    only_light = sorted(light_colors - dark_colors)
    only_dark = sorted(dark_colors - light_colors)
    print(f"2. jetons de couleur : clair {len(light_colors)}, sombre {len(dark_colors)}; "
          f"{len(only_light)} sans variante sombre, {len(only_dark)} en sombre seulement")
    for token in only_light:
        print(f"   - clair seulement : {token}")
    for token in only_dark:
        print(f"   - sombre seulement : {token}")
    failures += len(only_light) + len(only_dark)

    depth = 0
    unbalanced = 0
    for character in css:
        if character == "{":
            depth += 1
        elif character == "}":
            depth -= 1
            if depth < 0:
                unbalanced += 1
    if depth != 0:
        unbalanced += abs(depth)
    print(f"3. accolades non equilibrees : {unbalanced}")
    failures += unbalanced

    print()
    print(f"Jetons definis : {len(defined)} (clair {len(light)}, sombre {len(dark)})")
    print("RESULTAT :", "OK" if failures == 0 else f"{failures} probleme(s)")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
