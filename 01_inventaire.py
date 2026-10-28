# ============================================================
# 01_inventaire.py
# Objectif : lister tous les PDF et DOCX de notre corpus
# ============================================================

# --- 1. On importe les outils dont on a besoin ---
from pathlib import Path
from collections import defaultdict

# --- 2. On indique où sont rangés les documents ---
DOSSIER_RACINE = Path(__file__).resolve().parent / "documents"
# --- 3. On prépare un compteur par catégorie ---
# Structure : { "finance": {"pdf": 6, "docx": 0}, "rh": {...}, ... }
compteur = defaultdict(lambda: {"pdf": 0, "docx": 0})
fichiers_inconnus = []

# --- 4. On parcourt chaque sous-dossier (chaque catégorie) ---
for categorie in sorted(DOSSIER_RACINE.iterdir()):
    if not categorie.is_dir():
        continue  # on ignore les fichiers à la racine

    # On regarde chaque fichier dans cette catégorie
    for fichier in categorie.iterdir():
        extension = fichier.suffix.lower()

        if extension == ".pdf":
            compteur[categorie.name]["pdf"] += 1
        elif extension == ".docx":
            compteur[categorie.name]["docx"] += 1
        elif extension == ".doc":
            fichiers_inconnus.append(str(fichier))
        # (on ignore le reste : images, .txt, etc.)

# --- 5. On affiche un tableau propre ---
print()
print(f"{'Catégorie':<30} | {'PDF':>4} | {'DOCX':>5} | {'Total':>6}")
print("-" * 55)

total_pdf = 0
total_docx = 0

for categorie, stats in compteur.items():
    total = stats["pdf"] + stats["docx"]
    total_pdf += stats["pdf"]
    total_docx += stats["docx"]
    print(f"{categorie:<30} | {stats['pdf']:>4} | {stats['docx']:>5} | {total:>6}")

print("-" * 55)
print(f"{'TOTAL':<30} | {total_pdf:>4} | {total_docx:>5} | {total_pdf + total_docx:>6}")

if fichiers_inconnus:
    print()
    print("⚠️  Fichiers .doc (ancien format Word) détectés :")
    for f in fichiers_inconnus:
        print(f"   - {f}")

print()
