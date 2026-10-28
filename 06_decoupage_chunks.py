# ============================================================
# 06_decoupage_chunks.py
# Objectif : Découper les textes propres en petits morceaux (chunks)
# ============================================================

from pathlib import Path
import json
from langchain_text_splitters import RecursiveCharacterTextSplitter

# --- 1. Dossiers ---
RACINE_PROJET = Path(__file__).resolve().parent
DOSSIER_SOURCE = RACINE_PROJET / "textes_propres"
FICHIER_SORTIE = RACINE_PROJET / "chunks.json"

# --- 2. Configuration du découpeur ---
splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,       # Taille max d'un chunk (en caractères)
    chunk_overlap=200,     # Chevauchement entre les chunks
    length_function=len,   # On mesure en caractères
    separators=["\n\n", "\n", ". ", " ", ""] # Ordre de priorité pour couper
)

print("✂️  Démarrage du découpage en chunks...")
print()

tous_les_chunks = []

# --- 3. Parcours des fichiers ---
for fichier in sorted(DOSSIER_SOURCE.iterdir()):
    if fichier.suffix.lower() != ".txt":
        continue
        
    with open(fichier, "r", encoding="utf-8") as f:
        texte = f.read()
        
    # On découpe le texte
    chunks = splitter.split_text(texte)
    
    # On sauvegarde chaque chunk avec ses métadonnées
    # C'est CRUCIAL pour plus tard : l'IA devra citer ses sources !
    nom_doc = fichier.stem.split("_")[0] # Récupère la catégorie (ex: "finance")
    
    for i, chunk in enumerate(chunks):
        tous_les_chunks.append({
            "source": fichier.stem,       # Le nom du document d'origine
            "categorie": nom_doc,         # La catégorie (rh, finance, etc.)
            "chunk_id": i,                # Le numéro du morceau
            "texte": chunk                # Le contenu
        })
        
    print(f"✂️  {fichier.name} -> {len(chunks)} chunks")

# --- 4. Sauvegarde de tous les chunks dans un fichier JSON ---
with open(FICHIER_SORTIE, "w", encoding="utf-8") as f:
    json.dump(tous_les_chunks, f, ensure_ascii=False, indent=2)

print()
print("=" * 50)
print(f"✨ Terminé ! {len(tous_les_chunks)} chunks créés au total.")
print(f"💾 Sauvegardés dans : {FICHIER_SORTIE}")
