# ============================================================
# 04_extraction_masse.py
# Objectif : extraire le texte de TOUS les documents et le sauvegarder
# ============================================================

from pathlib import Path
from pypdf import PdfReader
from docx import Document
import time

# --- 1. Les dossiers de travail ---
RACINE_PROJET = Path(__file__).resolve().parent.parent
DOSSIER_SOURCE = RACINE_PROJET / "documents"
DOSSIER_DESTINATION = RACINE_PROJET / "textes_bruts"

# On crée le dossier de destination s'il n'existe pas déjà
DOSSIER_DESTINATION.mkdir(exist_ok=True)

# --- 2. Les fonctions d'extraction ---

def extraire_pdf(chemin):
    """Ouvre un PDF et retourne tout son texte."""
    texte = ""
    reader = PdfReader(str(chemin))
    for page in reader.pages:
        texte += (page.extract_text() or "") + "\n"
    return texte

def extraire_docx(chemin):
    """Ouvre un Word et retourne tout son texte."""
    doc = Document(str(chemin))
    texte = ""
    for para in doc.paragraphs:
        texte += para.text + "\n"
    return texte

# --- 3. Le grand parcours ---
print("🚀 Démarrage de l'extraction en masse...")
print()

compteur_ok = 0
compteur_erreur = 0

# On parcourt chaque catégorie
for categorie in sorted(DOSSIER_SOURCE.iterdir()):
    if not categorie.is_dir():
        continue
    
    print(f"📁 Dossier : {categorie.name}")
    
    # On parcourt chaque fichier de la catégorie
    for fichier in categorie.iterdir():
        if fichier.is_file() and fichier.suffix.lower() in [".pdf", ".docx"]:
            
            # On prépare le nom du fichier de sortie
            nom_sortie = f"{categorie.name}_{fichier.stem}.txt"
            chemin_sortie = DOSSIER_DESTINATION / nom_sortie
            
            try:
                # On choisit la bonne méthode selon l'extension
                if fichier.suffix.lower() == ".pdf":
                    texte = extraire_pdf(fichier)
                else:
                    texte = extraire_docx(fichier)
                
                # On sauvegarde le texte dans un fichier
                # encoding="utf-8" est CRUCIAL pour garder les accents (é, à, ç...)
                with open(chemin_sortie, "w", encoding="utf-8") as f:
                    f.write(texte)
                
                print(f"   ✅ {fichier.name} -> {len(texte)} caractères")
                compteur_ok += 1
                
            except Exception as e:
                print(f"   ❌ ERREUR sur {fichier.name} : {e}")
                compteur_erreur += 1

print()
print("=" * 50)
print(f"✨ Terminé ! {compteur_ok} documents extraits avec succès.")
if compteur_erreur > 0:
    print(f"⚠️  {compteur_erreur} erreurs rencontrées.")
print(f"📂 Les fichiers textes sont dans : {DOSSIER_DESTINATION}")
