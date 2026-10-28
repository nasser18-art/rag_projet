# Assistant documentaire interne

Application web locale pour interroger le corpus documentaire de l'entreprise. Elle conserve également le chatbot historique en ligne de commande.

## Prérequis

- Python 3.11 à 3.13 recommandé (le modèle `sentence-transformers` nécessite PyTorch) ;
- une clé API Groq active ;
- accès Internet au premier démarrage pour télécharger le modèle d'embeddings si celui-ci n'est pas déjà en cache.

## Installation et configuration

Dans PowerShell, à la racine du projet :

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Ouvrez `.env` et renseignez `GROQ_API_KEY` avec une **nouvelle** clé Groq. La clé précédemment présente dans `09_chatbot.py` doit être révoquée dans Groq puis remplacée.

## Lancer l'application

Double-cliquez sur `run.bat`, ou exécutez :

```powershell
py -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Puis ouvrez `http://127.0.0.1:8000`. L'API de santé est disponible sur `GET /api/health`.

Le chatbot console reste disponible avec :

```powershell
py 09_chatbot.py
```

## Ajouter des documents et réindexer

1. Placez les PDF ou DOCX dans une catégorie de `documents/`.
2. Lancez, dans cet ordre, les scripts existants :

```powershell
py textes_bruts\04_extraction_masse.py
py 05_nettoyage.py
py 06_decoupage_chunks.py
py 07_embeddings.py
```

3. Redémarrez l’application web après la réindexation.

Les scripts de pipeline et l'application web utilisent des chemins relatifs à la racine du projet.

## Architecture

- `rag/engine.py` : moteur RAG réutilisable (recherche, génération, sources) ;
- `rag/config.py` : configuration et chemins ;
- `app.py` : API FastAPI et service des fichiers web ;
- `frontend/` : interface HTML/CSS/JavaScript sans CDN ;
- scripts historiques numérotés : préparation et indexation du corpus.

## Limites et suite recommandée

L'application n'inclut pas encore d'authentification, de contrôle d'accès par document, ni de journalisation métier/anonymisée. Pour un déploiement intranet, ajoutez un proxy HTTPS, une authentification SSO, une politique de conservation des logs et un processus de validation/versionnage du corpus.
