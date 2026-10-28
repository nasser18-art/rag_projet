# ============================================================
# 05_nettoyage.py
# Objectif : Nettoyer les textes bruts et écarter les fichiers vides
# ============================================================

from pathlib import Path
import re

# --- 1. Dossiers ---
RACINE_PROJET = Path(__file__).resolve().parent
DOSSIER_BRUT = RACINE_PROJET / "textes_bruts"
DOSSIER_PROPRE = RACINE_PROJET / "textes_propres"

DOSSIER_PROPRE.mkdir(exist_ok=True)

# --- 2. Fonction de nettoyage ---
def nettoyer_texte(texte):
    # Remplace les suites de sauts de ligne par un seul saut de ligne
    texte = re.sub(r'\n+', '\n', texte)
    # Remplace les suites d'espaces par un seul espace
    texte = re.sub(r' +', ' ', texte)
    # Enlève les espaces en début et fin de texte
    texte = texte.strip()
    return texte

print("🧹 Démarrage du nettoyage...")
print()

compteur_garde = 0
compteur_jete = 0

# --- 3. Parcours des fichiers bruts ---
for fichier in sorted(DOSSIER_BRUT.iterdir()):
    if fichier.suffix.lower() != ".txt":
        continue # On ne traite que les .txt
        
    # On lit le contenu
    with open(fichier, "r", encoding="utf-8") as f:
        texte = f.read()
        
    # On le nettoie
    texte_propre = nettoyer_texte(texte)
    
    # Règle : si après nettoyage il reste moins de 50 caractères, on jette !
    if len(texte_propre) < 50:
        print(f"🗑️  JETÉ (trop court / vide) : {fichier.name}")
        compteur_jete += 1
    else:
        # Sinon, on le sauvegarde dans le dossier propre
        chemin_sortie = DOSSIER_PROPRE / fichier.name
        with open(chemin_sortie, "w", encoding="utf-8") as f:
            f.write(texte_propre)
        
        print(f"✅ GARDÉ : {fichier.name} ({len(texte_propre)} caractères)")
        compteur_garde += 1

print()
print("=" * 50)
print(f"✨ Bilan : {compteur_garde} fichiers gardés, {compteur_jete} fichiers jetés.")
