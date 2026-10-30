"""Vérifie que la couche de jetons est cohérente avec elle-même.

Quatre contrôles, sans dépendance externe :
  1. chaque `var(--jeton)` utilisé dans css/*.css est défini quelque part
     (un `var(--jeton, repli)` est toléré : il porte sa propre valeur) ;
  2. chaque jeton de couleur défini en clair possède une contrepartie en sombre,
     et réciproquement — les deux blocs de `tokens.css` doivent rester jumeaux ;
  3. aucun composant n'écrit une couleur littérale : toute couleur en dur doit
     vivre dans `css/tokens.css` ;
  4. les accolades sont équilibrées dans chaque feuille.

Usage : python3 docs/design/tools/check_tokens.py
Code de sortie 1 si un contrôle échoue (utilisable en pré-commit ou en CI).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

CSS_DIR = Path(__file__).resolve().parents[3] / "frontend" / "css"
TOKENS = CSS_DIR / "tokens.css"
SHEETS = sorted(CSS_DIR.glob("*.css"))
DARK_BLOCK = re.compile(r':root\[data-theme="dark"\]\s*\{(?P<body>[^}]*)\}', re.S)
COLOR_VALUE = re.compile(r"^(#[0-9a-fA-F]{3,8}|rgba?\()")
LITERAL_COLOR = re.compile(r"(?<![-\w])(#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d)")


def strip_comments(css: str) -> str:
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def without_gradients(css: str) -> str:
    """Retire les fonctions de dégradé pour ne pas confondre leur syntaxe."""
    return re.sub(r"(?:repeating-)?(?:linear|radial|conic)-gradient\((?:[^()]|\([^()]*\))*\)", "", css)


def main() -> int:
    failures = 0

    sources = {path.name: strip_comments(path.read_text(encoding="utf-8")) for path in SHEETS}
    joined = "\n".join(sources.values())

    used = set(re.findall(r"var\(\s*(--[a-z0-9-]+)\s*[,)]", joined))
    used_with_fallback = set(re.findall(r"var\(\s*(--[a-z0-9-]+)\s*,", joined))
    defined = set(re.findall(r"(--[a-z0-9-]+)\s*:", joined))

    missing = sorted(used - defined - used_with_fallback)
    print(f"1. jetons utilises mais non definis : {len(missing)}")
    for token in missing:
        print(f"   - {token}")
    failures += len(missing)

    tokens_css = sources[TOKENS.name]
    light_match = re.search(r":root\s*\{(?P<body>[^}]*)\}", tokens_css, re.S)
    dark_match = DARK_BLOCK.search(tokens_css)
    if not light_match or not dark_match:
        print("ECHEC : impossible de localiser les blocs clair/sombre de tokens.css.")
        return 1

    def colour_tokens(body: str) -> set[str]:
        pairs = re.findall(r"(--[a-z0-9-]+)\s*:\s*([^;]+);", body)
        return {name for name, value in pairs if COLOR_VALUE.match(value.strip())}

    light, dark = colour_tokens(light_match.group("body")), colour_tokens(dark_match.group("body"))
    only_light, only_dark = sorted(light - dark), sorted(dark - light)
    print(f"2. jetons de couleur : clair {len(light)}, sombre {len(dark)}; "
          f"{len(only_light)} sans variante sombre, {len(only_dark)} en sombre seulement")
    for token in only_light:
        print(f"   - clair seulement : {token}")
    for token in only_dark:
        print(f"   - sombre seulement : {token}")
    failures += len(only_light) + len(only_dark)

    literals = 0
    for name, css in sources.items():
        if name == TOKENS.name:
            continue
        for line_number, line in enumerate(without_gradients(css).splitlines(), start=1):
            if LITERAL_COLOR.search(line):
                print(f"3. couleur litterale dans {name}:{line_number} : {line.strip()}")
                literals += 1
    print(f"3. couleurs litterales hors tokens.css : {literals}")
    failures += literals

    unbalanced = 0
    for name, css in sources.items():
        depth = 0
        for character in css:
            if character == "{":
                depth += 1
            elif character == "}":
                depth -= 1
                if depth < 0:
                    unbalanced += 1
        if depth != 0:
            unbalanced += abs(depth)
            print(f"4. accolades non equilibrees dans {name}")
    print(f"4. accolades non equilibrees : {unbalanced}")
    failures += unbalanced

    print()
    print(f"Jetons definis : {len(defined)} (couleur clair {len(light)}, sombre {len(dark)})")
    print("RESULTAT :", "OK" if failures == 0 else f"{failures} probleme(s)")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
