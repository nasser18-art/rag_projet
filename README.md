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

## Base documentaire (import, indexation, suppression)

Depuis P1, les documents s'importent directement par l'application (ou par
l'API) : plus besoin de relancer les quatre scripts. Les scripts historiques
restent disponibles pour la base déjà constituée.

### Formats réellement pris en charge

**PDF, DOCX, CSV, XLSX** — 25 Mo maximum par fichier, configurables.

| Format | Extraction | Provenance affichée |
|---|---|---|
| PDF | pypdf, page par page | `Page n` |
| DOCX | python-docx (paragraphes + tableaux) | `Document` |
| CSV | bibliothèque standard, séparateur détecté | `Tableau` |
| XLSX | openpyxl, feuille par feuille | `Feuille <nom>` |

Un PDF sans couche texte (document scanné) est refusé en 422 : aucun OCR n'est
embarqué, et l'interface ne doit pas prétendre le contraire.

### Routes

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/documents` | liste, filtres `?status=&q=&category=` |
| POST | `/api/documents` | import multipart (`file`, `category`) |
| DELETE | `/api/documents/{id}` | retire le document, ses chunks et ses vecteurs |
| POST | `/api/documents/{id}/reindex` | réindexe depuis le fichier conservé |
| GET | `/api/documents/{id}/file` | sert l'original (aperçu / téléchargement) |
| GET | `/api/knowledge-bases` | catégories et compteurs |
| GET | `/api/health` | état + nombre de documents et de chunks |

Codes d'erreur : `409` doublon (même empreinte SHA-256), `413` trop volumineux,
`415` format ou signature invalide, `422` fichier vide ou illisible, `503`
modèle d'embeddings indisponible.

### Données locales

Tout est écrit dans `data/` (ignoré par Git) :

- `data/rag.db` : SQLite — documents, conversations, messages ;
- `data/index/<document_id>.json` + `.npy` : chunks et vecteurs par document ;
- `data/documents/<document_id>.<ext>` : fichiers originaux conservés pour l'aperçu.

L'index est rechargé automatiquement quand un document est ajouté ou supprimé :
aucun redémarrage n'est nécessaire.

## Conversations

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/conversations` | liste, triée par activité |
| POST | `/api/conversations` | création (`title`, `category`) |
| GET | `/api/conversations/{id}` | messages + sources |
| PATCH | `/api/conversations/{id}` | renommage |
| DELETE | `/api/conversations/{id}` | suppression (messages en cascade) |
| POST | `/api/messages/{id}/feedback` | `up`, `down` ou `null` |
| GET | `/api/search?q=` | conversations + documents (palette ⌘K) |

### Citations et provenance

Le contexte envoyé au modèle est numéroté (`[1]`, `[2]`, …) et le prompt exige
que chaque affirmation cite son numéro. Le flux SSE renvoie les mêmes sources
dans le même ordre, avec leur provenance (`page`) et leur score de pertinence :
l'interface peut donc transformer `[1]` en infobulle sans deviner.

`POST /api/chat` accepte aussi `category` : la recherche est alors restreinte à
cette base de connaissances (issue de `GET /api/knowledge-bases`).

`GET /api/sources/{id}` renvoie `score: null` : un score n'a de sens qu'au
moment de la recherche, et l'API ne fabrique pas de valeur par défaut.

`POST /api/chat` accepte `conversation_id` (facultatif) : sans lui, une
conversation est créée et titrée avec la question ; avec un identifiant inconnu,
la route répond 404 sans rien écrire. Le flux SSE renvoie `conversation_id` dans
`sources` et dans `done` (avec `message_id`). Un échec du moteur ne laisse aucune
conversation vide.

## Interface React (Nexus)

L'interface du template « Nexus AI RAG Workspace » vit dans `web/` (React 19,
Vite, TypeScript). Elle n'affiche aucune donnée de démonstration : chaque écran
appelle les routes ci-dessus.

```sh
cd web
npm install
npm run dev      # http://localhost:5173, /api redirigé vers FastAPI (port 8000)
npm test         # 13 tests (rendu, formatage, lecture du flux SSE)
npm run build    # génère web/app-dist
```

Lancer FastAPI en parallèle (`uvicorn app:app --port 8000`) : le serveur de
développement Vite redirige `/api` vers `127.0.0.1:8000`, ce qui évite toute
URL absolue dans le navigateur.

Correspondance écran → route :

| Interface | Route |
| --- | --- |
| historique, bases de connaissances | `GET /api/conversations`, `GET /api/knowledge-bases` |
| question / réponse en flux | `POST /api/chat` (`stream: true`) |
| renvois `[n]`, « ouvrir le document » | `sources[]` du flux, `GET /api/sources/{id}`, `GET /api/documents/{id}/file` |
| retour d'usage | `POST /api/messages/{id}/feedback` |
| documents : import, filtres, détail, réindexation, suppression | `GET/POST /api/documents`, `/reindex`, `/file`, `DELETE` |
| palette ⌘K | `GET /api/search?q=` |
| état du service | `GET /api/health` |

L'ancienne interface `frontend/` reste en place et servie par FastAPI tant que le
basculement vers `web/app-dist` n'est pas fait ; elle est conservée telle quelle.

## Tests

```sh
python -m unittest discover -s tests -t .   # 88 tests
cd web && npm test                          # 13 tests
```

Côté Python, sans réseau : extraction des quatre formats, découpage, validation
d'upload, persistance SQLite, index (recherche, filtre, suppression,
rechargement), routes documents, conversations et messages, recherche transverse,
contrat SSE de `/api/chat` avec un moteur bouchonné, citations et provenance, et
le chemin « modèle d'embeddings absent ».

Côté React : rendu serveur des composants et de l'application complète,
formatage français, conversions `[n]` → sources, échappement du balisage, et
analyse du flux SSE reçu en trames partielles.

## Architecture

- `rag/engine.py` : moteur RAG (recherche, génération, sources) — lit l'index
  par document quand il existe, sinon les artefacts historiques ;
- `rag/index.py` : index vectoriel rechargeable, un fichier par document ;
- `rag/documents.py` : validation, extraction, nettoyage, découpage ;
- `rag/store.py` : persistance SQLite (documents, conversations, messages) ;
- `rag/config.py` : configuration et chemins ;
- `app.py` : API FastAPI et service des fichiers web ;
- `frontend/` : ancienne interface (HTML/CSS/JS, sans CDN), conservée pour référence ;
- `web/` : interface React/Vite connectée à l'API ;
- `tests/` : suite de tests sans réseau ;
- scripts historiques numérotés : préparation et indexation du corpus d'origine.

## Interface et règles de design

Le frontend suit les règles du skill **apple-design** (Human Interface Guidelines),
versionné dans `.design-rules/` sous forme de sous-module Git. Avant toute modification
d'interface, lire `.design-rules/SKILL.md` (voir `CLAUDE.md`).

- `docs/design/audit.md` : audit de l'interface, 48 constats avec fichier:ligne et règle du skill ;
- `docs/design/verification.md` : ce qui a été testé, les contrastes mesurés, les limites ;
- `docs/design/comparison.html` : avant/après, à ouvrir dans un navigateur (ce ne sont pas des
  captures d'écran) ;
- `docs/design/tools/` : mesures rejouables (contrastes, jetons, contrôles fonctionnels).

Après un clone, récupérer le sous-module :

```sh
git submodule update --init --recursive
```

## Limites et suite recommandée

L'application n'inclut pas encore d'authentification, de contrôle d'accès par document, ni de journalisation métier/anonymisée. Pour un déploiement intranet, ajoutez un proxy HTTPS, une authentification SSO, une politique de conservation des logs et un processus de validation/versionnage du corpus.
