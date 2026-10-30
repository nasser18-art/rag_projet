# Intégration du template « Nexus AI RAG Workspace » — analyse et plan technique

Statut : **phase d'analyse**. Aucun fichier de l'application n'a été modifié dans cet état des lieux. Deux tests de base ont été ajoutés (`tests/test_api_baseline.py`, 9/9 verts) parce qu'ils décrivent le contrat actuel et serviront de garde-fou.

---

## 0. Deux blocages à lever avant de coder l'interface

### 0.1 Le template Figma Make n'est pas dans l'espace de travail

Je l'ai cherché partout, sans résultat :

- `/home/user` et `/home/user/rag_projet` : aucun fichier `*.fig`, `*.zip`, `*.tsx`, `*.jsx`, aucun dossier `nexus*`, `figma*`, `src/`, `components/` ;
- aucun `package.json`, aucun `vite.config.*`, aucune trace de React/Tailwind ;
- la seule interface présente est celle que j'ai écrite (`frontend/`), pas le template.

Je ne peux donc pas « respecter la structure visuelle originale, les couleurs, typographies, espacements, composants, pages, animations » d'un document que je n'ai pas. Reconstituer « Nexus AI RAG Workspace » de mémoire serait exactement le contraire de la consigne : ce serait **ma** maquette, pas la vôtre.

**Ce qu'il me faut, au choix** (par ordre de préférence) :

1. l'archive exportée du projet Figma Make (`.zip`) déposée dans la conversation ;
2. l'URL d'un dépôt GitHub contenant le code généré (`app/components/...`, `src/...`) ;
3. à défaut, les fichiers collés dans le fil (`App.tsx`, `Sidebar.tsx`, `ChatView.tsx`, `globals.css`, `tailwind.config`) ;
4. si le template a été perdu : 4 à 6 captures d'écran (accueil, conversation avec sources, liste des documents, panneau de réglages, clair + sombre) et je le reconstruis à partir de ces captures, en le disant.

### 0.2 L'environnement d'exécution ne peut pas appeler Groq ni Hugging Face

Mesuré, pas supposé :

| Cible | Résultat | Conséquence |
|---|---|---|
| `https://api.groq.com` | **injoignable** (`000`) | aucun appel au modèle depuis ce sandbox, **même avec la clé fournie** |
| `https://huggingface.co` | **injoignable** (`000`) | le modèle d'embeddings ne peut pas être téléchargé ni chargé ici |
| `https://pypi.org` | 200 | les paquets Python s'installent |

Le venv de travail contient `fastapi`, `starlette`, `httpx`, `groq`, `numpy` ; il manque `sentence-transformers` (et son `torch`), `pypdf`, `python-docx`, `langchain-text-splitters`, `python-multipart`.

**Conséquence honnête** : les tests de bout en bout « importer un document → poser une question → obtenir une réponse du modèle » **ne peuvent pas être exécutés ici**. Ils le seront sur votre machine, qui a le réseau et la clé. Ce que je peux exécuter ici, et que j'exécuterai : tests d'API, de validation, de gestion d'erreurs, d'ingestion de fichiers (extraction + découpage, sans embeddings), mocks du fournisseur, et tests DOM de l'interface.

### 0.3 Sécurité — la clé est maintenant publique

La clé Groq a été collée en clair dans la conversation. Conséquences :

- je ne l'ai écrite **dans aucun fichier** et je ne le ferai pas ; `.env` est déjà dans `.gitignore` ;
- **révoquez-la et créez-en une nouvelle** depuis la console Groq : un secret publié dans un fil doit être considéré comme compromis ;
- la nouvelle clé devra être placée par vous dans `.env` (jamais dans le code, jamais dans un commit).

Le message d'erreur que vous avez collé (« Le service n'est pas encore configuré ») est exactement ce que renvoie le backend d'ici : `chunks.json` et `embeddings.npy` sont absents, et la clé n'est pas dans l'environnement.

---

## 1. Audit du projet existant

### 1.1 Pile technique

| Couche | Ce qui existe |
|---|---|
| Serveur | FastAPI 0.115+, `StaticFiles`, `StreamingResponse`, Pydantic v2 |
| Moteur RAG | `rag/engine.py` (146 lignes) : chargement paresseux de `chunks.json` + `embeddings.npy`, recherche cosinus, génération Groq, citations |
| Configuration | `rag/config.py` : `.env` via `python-dotenv`, aucun secret en dur, chemins projet |
| Interface | `frontend/` : HTML/CSS/JS natifs, modules ES, aucun build |
| Pipeline documents | 4 scripts CLI : `textes_bruts/04_extraction_masse.py` → `05_nettoyage.py` → `06_decoupage_chunks.py` → `07_embeddings.py` |
| Tests | **aucun** avant aujourd'hui (9 tests de base ajoutés) |
| Conteneurisation | **aucune** (pas de Dockerfile, pas de compose) |
| Dépendances | `requirements.txt` (9 lignes), pas de `package.json` |

### 1.2 Routes existantes (les seules)

| Méthode | Route | Réponse | État |
|---|---|---|---|
| GET | `/` | `index.html` | fonctionne |
| GET | `/static/*` | assets | fonctionne |
| GET | `/api/health` | `{status, knowledge_base_ready, llm_configured, model}` | fonctionne (renvoie `degraded` ici) |
| GET | `/api/sources/{id}` | `{id, document, category, chunk_id, excerpt, score}` | 503 sans index |
| POST | `/api/chat` | SSE `sources` → `token`* → `done` \| `error` | 503 sans index |

Aucune authentification, aucun CORS par défaut (activé seulement si `ALLOWED_ORIGINS` est renseigné), aucune limite de taille, aucune limite de débit.

### 1.3 Moteur RAG — ce qu'il fait vraiment

- Embeddings : `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, normalisés, similarité = produit scalaire ;
- `TOP_K=5`, `MIN_RELEVANCE_SCORE=0.20` ; sous le seuil, la réponse devient « Je ne trouve pas cette information dans les documents fournis. » — le refus est donc déjà correct et non halluciné ;
- Génération : Groq `openai/gpt-oss-20b`, `temperature=0.1`, prompt système strictement ancré sur les extraits ;
- Identifiant de source : `"{source}:{chunk_id}"` ; `get_source()` renvoie **`score = 0.0`** (la pertinence est perdue dans la fiche, alors que l'interface la montre) ;
- Index **monolithique** : un tableau NumPy unique, rechargé par `lru_cache`, sans rechargement à chaud, sans suppression, sans ajout incrémental ;
- Aucune métadonnée de date, de taille, de nombre de pages, ni de statut d'indexation.

### 1.4 Pipeline documents — ce qu'il fait vraiment

| Étape | Entrée → sortie | Détail | Limite |
|---|---|---|---|
| 04 | `documents/<catégorie>/*.pdf|.docx` → `textes_bruts/<cat>_<nom>.txt` | pypdf, python-docx | tout refaire à chaque fois, pas de suivi |
| 05 | `textes_bruts/*.txt` → `textes_propres/*.txt` | compacte espaces/sauts de ligne, jette < 50 caractères | perte de la structure de pages |
| 06 | `textes_propres/*.txt` → `chunks.json` | `RecursiveCharacterTextSplitter`, séparateurs `\n\n`, `\n`, `. `, ` ` | métadonnées pauvres : `source`, `categorie`, `chunk_id`, `texte` |
| 07 | `chunks.json` → `embeddings.npy` | MiniLM normalisé | ~500 Mo de modèle, pas de reprise sur erreur |

**État des données sur ce poste** : `documents/` absent, `textes_bruts/` ne contient qu'un script, `textes_propres/` absent, `chunks.json` et `embeddings.npy` absents. **Il n'y a donc aucun corpus à interroger.** C'est la cause première du 503.

---

## 2. Matrice de capacités — demandé vs présent

Légende : **Présent** = utilisable tel quel · **Partiel** = existe mais insuffisant pour l'interface · **Absent** = à développer.

### 2.1 Gestion des documents

| Fonctionnalité demandée | État | Réalité actuelle |
|---|---|---|
| Importer un document depuis l'interface | **Absent** | uniquement un copier-coller manuel dans `documents/` puis 4 scripts |
| Validation du format | **Absent** | les scripts ignorent silencieusement ce qui n'est pas PDF/DOCX |
| Extraction du contenu | **Partiel** | code existant, mais CLI, sans retour d'erreur exploitable par une API |
| Découpage en chunks | **Partiel** | existe, non paramétrable depuis l'application |
| Génération des embeddings | **Partiel** | existe, en lot hors ligne |
| Indexation | **Partiel** | reconstruction totale, pas d'ajout à chaud |
| Lister les documents importés | **Absent** | aucune route, aucune source de vérité hors fichiers |
| Supprimer un document | **Absent** | impossible sans reconstruire l'index à la main |
| Gestion des erreurs d'import | **Absent** | script qui imprime dans un terminal |

### 2.2 Assistant conversationnel

| Fonctionnalité | État | Réalité actuelle |
|---|---|---|
| Créer une conversation | **Absent côté serveur** | l'interface actuelle garde tout en `localStorage` |
| Envoyer un message | **Présent** | `POST /api/chat` (SSE) |
| Réponse du modèle | **Présent** | Groq, hors de ce sandbox |
| Historique des conversations | **Partiel** | navigateur seulement, perdu sur un autre appareil |
| Conversations multiples | **Partiel** | une seule conversation à la fois |
| Sources et citations | **Présent** | SSE `sources` + `GET /api/sources/{id}` |
| Indicateur de chargement | **Présent** | indicateur de frappe |
| Erreurs API | **Présent** | 503/502/404/422/réseau distincts |
| « L'information n'est pas dans les documents » | **Présent** | seuil de pertinence + consigne de refus |

### 2.3 Recherche

| Fonctionnalité | État |
|---|---|
| Recherche sémantique | **Présent** (cosinus, MiniLM multilingue) |
| Récupération des chunks | **Présent** (`TOP_K`) |
| Affichage des sources | **Présent** |
| Scores de pertinence | **Présent** dans `/api/chat`, **perdu** dans `/api/sources/{id}` |

### 2.4 Ce que le template va probablement demander et qui n'existe nulle part

Réglages (modèle, température, `top_k`), statistiques d'usage, gestion des utilisateurs, export de conversation, recherche plein texte dans les documents, aperçu du document entier, ré-indexation à la demande, upload multiple avec progression.

Chacun de ces éléments devra soit être **implémenté pour de vrai**, soit **retiré de l'interface**. C'est le point où la plupart des intégrations de template échouent : un bouton qui a l'air fini mais qui ne fait rien. Ma règle : pas de bouton décoratif.

---

## 3. Incompatibilités et dépendances manquantes

| Élément | Problème | Traitement proposé |
|---|---|---|
| Template probablement React + Tailwind | le projet n'a **aucun build**, et votre brief précédent interdisait React/Vite/Tailwind | soit j'adapte le template en HTML/CSS/JS natif (fidélité visuelle conservée, code réécrit), soit on introduit un build — **décision à prendre** |
| Icônes du template (`lucide-react` ou équivalent) | dépendance npm | je reprends les tracés en sprite SVG local, comme aujourd'hui |
| Graphiques / animations du template | souvent `framer-motion` | refaits en CSS/WAAPI |
| Upload de fichiers | `python-multipart` absent, aucune limite de taille | ajouter la dépendance + validation dure (extension, MIME, taille, nombre) |
| Persistance des conversations | rien côté serveur | SQLite (fichier local, zéro service) ou `localStorage` — **à trancher** |
| Suppression de document | l'index est un tableau NumPy global | passer à un index rechargeable avec identifiant de document, ou reconstruire de façon atomique |
| `get_source()` renvoie `score = 0.0` | l'interface affiche une jauge fausse | stocker le score au moment de la recherche, ou le recalculer |
| Pas de Dockerfile | déploiement manuel | `Dockerfile` + `compose.yaml` (modèle d'embeddings mis en cache dans un volume) |
| Pas de CORS par défaut | inutile si le front est servi par FastAPI | garder `ALLOWED_ORIGINS` vide par défaut, documenter |
| Aucun test | régressions invisibles | `unittest` (déjà 9 tests) + mocks Groq/embeddings |

---

## 4. Plan technique proposé

### Phase A — Cadrage (bloquée par §0.1)
Recevoir le template, cartographier **chaque** écran, chaque bouton, chaque champ, et produire la matrice « élément → endpoint → état ». Aucune ligne de code avant d'avoir cette carte.

### Phase B — Socle backend « documents » (indépendant du template)
- `rag/documents.py` : extraction PDF/DOCX, nettoyage, découpage, empreinte SHA-256 du fichier, métadonnées (`id`, `nom`, `catégorie`, `taille`, `pages`, `chunks`, `sha256`, `date`, `statut`).
- `rag/store.py` : persistance SQLite (`documents`, `conversations`, `messages`) — remplace le tableau NumPy comme unique source de vérité pour l'inventaire.
- Réindexation **incrémentale** : ajouter un document n'exige plus de tout recalculer ; supprimer retire ses chunks et ses vecteurs.
- Nouvelles routes (à confirmer) : `GET /api/documents`, `POST /api/documents` (multipart), `DELETE /api/documents/{id}`, `POST /api/documents/{id}/reindex`.
- Garde-fous : taille max (ex. 20 Mo), 1 fichier à la fois, extensions et types MIME vérifiés, nom assaini, erreurs typées.

### Phase C — Socle conversationnel
- `POST /api/conversations`, `GET /api/conversations`, `GET /api/conversations/{id}`, `DELETE /api/conversations/{id}`.
- `POST /api/chat` étendu avec `conversation_id` **optionnel** (rétrocompatible : sans identifiant, comportement actuel).
- Le SSE existant reste le format ; les messages sont persistés à la fin du flux.

### Phase D — Interface, écran par écran
Chaque écran du template est branché, testé, puis coché dans la matrice. Les états vide / chargement / erreur sont obligatoires pour chacune.

### Phase E — Tests
1. **Unitaires** : nettoyage, découpage, empreinte, normalisation des noms, validation d'upload.
2. **API** : codes, schémas, validation, 413/415/422/404/503, absence de fuite de secret.
3. **Intégration** : ingestion d'un PDF de test **généré localement**, recherche avec un faux encodeur déterministe, réponse avec un faux client Groq (le vrai chemin est testé sur votre machine).
4. **Dom** : chaque bouton, chaque formulaire, états, clavier.
5. **Bout en bout réels** : à exécuter chez vous avec la clé et un corpus ; je fournirai le script et le rapport, pas une affirmation.

### Phase F — Déploiement
`Dockerfile`, `compose.yaml`, `README` réécrit, `requirements.txt` complété, script de vérification unique.

### Phase G — PR
Branche dédiée, commits par thème, PR ouverte, **aucune fusion** sans votre accord.

---

## 5. Ce que je refuse de faire

- Générer une réponse quand le corpus est vide : le backend doit dire « je ne trouve pas », pas inventer.
- Remplir l'interface avec des données factices présentées comme réelles.
- Cocher un test que je n'ai pas lancé.
- Livrer un bouton sans effet.

## 6. Décisions attendues de vous

1. **Le template** : archive, dépôt, fichiers collés, ou captures ?
2. **Nouveaux endpoints** : la mission les demande ; le brief précédent gelait le contrat. Je considère le gel levé — confirmez-vous ?
3. **Conversations** : SQLite côté serveur (partagées entre appareils) ou `localStorage` (aucune migration) ?
4. **Documents sources** : où sont vos PDF/DOCX ? Le dossier `documents/` n'existe pas dans le dépôt.
