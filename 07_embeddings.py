# ============================================================
# 07_embeddings.py
# Objectif : Transformer les chunks en vecteurs (embeddings)
# ============================================================

from pathlib import Path
import json
import numpy as np
from sentence_transformers import SentenceTransformer
import time

# --- 1. Fichiers ---
RACINE_PROJET = Path(__file__).resolve().parent
FICHIER_CHUNKS = RACINE_PROJET / "chunks.json"
FICHIER_EMBEDDINGS = RACINE_PROJET / "embeddings.npy"

# --- 2. On charge les chunks ---
print("📥 Chargement des chunks...")
with open(FICHIER_CHUNKS, "r", encoding="utf-8") as f:
    chunks = json.load(f)
print(f"   {len(chunks)} chunks chargés.")

# --- 3. On charge le modèle d'embedding (le cerveau) ---
print("🧠 Chargement du modèle d'embedding (la 1ère fois, ça télécharge ~500 Mo)...")
modele = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
print("   Modèle prêt !")

# --- 4. On extrait juste les textes ---
textes = [chunk["texte"] for chunk in chunks]

# --- 5. On calcule les embeddings ---
print(f"⚙️  Calcul des vecteurs pour {len(textes)} chunks...")
debut = time.time()

embeddings = modele.encode(
    textes, 
    show_progress_bar=True, 
    normalize_embeddings=True
)

duree = time.time() - debut
print(f"✅ Calcul terminé en {duree:.1f} secondes.")

# --- 6. On affiche les dimensions ---
print(f"📏 Forme du tableau d'embeddings : {embeddings.shape}")

# --- 7. On sauvegarde ---
np.save(FICHIER_EMBEDDINGS, embeddings)
print(f"💾 Embeddings sauvegardés dans : {FICHIER_EMBEDDINGS}")
