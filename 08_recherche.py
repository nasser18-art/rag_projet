# ============================================================
# 08_recherche.py
# Objectif : Trouver les chunks les plus pertinents pour une question
# ============================================================

from pathlib import Path
import json
import numpy as np
from sentence_transformers import SentenceTransformer

# --- 1. Les fichiers ---
RACINE_PROJET = Path(__file__).resolve().parent
FICHIER_CHUNKS = RACINE_PROJET / "chunks.json"
FICHIER_EMBEDDINGS = RACINE_PROJET / "embeddings.npy"

# --- 2. Chargement des données ---
print("📥 Chargement de la base de connaissances...")
with open(FICHIER_CHUNKS, "r", encoding="utf-8") as f:
    chunks = json.load(f)
embeddings = np.load(FICHIER_EMBEDDINGS)

# --- 3. Chargement du même modèle (indispensable !) ---
print("🧠 Chargement du modèle...")
modele = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

# --- 4. La question de l'employé ---
question = "Quelles sont les règles d'utilisation d'internet au travail ?"
print(f"\n❓ Question : {question}")

# --- 5. On transforme la question en vecteur ---
vecteur_question = modele.encode(question, normalize_embeddings=True)

# --- 6. On calcule la similarité (produit scalaire) ---
# Comme les vecteurs sont normalisés, c'est équivalent à la similarité cosinus.
# On obtient un tableau de 2298 scores.
scores = np.dot(embeddings, vecteur_question)

# --- 7. On trie les scores pour avoir les meilleurs ---
# np.argsort trie par ordre croissant, on prend les 3 derniers (les plus proches)
# et on les remet dans le bon ordre (du plus grand au plus petit)
indices_top3 = np.argsort(scores)[-3:][::-1]

# --- 8. On affiche les résultats ---
print("\n" + "="*60)
print("🏆 TOP 3 DES CHUNKS LES PLUS PERTINENTS :")
print("="*60)

for rang, idx in enumerate(indices_top3, start=1):
    chunk = chunks[idx]
    score = scores[idx]
    
    print(f"\n--- Résultat n°{rang} (Score : {score:.4f}) ---")
    print(f"📄 Source : {chunk['source']}")
    print(f"📁 Catégorie : {chunk['categorie']}")
    print(f"📝 Texte : {chunk['texte'][:300]}...") # Affiche les 300 premiers caractères
