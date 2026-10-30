# P4 — Interface React connectée à l’API

**Branche** : `arena/05d356d8-rag-projet` · **Commit de l’étape** : `79a4c4b` (+ ajustements ci-dessous)
**Statut** : interface utilisable et branchée sur FastAPI ; aucun contenu de démonstration ne subsiste.

## 1. Ce qui a été remplacé dans le template

| Template Figma Make | Devient |
| --- | --- |
| `ask()` avec `setTimeout(1400)` | `POST /api/chat` en SSE : `sources` → jetons → `done`, avec annulation réelle |
| 4 sources codées en dur | `sources[]` du flux, puis relecture de la conversation persistée |
| 8 documents codés en dur | `GET /api/documents` (statuts, tailles, dates, extraits réels) |
| Historique figé (« Résiliation contrat Atlas »…) | `GET /api/conversations`, groupé par jour |
| 3 bases de connaissances inventées | `GET /api/knowledge-bases` (catégories réelles et leurs compteurs) |
| Profil « Alex Martin » | état réel du service (santé, nombre de documents et d’extraits) |
| Modèle « Nexus 2.1 » avec chevron | `model` renvoyé par `/api/health`, non modifiable côté client |
| Citations `[n]` décoratives | citations cliquables → panneau de sources, extrait et page réels |
| Barre de recherche factice | palette ⌘K alimentée par `GET /api/search` |
| Boutons d’import factices | `POST /api/documents` (multi-fichiers, glisser-déposer, catégorie) |

## 2. Fichiers créés

```
web/
├── index.html, vite.config.ts, vitest.config.ts, tsconfig.json, package.json
├── src/
│   ├── main.tsx, App.tsx, index.css          (socle visuel du template conservé)
│   ├── api/client.ts, api/types.ts           (seule couche qui connaît les routes)
│   ├── lib/format.ts                         (tailles, dates, markdown sûr, surlignage)
│   ├── lib/useChat.ts                        (état du fil + lecture du flux SSE)
│   └── components/
│       ├── Sidebar.tsx, Topbar.tsx, ui.tsx
│       ├── ChatView.tsx, Composer.tsx, SourcesPanel.tsx
│       ├── DocumentsView.tsx, DocumentDetail.tsx, CommandPalette.tsx
└── tests/ ui.test.tsx, stream.test.ts, app.test.tsx
```

## 3. Écran par écran → route réellement appelée

| Action utilisateur | Endpoint | Comportement vérifié |
| --- | --- | --- |
| Ouvrir l’application | `GET /api/health`, `/api/knowledge-bases`, `/api/conversations`, `/api/documents` | état réel affiché ; erreurs visibles avec bouton « Réessayer » |
| Poser une question | `POST /api/chat` (SSE) | sources affichées avant les jetons, réponse enregistrée, arrêt possible |
| Cliquer sur `[n]` | données du flux | ouvre le panneau et met l’extrait en évidence |
| Ouvrir le document d’une source | `GET /api/sources/{id}` puis `/api/documents/{id}/file` | fichier original en onglet ; extrait archivé → message explicite |
| Copier / relancer / noter | presse-papiers, `POST /api/chat`, `POST /api/messages/{id}/feedback` | retour d’usage persisté, bascule possible |
| Nouvelle conversation | état local (aucun appel) | aucune conversation vide créée : elle naît au premier message |
| Choisir une base | filtre chat `category` + filtre liste documents | restreint la recherche et la liste |
| Supprimer une conversation | `DELETE /api/conversations/{id}` | confirmation puis rafraîchissement |
| Importer un fichier | `POST /api/documents` | un fichier par requête, catégorie courante, message d’erreur serveur affiché tel quel |
| Filtrer / rechercher | `GET /api/documents?status=&q=&category=` | compteurs et lignes recalculés côté serveur |
| Détail d’un document | `GET /api/documents/{id}/file`, `POST /api/documents/{id}/reindex` | métadonnées réelles, cause d’erreur, réindexation, suppression |
| Rechercher (⌘K) | `GET /api/search?q=` | documents et conversations réels, navigation clavier |

## 4. Tests réellement exécutés

Frontend (`cd web && npm test`) — **13 tests, 13 OK** :

- `tests/ui.test.tsx` (9) : formatage FR, regroupement par jour, conversion `[n]` en boutons liés aux sources, renvoi sans extrait, échappement `<script>`, rendu d’une réponse complète (sources, modèle, actions), affichage d’une erreur de flux, compositeur (modèle réel, catégories, limites), barre latérale (historique, suppression, état de la base).
- `tests/stream.test.ts` (3) : trames SSE reçues par morceaux de 7 octets (UTF-8 multi-octets), corps de requête envoyé au serveur, erreur HTTP 503 remontée avec son `detail`, trame `error` transformée en exception.
- `tests/app.test.tsx` (1) : montage complet de `App` sans données ; vérifie aussi l’**absence** des données de démonstration du template (`Contrat fournisseur Atlas`, `Alex Martin`).

`npx tsc --noEmit` → **0 erreur**. `npx vite build` → **OK** (2040 modules, 274 kB de JS, 29,7 kB de CSS).

Backend inchangé, rejoué pour non-régression : `python -m unittest discover -s tests -t .` → **88 tests OK**.

## 5. Vérifications réelles sur le serveur (via le proxy Vite, port 5173)

| Appel | Résultat obtenu |
| --- | --- |
| `GET /api/health` | `200` · `degraded`, `documents_count: 0`, `chunks_indexed: 0`, formats `pdf/docx/csv/xlsx`, 25 Mo max |
| import de `fournisseurs-essai.csv` | `503` + « le document est enregistré mais n’a pas pu être indexé » — la ligne apparaît en `erreur` avec la cause exacte (`sentence-transformers` absent) |
| `GET /api/documents?status=erreur&category=Test UI` | `200`, 1 document |
| `GET /api/documents/{id}/file` | `200`, `text/csv` (fichier original servi) |
| `POST /api/documents/{id}/reindex` | `503` (même cause, l’erreur n’est pas masquée) |
| `DELETE /api/documents/{id}` | `204`, puis `404` au second appel |
| `GET /api/search?q=fournisseurs` | 1 document, 0 conversation |
| état final de `data/rag.db` | **0 conversation, 0 message, 0 document** (base laissée propre) |

## 6. Problèmes restants (honnêtes)

1. **Aucune réponse générée dans cet environnement** : le paquet `sentence-transformers` n’est pas installé et le modèle Hugging Face n’est pas téléchargeable ici. Les imports aboutissent donc à `503`, ce que l’interface affiche sans le masquer. Rien n’est simulé.
2. **Pas de capture d’écran** : aucun navigateur headless disponible dans la sandbox. La validation visuelle repose sur le rendu serveur des composants (13 tests) et sur la prévisualisation en direct servie par Vite.
3. **L’ancienne interface reste servie par FastAPI** (`/` et `/static`) ; la nouvelle vit pour l’instant sur le serveur de développement Vite (proxy `/api`). Le passage de FastAPI au build React est l’étape suivante, avec sauvegarde de l’ancien `frontend/`.
4. Le panneau de sources n’affiche pas de pertinence pour les sources relues depuis une conversation : le score n’a de sens qu’au moment de la recherche, il est donc absent (`score: null`) plutôt qu’inventé.
5. Les formats CSV/XLSX sont proposés à l’import parce que l’extraction est réelle et testée côté serveur ; sans encodeur, l’indexation de ces fichiers échoue comme celle des PDF.
