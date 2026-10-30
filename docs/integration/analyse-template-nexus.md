# Template « Nexus AI RAG Workspace » — analyse et plan d'intégration

État : **analyse seule**. Aucun fichier de l'application n'a été modifié. Les seuls ajouts sont ce rapport et, plus tôt, les 9 tests de référence (`tests/test_api_baseline.py`). Rien n'est fusionné dans `master`.

---

## 1. D'où vient le template — et ce que j'ai réellement trouvé

Vous parliez d'un dossier `figma-template/`. Sur la branche `figma-make` (commit `07ac607`, message « template »), il n'y a **pas** de dossier `figma-template/` : le template est livré sous forme d'archive à la racine du dépôt.

| Élément | Valeur constatée |
|---|---|
| Branche | `origin/figma-make`, commit `07ac607` |
| Fichier | `Nexus AI RAG Workspace.zip` (35 Ko) |
| Extraction | 25 fichiers, 149 Ko |
| Contenu utile | `src/App.tsx` (15,7 Ko, 164 lignes), `src/index.css` (17 Ko, minifié), `src/main.tsx`, `index.html`, `package.json`, `vite.config.ts` |

Le dossier `frontend/` de cette branche est l'ancienne interface vanilla, pas le template. Si vous vouliez pousser un dossier `figma-template/`, il n'est pas arrivé : seul le zip compte, et il suffit.

**Extrait dans `/tmp/tpl`**, pas dans votre dépôt : je n'ajouterai le template au dépôt qu'après votre validation.

---

## 2. Technologies et dépendances réelles

| Couche | Version installée | Remarque |
|---|---|---|
| React / React DOM | 19.3.1 | StrictMode activé |
| TypeScript | 5.9.3 | `strict: true`, `noEmit` |
| Vite | 8.3.5 | plugins React + Tailwind |
| Tailwind CSS | 4.3.3 | `@import "tailwindcss"` + classes maison |
| lucide-react | 1.65.0 | 25 icônes importées |
| @vitejs/plugin-react | 6.1.2 | |
| @tailwindcss/vite | 4.3.3 | |
| Gestionnaire | pnpm 10.34.3 (`pnpm-lock.yaml`), `.mise.toml` node 22 | `npm install` a fonctionné malgré tout |

**Aucune dépendance d'état, de routage, de requêtes ou d'animation** : pas de React Router, pas de TanStack Query, pas de framer-motion, pas d'axios. C'est une application mono-page à deux vues, ce qui simplifie beaucoup l'intégration : **tout le réseau sera à écrire**, mais rien ne s'y opposera.

`vite.config.ts` (451 lignes) contient surtout la plomberie Figma Make : injection du titre/langue depuis `.figma/make/site.json`, surcouche d'erreurs, sourcemaps des paquets liés, route de prévisualisation `/.figma/make/kit.html`. Rien de tout cela ne concerne le produit ; je propose de le remplacer par une configuration minimale (React + Tailwind + alias `@` + proxy `/api`).

---

## 3. Le build, vérifié et non supposé

Exécuté dans `/tmp/tpl` :

```
npm install        → 45 paquets en 16 s
npx vite build     → 2028 modules transformés, 427 ms
  dist/index.html          0,94 kB
  dist/assets/index.css   23,10 kB (gzip 5,90)
  dist/assets/index.js   244,87 kB (gzip 76,52)
```

Deux avertissements bénins de Vite 8 (`__dirname` et import JSON sans attribut dans `vite.config.ts`). **Conclusion : la chaîne de build fonctionne dans cet environnement**, donc l'option « React compilé » est réaliste ici, et pas seulement sur votre machine.

Un aperçu **du template tel quel** est servi pour cette session (voir le lien de prévisualisation) : deux vues, données en dur, aucun appel réseau — c'est la référence visuelle, pas l'application.

---

## 4. Système de design extrait (à conserver à l'identique)

### 4.1 Jetons de couleur

| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `--bg` | `#fbfbfd` | `#000000` | fond |
| `--surface` | `#ffffff` | `#1c1c1e` | cartes, table, palette |
| `--surface-2` | `#f5f5f7` | `#2c2c2e` | panneau de sources, survols |
| `--glass` | `rgba(251,251,253,.78)` | `rgba(28,28,30,.78)` | sidebar et barre supérieure, `blur(20px) saturate(180%)` |
| `--text` | `#1d1d1f` | `#f5f5f7` | texte |
| `--muted` | `#6e6e73` | `#a1a1a6` | texte secondaire |
| `--subtle` | `#86868b` | `#8e8e93` | micro-libellés |
| `--line` | `rgba(0,0,0,.08)` | `rgba(255,255,255,.10)` | filets |
| `--blue` | `#0071e3` | `#0a84ff` | accent |
| `--blue-soft` | `rgba(0,113,227,.10)` | `rgba(10,132,255,.16)` | fonds d'accent |
| `--green` / `--amber` | `#218739` / `#a55d00` | idem | états |

### 4.2 Autres constantes

- Police : `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif` — **la même famille que l'interface actuelle**, ce qui rend la bascule typographique quasi nulle.
- Corps : **14 px** ; réponses 15 px, `line-height: 1.65` ; titres : h1 23–25 px, h2 21 px, `letter-spacing: -.02em`.
- Rayons : `--r-sm 10`, `--r-md 14`, `--r-lg 20` + valeurs ponctuelles 8/9/12/16/18.
- Ombres : `0 1px 2px rgba(0,0,0,.04), 0 12px 40px rgba(0,0,0,.06)` ; en sombre, deux couches noires.
- Courbe : `cubic-bezier(.32,.72,0,1)` (`--ease`), transitions 0,2–0,3 s.
- Focus : `outline: 4px solid rgba(0,113,227,.25)`, décalé de 2 px.
- Géométrie : sidebar **260 px**, barre supérieure **58 px**, panneau de sources **340 px** (0 quand fermé), conversation **760 px** centrée, palette de commandes 600 px, zone de documents 1240 px.
- Points de rupture : **980 px** (le panneau de sources devient un tiroir bas de 58 vh, la table défile) et **720 px** (sidebar en tiroir, libellés des sélecteurs masqués).
- `prefers-reduced-motion` déjà géré, `color-scheme: dark` déjà géré.

---

## 5. Inventaire complet : écrans, composants, interactions

Le template contient **2 vues** (`chat`, `documents`) et **2 surfaces superposées** (panneau de sources, palette de commandes). Il n'y a **aucun routeur** : la vue est un état React.

### 5.1 Coquille

| # | Élément | Comportement actuel dans le template | Réalité |
|---|---|---|---|
| C1 | `Sidebar` (260 px, verre) | affichée en permanence, tiroir < 720 px | statique |
| C2 | Marque « N » + « Nexus » | décor | nom à décider |
| C3 | « Nouvelle conversation » | `setView("chat")` + ferme le tiroir | aucun effet réel |
| C4 | Navigation « Conversations » / « Documents » | bascule `view` | fonctionne |
| C5 | Historique (4 entrées, groupées Aujourd'hui / Hier / Cette semaine) | boutons inertes, `.active` figé | données en dur |
| C6 | « Bases de connaissances » (3 entrées + compteurs 48 / 32 / 12) | boutons inertes | données en dur |
| C7 | Profil « Alex Martin — Équipe juridique » + menu | inerte | aucune authentification |
| C8 | Barre supérieure (verre, 58 px) | titre contextuel, point bleu, « Synchronisé » | décor |
| C9 | Bouton menu (mobile) | ouvre le tiroir | fonctionne |
| C10 | Déclencheur `⌘K` « Rechercher » | ouvre la palette | fonctionne |
| C11 | Bascule de thème (lune/soleil) | `data-theme` sur `.app` | fonctionne, mais **ne persiste pas** |
| C12 | Bascule du panneau de sources | ouvre/ferme | fonctionne |
| C13 | Avatar utilisateur | décor | — |

### 5.2 Vue conversation

| # | Élément | Comportement actuel | Réalité |
|---|---|---|---|
| V1 | En-tête de conversation (catégorie + titre) | statique | — |
| V2 | Message utilisateur | statique | — |
| V3 | État de recherche : 3 lignes squelette + « Recherche dans 12 documents… » + étapes Recherche / Lecture / Rédaction | `setTimeout(1400)` | **simulé** |
| V4 | En-tête de réponse « Réponse fondée sur 4 sources » | statique | — |
| V5 | Réponse (3 paragraphes + encadré « En pratique ») | JSX en dur | **réponse factice** |
| V6 | Citations `[1]`–`[4]` avec infobulle (document, page, pertinence, extrait) | `sources` en dur | décor |
| V7 | Actions : Copier, Régénérer, Utile, Pas utile | Copier/Régénérer/Utile inertes | — |
| V8 | Composeur (textarea auto-hauteur 42→132 px, Entrée / Maj+Entrée) | état local seulement | **le seul élément réellement fonctionnel** |
| V9 | Trombone « Joindre un document » | inerte | — |
| V10 | Sélecteur de base « Juridique & Achats » | inerte | — |
| V11 | Sélecteur de modèle « Nexus 2.1 » | inerte | — |
| V12 | Bouton envoyer (désactivé si vide) | appelle `ask()` → `setTimeout` | **simulé** |
| V13 | Mention « Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne » | exact | — |

### 5.3 Panneau de sources (340 px)

| # | Élément | Comportement actuel | Réalité |
|---|---|---|---|
| S1 | Titre « Sources » + « 4 passages récupérés » | statique | — |
| S2 | Fermeture (X) | fonctionne | — |
| S3 | Carte source : type PDF/DOCX, titre, page, extrait entre guillemets avec **surlignage** | données en dur, surlignage par expression régulière figée | — |
| S4 | Barre de pertinence + « 96 % de pertinence » | en dur | — |
| S5 | « Ouvrir le document » | **inerte** | — |

### 5.4 Vue documents

| # | Élément | Comportement actuel | Réalité |
|---|---|---|---|
| D1 | En-tête « 8 documents · Juridique & Achats » | statique | — |
| D2 | « Ajouter des documents » | passe en état `uploading` | **simulé** |
| D3 | Zone de dépôt (PDF, DOCX, XLSX, CSV · 50 Mo) | même état simulé, affiche « Contrat-cadre-2025.pdf — Indexation en cours… » | **simulé, et formats non supportés** |
| D4 | Étapes d'ingestion Téléversement / Découpage / Embeddings / Indexé | statiques, la 3ᵉ « active » en dur | — |
| D5 | Segments Tous 8 / Indexés 7 / En attente 1 | figés | — |
| D6 | Champ « Rechercher » | inerte | — |
| D7 | Table 8 lignes : nom, type, taille, statut, date, actions | en dur, statuts « Indexé »/« En attente » figés | — |
| D8 | Menu « ⋯ » par ligne | inerte | — |

### 5.5 Palette de commandes (⌘K)

| # | Élément | Comportement actuel | Réalité |
|---|---|---|---|
| P1 | Ouverture `Ctrl/⌘ + K`, fermeture `Échap`, clic sur le fond | fonctionne | — |
| P2 | Champ de recherche auto-focus | inerte | — |
| P3 | « Nouvelle conversation », « Ouvrir les documents » | fonctionnent | — |
| P4 | « Résultats récents » (1 document) | en dur | — |

### 5.6 Accessibilité et finition — ce que le template fait déjà, et ses angles morts

Déjà bon : `aria-label` sur tous les boutons d'icône, `role="tooltip"` sur les infobulles, `aria-modal="true"` sur la palette, `sr-only` sur l'en-tête de colonne Actions, `prefers-reduced-motion`, `color-scheme`.

À corriger pendant l'intégration (mesuré, pas ressenti) :

1. **`--subtle: #86868b` sur `#fbfbfd` = 3,4:1** — sous le seuil AA de 4,5:1 pour du texte, et il est utilisé pour des libellés de 10 px. Même problème en sombre (`#8e8e93` sur `#1c1c1e` ≈ 4,6:1, limite).
2. **Corps à 14 px et micro-libellés à 9–10 px** : sous la taille minimale confortable. Je propose 15 px pour le corps et 11 px plancher pour les libellés, sans changer la silhouette.
3. **Cibles de 36 px** (`.icon-button`, `.send-button` 34 px) : sous les 44 px recommandés. Marge interne à ajouter, taille visuelle inchangée.
4. **Anneau de focus à 25 % d'opacité** : à peine visible. À passer en bleu plein.
5. **Palette de commandes sans piège de focus** : `Tab` sort de la modale.
6. **Statuts par pastille de couleur seule** (Indexé / En attente) : ajouter le libellé — il existe déjà, c'est bien, mais le point seul ne suffit pas partout.

Ces corrections ne dénaturent pas le design : ce sont des écarts de 1 à 2 px et des couleurs de texte légèrement assombries.

---

## 6. Le backend existant, en résumé

| Élément | État |
|---|---|
| Routes | `/`, `/static/*`, `GET /api/health`, `GET /api/sources/{id}`, `POST /api/chat` (SSE) |
| Moteur | `rag/engine.py` : MiniLM multilingue normalisé, cosinus, `TOP_K=5`, seuil `0.20`, Groq `openai/gpt-oss-20b`, température 0,1, refus explicite si sous le seuil |
| Index | `chunks.json` + `embeddings.npy`, **absents** sur ce poste → tout appel répond 503 |
| Ingestion | 4 scripts CLI (extraction → nettoyage → chunks → embeddings), PDF/DOCX uniquement, reconstruction totale |
| Persistance | **aucune** (pas de base, pas de sessions, pas d'inventaire de documents) |
| Tests | `tests/test_api_baseline.py` (9 tests, verts) |
| Sécurité | aucune authentification, aucune limite de taille, CORS inactif par défaut |

Détail complet : `docs/integration/analyse-et-plan.md` §1.

### Écarts entre les deux mondes

| Sujet | Template | Backend actuel | Écart |
|---|---|---|---|
| Rendu | React 19 + Vite | HTML/CSS/JS natif | réécriture complète de `frontend/` |
| État | `useState` local | `localStorage` maison | à refaire proprement |
| Documents | 8 lignes, upload, suppression | inexistant | **à construire** |
| Conversations | liste groupée par date | une seule, locale | **à construire** |
| Citations | `[n]` dans le texte | sources renvoyées à part | prompt + rendu à adapter |
| Page / section | « Page 12 », « Section 4.2 » | `chunk_id` seul | métadonnées à ajouter au pipeline |
| Bases de connaissances | 3 catégories avec compteurs | dossiers `documents/<catégorie>/` | endpoint à créer |
| Formats | PDF, DOCX, XLSX, CSV | PDF, DOCX | soit étendre, soit corriger le texte |
| Modèle | sélecteur « Nexus 2.1 » | un modèle fixé par `.env` | soit liste blanche réelle, soit lecture seule |
| Progression d'indexation | 4 étapes | synchrone, silencieuse | job asynchrone ou étapes réelles |
| Thème | bascule manuelle | `prefers-color-scheme` seul | décision à prendre |

---

## 7. Architecture cible

```
rag_projet/
├── app.py                    # FastAPI : API + service du build React
├── rag/
│   ├── config.py             # + chemins données, limites d'upload, modèles autorisés
│   ├── engine.py             # RAG conservé : recherche + génération + citations
│   ├── store.py              # NOUVEAU — SQLite : documents, conversations, messages
│   ├── documents.py          # NOUVEAU — extraction, validation, découpage, empreinte
│   ├── index.py              # NOUVEAU — index rechargeable, ajout/retrait sans redémarrage
│   └── schemas.py            # NOUVEAU — modèles Pydantic de l'API v2
├── web/                      # NOUVEAU — le template Figma Make, adapté
│   ├── package.json  vite.config.ts  tsconfig.json  index.html
│   ├── src/
│   │   ├── main.tsx  App.tsx
│   │   ├── index.css         # jetons du template (conservés), contrastes corrigés
│   │   ├── api/client.ts     # NOUVEAU — fetch, SSE, erreurs typées
│   │   ├── components/       # Sidebar, Topbar, Composer, Chat, Sources, Documents, Palette…
│   │   └── hooks/            # useHealth, useConversations, useChatStream, useDocuments
│   └── dist/                 # build, servi par FastAPI
├── tests/                    # API, unitaires, intégration (mocks Groq/embeddings)
├── Dockerfile  compose.yaml  README.md
└── docs/
```

### Décisions structurantes (à valider)

1. **Garder React + Vite plutôt que porter en vanilla.** Le template est du JSX ; le reconstruire à la main produirait une copie approximative et deux fois plus de code à maintenir. Le build mesuré plus haut le confirme. Conséquence : le projet gagne une étape Node, ce que le brief précédent excluait — cette mission-ci le demande explicitement.
2. **FastAPI sert `web/dist`** sur `/` (avec repli SPA), `web/src` n'est jamais exposé. En développement, `vite dev` sur 5173 avec proxy `/api` → `127.0.0.1:8000`.
3. **SQLite pour documents, conversations et messages.** Fichier local, aucune infrastructure, transactions. Remplace `localStorage` comme source de vérité ; `localStorage` ne garde que le thème et l'identifiant de conversation courante.
4. **Index rechargeable.** L'index actuel (tableau NumPy global + `lru_cache`) interdit l'ajout et la suppression à chaud. Je le remplace par un index par document (même format `.npy`, plus un manifeste), rechargé après chaque ingestion, sans redémarrage.
5. **Le prompt système apprend à citer.** « Réponse fondée sur N sources » et les `[n]` deviennent réels : les extraits sont numérotés dans le prompt, le modèle est tenu de citer `[n]`, et le client transforme ces marqueurs en infobulles pointant vers les sources renvoyées. Le refus « information absente » est conservé tel quel.
6. **Aucune donnée factice en production.** Chaque tableau, compteur, carte et menu du template est alimenté par une route réelle. Ce qui ne peut pas l'être est retiré de l'interface, pas maquillé.

### Flux de bout en bout

```
Upload (Documents)                       Question (Chat)
  POST /api/documents (multipart)          POST /api/chat {question, conversation_id, category, model}
    ├─ validation (type, taille, nom)        ├─ SSE sources  ← recherche réelle (scores, pages)
    ├─ extraction PDF (pypdf) / DOCX        ├─ SSE token*   ← génération Groq réelle
    ├─ découpage (RechercheCharacterSplitter)└─ SSE done     ← message persisté en SQLite
    ├─ embeddings (MiniLM) + index
    └─ statut → « Indexé » (ligne du tableau mise à jour)
```

---

## 8. Modèle de données (SQLite)

```sql
documents(id PK, sha256 UNIQUE, name, category, ext, size_bytes, pages,
          chunk_count, status /* indexé|en_attente|erreur */, error,
          created_at, indexed_at)

conversations(id PK, title, category, created_at, updated_at)

messages(id PK, conversation_id FK, role /* user|assistant */, content,
         sources_json, model, feedback /* null|up|down */, created_at)

-- Index : rapide sur documents.status, messages.conversation_id, conversations.updated_at
```

Les embeddings restent des fichiers (`data/index/<document_id>.npy` + manifeste), pas des BLOB : c'est plus rapide à charger et cela garde le format actuel.

---

## 9. Contrat d'API v2 (proposition)

Existant conservé **sans rupture** :

| Méthode | Route | Changement |
|---|---|---|
| GET | `/api/health` | + `documents_count`, + `conversations_count`, + `models` |
| GET | `/api/sources/{id}` | + `page`, + `document_id` (score conservé) |
| POST | `/api/chat` | champs optionnels `conversation_id`, `category`, `model` ; SSE inchangé |

Nouveau :

| Méthode | Route | Rôle | Codes |
|---|---|---|---|
| GET | `/api/documents` | liste, filtres `?status=&q=&category=` | 200 |
| POST | `/api/documents` | multipart, un fichier | 201, 400 (nom/extension), 413 (taille), 415 (type), 422 (vide/illisible), 409 (doublon sha256) |
| DELETE | `/api/documents/{id}` | retire fichier, chunks, vecteurs | 204, 404 |
| POST | `/api/documents/{id}/reindex` | réindexe un document | 202, 404, 409 |
| GET | `/api/documents/{id}/file` | sert l'original (téléchargement / aperçu) | 200, 404, 416 |
| GET | `/api/knowledge-bases` | catégories + compteurs | 200 |
| GET | `/api/models` | modèles autorisés (liste blanche serveur) | 200 |
| GET | `/api/conversations` | liste (tri date) | 200 |
| POST | `/api/conversations` | crée (titre provisoire) | 201 |
| GET | `/api/conversations/{id}` | messages + sources | 200, 404 |
| PATCH | `/api/conversations/{id}` | renomme | 200, 404 |
| DELETE | `/api/conversations/{id}` | supprime | 204, 404 |
| POST | `/api/messages/{id}/feedback` | `up` / `down` | 204, 404 |
| GET | `/api/search?q=` | recherche transverse (palette ⌘K) | 200 |

Règles transverses : erreurs JSON `{detail}` en français, jamais de trace ni de clé ; taille max 25 Mo ; extensions PDF/DOCX seulement (voir §10) ; nom de fichier assaini ; pas de chemin absolu renvoyé ; `.env` toujours prioritaire sur les valeurs par défaut.

---

## 10. Conflits à trancher avant de coder

| # | Conflit | Options | Ma recommandation |
|---|---|---|---|
| 1 | **XLSX / CSV** annoncés dans la zone de dépôt, mais le pipeline ne lit que PDF/DOCX | (a) ajouter `openpyxl` + lecture CSV ; (b) corriger le texte en « PDF, DOCX · 25 Mo » | (b) d'abord, (a) ensuite si vous y tenez : un tableur indexé mot à mot donne de mauvais résultats RAG |
| 2 | **Bascule de thème** dans la barre | (a) la garder (choix explicite, persisté) ; (b) la retirer, `prefers-color-scheme` seul | (a) : elle est dans votre design, et le système reste le défaut |
| 3 | **« Ouvrir le document »** | (a) servir l'original via `/api/documents/{id}/file` ; (b) ouvrir une fiche d'extrait | (a) si les fichiers sont conservés ; sinon (b) |
| 4 | **Profil « Alex Martin »** | (a) le retirer ; (b) afficher une identité de configuration sans compte | (a) tant qu'il n'y a pas d'authentification : un profil inerte est exactement ce que vous interdisez |
| 5 | **Sélecteur de modèle « Nexus 2.1 »** | (a) lecture seule, modèle réel issu de `/api/health` ; (b) liste blanche + choix par message | (a) au départ, (b) si vous voulez comparer des modèles |
| 6 | **Étapes d'ingestion** | (a) synchrones, un seul état « Indexation… » ; (b) job + progression réelle | (a) pour un premier jet honnête, (b) ensuite |
| 7 | **« Synchronisé »** | (a) refléter `/api/health` ; (b) retirer | (a) : information réelle et utile |
| 8 | **Bases de connaissances** | (a) catégories = dossiers `documents/`, filtre de recherche réel ; (b) retirer la section | (a) : c'est le seul moyen de rendre le sélecteur du composeur fonctionnel |
| 9 | **Code de l'ancienne interface** (`frontend/` vanilla) | (a) supprimer ; (b) garder en parallèle | (a) après validation finale, avec l'historique Git comme filet |

---

## 11. Matrice élément → endpoint → état visé

`État` : **R** = réel à brancher (route existante) · **N** = route à créer · **X** = à retirer ou à convertir en information réelle.

| Élément | Vue | Rôle | Endpoint / mécanisme | État |
|---|---|---|---|---|
| Nouvelle conversation | sidebar | crée une conversation | `POST /api/conversations` | N |
| Historique (groupes par date) | sidebar | ouvre une conversation | `GET /api/conversations`, `GET /api/conversations/{id}` | N |
| Bases de connaissances | sidebar | filtre le corpus | `GET /api/knowledge-bases` | N |
| Profil utilisateur | sidebar | — | — | X |
| Titre contextuel | topbar | conversation courante | état client | R |
| « Synchronisé » | topbar | santé du service | `GET /api/health` | R |
| Bascule de thème | topbar | apparence | client + `localStorage` | R |
| Bascule sources | topbar | affiche le panneau | état client | R |
| `⌘K` | topbar | palette | client | R |
| Recherche palette | palette | documents + conversations | `GET /api/search?q=` | N |
| Actions rapides | palette | navigation | client | R |
| Message utilisateur | chat | envoi | `POST /api/chat` | R |
| Étapes de recherche | chat | progression réelle | événements SSE `sources` puis `token` | R |
| Réponse | chat | flux | SSE `token` | R |
| « Réponse fondée sur N sources » | chat | comptage | SSE `sources` | R |
| Citations `[n]` + infobulle | chat | preuve | prompt citant + SSE `sources` (+ `page`) | R/N |
| Copier | chat | presse-papiers | client | R |
| Régénérer | chat | relance la question | `POST /api/chat` (même question) | R |
| Utile / Pas utile | chat | retour qualité | `POST /api/messages/{id}/feedback` | N |
| Composeur + Entrée/Maj+Entrée | chat | saisie | client | R |
| Trombone | chat | import rapide | `POST /api/documents` | N |
| Sélecteur de base | chat | filtre la recherche | `category` dans `/api/chat` | N |
| Sélecteur de modèle | chat | choix du modèle | `GET /api/models` (+ `model` dans `/api/chat`) | N |
| Envoyer | chat | déclenche | `POST /api/chat` | R |
| Carte source (titre, page, score) | sources | preuve détaillée | SSE `sources` + `GET /api/sources/{id}` | R |
| Surlignage de l'extrait | sources | lisibilité | calcul client à partir des termes de la question | N |
| « Ouvrir le document » | sources | original | `GET /api/documents/{id}/file` | N |
| Compteur « N documents » | documents | inventaire | `GET /api/documents` | N |
| Ajouter / déposer des fichiers | documents | import | `POST /api/documents` | N |
| Étapes d'ingestion | documents | progression | réponse synchrone (v1) puis job | N |
| Segments Tous / Indexés / En attente | documents | filtre | `GET /api/documents?status=` | N |
| Recherche de documents | documents | filtre | `GET /api/documents?q=` | N |
| Table (nom, type, taille, statut, date) | documents | inventaire | `GET /api/documents` | N |
| Menu « ⋯ » (ouvrir, réindexer, supprimer) | documents | actions | `file`, `reindex`, `DELETE` | N |

Total : **17 éléments déjà servis par l'existant**, **18 à construire côté backend**, **3 à retirer ou convertir**.

---

## 12. Plan par phases

| Phase | Contenu | Livrable | Critère d'acceptation |
|---|---|---|---|
| **P0 — Validation** | vous tranchez §10 | décisions consignées | 8 réponses |
| **P1 — Socle backend** | `store.py` (SQLite), `documents.py` (extraction/découpage), `index.py` (rechargeable) | routes documents + tests unitaires | upload d'un PDF de test → chunks → index → `GET /api/documents` le montre ; `DELETE` le retire ; doublon refusé (409) |
| **P2 — Conversations** | conversations + messages + `/api/chat` étendu | routes + tests | deux conversations, historique retrouvé après redémarrage |
| **P3 — Moteur** | citations `[n]`, pages, filtre catégorie, score dans `/api/sources` | `engine.py` amélioré + tests | réponse citant 2 sources réelles, infobulles correctes ; question hors corpus → refus exact |
| **P4 — Frontend** | template porté dans `web/`, `api/client.ts`, hooks, tous les écrans branchés | build + matrice complétée | chaque ligne de la matrice §11 est « réelle » |
| **P5 — Finition** | contrastes, cibles 44 px, piège de focus, états vides/erreur, responsive | captures + guide | audit contraste sans échec, navigation clavier complète |
| **P6 — Tests & déploiement** | tests API/robustesse, Dockerfile, compose, README | rapport de tests honnête | tout ce qui est déclaré vert a été exécuté |

---

## 13. Tests : ce qui tournera ici, ce qui ne tournera pas

**Exécutable dans cet environnement (déjà vérifié)** : `npm install`, `vite build`, tests FastAPI via `TestClient` (9/9 verts), tests unitaires d'extraction/découpage (pypdf/python-docx s'installent depuis PyPI), tests de l'API avec faux encodeur et faux client Groq.

**Non exécutable ici, et je ne le déclarerai pas exécuté** :
- appels réels Groq (`api.groq.com` injoignable) ;
- embeddings réels (`huggingface.co` injoignable, modèle non téléchargeable) ;
- donc **aucune réponse de modèle réelle**, aucune mesure de pertinence réelle ;
- rendu visuel navigateur (pas de Playwright) : le template est servi en aperçu, mais je ne peux pas le voir.

Ces quatre points se testeront chez vous, avec la clé et un corpus. Je fournirai les scripts et le mode opératoire.

---

## 14. Ce dont j'ai besoin pour démarrer

1. Les décisions du §10 (8 points), ou un simple « applique tes recommandations ».
2. Où vivra le code source React : `web/` (proposé) ou `frontend/` en remplacement de l'existant.
3. Confirmation que je peux modifier `app.py`, `rag/` et `requirements.txt` — la mission l'exige (nouvelles routes, SQLite, extraction), alors que le brief précédent les gelait.
4. Vos documents réels (ou l'autorisation de générer deux PDF/DOCX de test clairement étiquetés).

Dès votre validation, j'attaque P1 (socle backend) et je livre phase par phase, avec tests exécutés à chaque étape.
