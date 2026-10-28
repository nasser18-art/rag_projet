# ============================================================
# 02_test_extraction_pdf.py
# Objectif : extraire le texte d'UN SEUL PDF pour vérifier
# ============================================================

from pathlib import Path
import importlib
import sys

try:
    PdfReader = importlib.import_module("pypdf").PdfReader
except ModuleNotFoundError:
    print("❌ Le paquet 'pypdf' n'est pas installé dans cet environnement Python.")
    print(f"Installez-le avec : {sys.executable} -m pip install pypdf")
    raise SystemExit(1)

# --- 1. Chemin du fichier à tester ---
CHEMIN_PDF = Path(__file__).resolve().parent / "documents" / "finance" / "OPA_PDT.pdf"

# --- 2. Vérification de sécurité ---
if not CHEMIN_PDF.exists():
    print(f"❌ Fichier introuvable : {CHEMIN_PDF}")
    exit()

# --- 3. Ouverture du PDF ---
print(f"📄 Fichier : {CHEMIN_PDF.name}")
reader = PdfReader(str(CHEMIN_PDF))

nb_pages = len(reader.pages)
print(f"📊 Nombre de pages : {nb_pages}")
print()

# --- 4. Extraction page par page ---
texte_complet = ""
for i, page in enumerate(reader.pages, start=1):
    texte_page = page.extract_text() or ""
    texte_complet += texte_page + "\n"
    print(f"  Page {i:>2} : {len(texte_page):>5} caractères extraits")

print()
print(f"📏 Taille totale du texte extrait : {len(texte_complet)} caractères")
print()

# --- 5. Aperçu du début ---
print("=" * 60)
print("🔍 APERÇU DU DÉBUT (500 premiers caractères)")
print("=" * 60)
print(texte_complet[:500])
print()

# --- 6. Aperçu de la fin ---
print("=" * 60)
print("🔍 APERÇU DE LA FIN (500 derniers caractères)")
print("=" * 60)
print(texte_complet[-500:])
