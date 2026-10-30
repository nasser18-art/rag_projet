"""Calcule les ratios de contraste WCAG 2.1 (AA) d'une palette.

Usage : python3 docs/design/tools/contrast.py
Aucune dependance externe.
"""
from __future__ import annotations


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


def ratio(fg: str, bg: str) -> float:
    l1, l2 = luminance(hex_to_rgb(fg)), luminance(hex_to_rgb(bg))
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def verdict(value: float, size: str = "normal") -> str:
    if size in {"large", "bold"}:
        threshold = 3.0
    else:
        threshold = 4.5
    return "PASS" if value >= threshold else "FAIL"


PAIRS = [
    # (libelle, premier plan, arriere plan, taille de texte)
    ("light  texte principal / fond", "#1d2733", "#f7f8fa", "normal"),
    ("light  texte principal / surface", "#1d2733", "#ffffff", "normal"),
    ("light  texte secondaire (muted) / fond", "#65727f", "#f7f8fa", "normal"),
    ("light  texte secondaire (muted) / surface", "#65727f", "#ffffff", "normal"),
    ("light  accent (liens) / fond", "#126e62", "#f7f8fa", "normal"),
    ("light  blanc / accent (bouton)", "#ffffff", "#126e62", "normal"),
    ("light  placeholder (muted a 82%) / surface", "#828d97", "#ffffff", "normal"),
    ("light  texte / bulle utilisateur", "#1d2733", "#eaf1ff", "normal"),
    ("light  bordure / fond", "#e3e7eb", "#f7f8fa", "large"),
    ("dark   texte principal / fond", "#edf2f7", "#111827", "normal"),
    ("dark   texte principal / surface", "#edf2f7", "#192333", "normal"),
    ("dark   texte secondaire (muted) / fond", "#a6b1be", "#111827", "normal"),
    ("dark   texte secondaire (muted) / surface", "#a6b1be", "#192333", "normal"),
    ("dark   accent / surface", "#5ac8b8", "#192333", "normal"),
    ("dark   blanc / accent (bouton)", "#ffffff", "#5ac8b8", "normal"),
    ("dark   texte / bulle utilisateur", "#edf2f7", "#1b3454", "normal"),
]


def main() -> None:
    width = max(len(label) for label, *_ in PAIRS)
    print(f"{'paire'.ljust(width)}  ratio   seuil  verdict")
    print("-" * (width + 24))
    for label, fg, bg, size in PAIRS:
        value = ratio(fg, bg)
        threshold = 3.0 if size in {"large", "bold"} else 4.5
        print(f"{label.ljust(width)}  {value:5.2f}:1  {threshold:.1f}    {verdict(value, size)}")


if __name__ == "__main__":
    main()
