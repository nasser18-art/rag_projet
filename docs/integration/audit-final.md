# Audit final — assistant documentaire (P1 → P5)

**Branche** : `arena/05d356d8-rag-projet` (PR #1, **non fusionnée**)
**Date** : 31 octobre 2026
**Périmètre audité** : `app.py`, `rag/`, `web/`, `frontend/`, tests, scripts, documentation.

## 0. Verdict

L'**intégration applicative** (API, base documentaire, conversations, interface React
servie par FastAPI) est en place, testée et vérifiée sur un serveur réel.

La **chaîne d'intelligence artificielle n'a pas été validée** : ni le modèle
d'embeddings, ni l'appel de génération Groq n'ont pu être exécutés dans cet
environnement. **En conséquence, l'application n'est pas déclarée pleinement
opérationnelle** : elle est « opérationnelle hors chaîne IA ». Les critères exacts
de validation restante sont listés au § 4.

## 1. Fonctionnalités testées et opérationnelles

### 1.1 API et base documentaire

| Fonctionnalité | Preuve |
| --- | --- |
| Import PDF / DOCX / CSV / XLSX, validation de signature, taille, extension | 20 tests `tests/test_documents.py` + 15 `tests/test_documents_api.py` |
| Extraction paginée (PDF par page, XLSX par feuille, CSV, DOCX) | mêmes fichiers ; vérifié aussi en direct sur un CSV |
| Découpage en extraits avec libellé de page | `test_chunks_keep_page_labels_and_ordinals` |
| Inventaire SQLite : statuts, compteurs, filtres, doublons (409) | 8 tests `test_store.py`, 15 `test_documents_api.py` |
| Import refusé proprement : 413, 415, 409, 422 | tests + vérifications curl |
| Document enregistré même si l'indexation échoue (statut `erreur` + cause) | vérifié en direct (503, ligne en erreur, cause exacte) |
| Téléchargement de l'original (`/file`), suppression (fichier + index + ligne) | tests + vérifications curl (`200 text/csv`, `204` puis `404`) |
| Réindexation (`POST /reindex`) | test + vérification curl (503 assumé sans encodeur) |
| Bases de connaissances (`/api/knowledge-bases`) | test + curl |

### 1.2 Conversations et provenance

| Fonctionnalité | Preuve |
| --- | --- |
| Création, liste, lecture, renommage, suppression (cascade des messages) | 11 tests `test_conversations_api.py` + cycle complet vérifié en direct |
| Persistance des messages, sources, modèle, retour d'usage | vérifié en direct : `feedback up` → `204`, relu à `up` ; valeur invalide → `422` ; message inconnu → `404` |
| Aucune conversation vide créée si le moteur échoue | `test_failed_engine_leaves_no_empty_conversation` + curl (503, 0 message) |
| Contrat SSE : `sources` → `token`* → `done` | 4 tests `test_chat_stream.py` (moteur bouchonné) |
| Citations numérotées, prompt exigeant `[n]`, page + score dans les sources | 7 tests `test_citations.py` |
| Filtre `category` transmis à la recherche | `test_category_filter_is_applied_to_retrieval`, vérifié en direct sur `/api/documents` |
| Recherche transverse `/api/search` | test + curl (document trouvé par nom) |

### 1.3 Interface React

| Fonctionnalité | Preuve |
| --- | --- |
| Aucune donnée de démonstration (l'ancien template en contenait 4 sources, 8 documents, un profil) | `tests/app.test.tsx` vérifie explicitement leur absence |
| Flux SSE lu en trames partielles (UTF-8 multi-octets), erreurs remontées | 3 tests `tests/stream.test.ts` |
| Renvois `[n]` → boutons liés aux sources, échappement du HTML (y compris nom de document hostile) | 10 tests `tests/ui.test.tsx` |
| Vue Documents accessible par URL `/documents`, routes `/conversations/{id}` | 3 tests `tests/router.test.ts`, 2 tests `app.test.tsx` |
| Types TypeScript stricts (`tsc --noEmit`) | 0 erreur |
| Build de production reproductible (`npm ci` depuis le lockfile → `npm run build`) | vérifié dans un répertoire vierge : 89 paquets, 18 tests, build identique (mêmes empreintes) |

### 1.4 Service de l'interface par FastAPI

| Fonctionnalité | Preuve |
| --- | --- |
| `/` sert le build React | test + vérification directe (`<title>Nexus — assistant documentaire</title>`) |
| `/assets/*` servi avec type MIME et cache long | test + `curl -I` (`text/javascript`, `immutable`) |
| Rafraîchissement des routes frontend (`/documents`, `/conversations/abc123`, `/inconnu`) | test + curl (`200 text/html`) |
| `/api/*` jamais intercepté par le frontend | `test_api_prefix_is_never_handled_by_the_frontend` + curl (`404 application/json`) |
| Traversée de chemin bloquée sur `/assets` | test avec `%2e%2e/`, `..%2f`, `/etc/passwd` |
| Repli sur `frontend/` si le build est absent | test + **vérification en direct** (déplacement de `web/app-dist`, puis restauration, sans redémarrage) |
| Ancienne interface toujours servie sous `/static` | test + curl |
| Diagnostic `frontend: react | legacy` dans `/api/health` | test + curl |

### 1.5 Hygiène et sécurité de base

- Aucune clé en clair dans le dépôt ; `.env` est ignoré ; `/api/health` n'expose
  aucune valeur secrète (test dédié).
- Aucun HTML construit avec des données non échappées : `renderMarkdown` /
  `renderAnswer` échappent avant insertion ; test avec un nom de document
  `<img src=x onerror=…>`.
- Téléversements : extension autorisée **et** signature binaire vérifiée, taille
  plafonnée (25 Mo par défaut), noms de fichiers assainis.
- `data/`, `web/node_modules`, `web/app-dist` ignorés par Git ; pas d'artefact
  volumineux dans le dépôt.
- Sauvegarde de l'ancienne interface : `frontend/` intact, testé
  (`LegacyInterfacePreservedTests`).

### 1.6 Suites de tests exécutées

| Suite | Résultat |
| --- | --- |
| `python -m unittest discover -s tests -t .` | **104 tests OK** |
| `cd web && npm test` | **18 tests OK** |
| `cd web && npx tsc --noEmit` | 0 erreur |
| `cd web && npm run build` | OK (index 0,53 kB · CSS 29,7 kB · JS 275 kB) |

Détail backend : `test_api_baseline` 9 · `test_chat_stream` 4 · `test_citations` 7 ·
`test_conversations_api` 11 · `test_documents` 20 · `test_documents_api` 15 ·
`test_engine_bridge` 6 · `test_frontend_serving` 16 · `test_index` 8 · `test_store` 8.

## 2. Fonctionnalités bloquées par l'environnement

| Élément bloqué | Constat factuel | Conséquence |
| --- | --- | --- |
| Modèle d'embeddings | `sentence-transformers` **non installé** dans l'environnement d'exécution ; `torch` absent ; `huggingface.co` **injoignable** (`curl` → `000`) | Aucun vecteur n'est produit : tout import finit en `503`, le document reste en `erreur` avec la cause exacte |
| Génération Groq | `api.groq.com` **injoignable** (`000`) ; aucune clé dans `.env` (absent) ; `llm_configured: false` | Aucune réponse ne peut être générée ; `/api/chat` répond `503` sans créer de conversation |
| Index historique | `chunks.json` et `embeddings.npy` absents du dépôt (ignorés) | Le moteur ne peut pas retomber sur les artefacts d'origine |
| Vérification visuelle | Aucun navigateur (ni Chromium, ni Playwright), aucun accès root | Pas de capture d'écran, pas de test end-to-end navigateur ; le rendu est vérifié par rendu serveur + CSS du template |
| Validation par un humain | — | Les interactions réelles (clic, saisie, glisser-déposer) n'ont pas été exercées dans un navigateur |

**Ce qui a été testé malgré ces blocages** : toute la mécanique autour de l'IA
l'a été avec des doublures explicites — encodeur factice (`tests/factories.py`,
`FakeEncoder`), client Groq simulé, moteur bouchonné pour le SSE — sans jamais
présenter ces doublures comme des résultats réels dans l'interface.

## 3. Limitations restantes (indépendantes de l'environnement)

### 3.1 Sécurité et exploitation

1. **Aucune authentification ni autorisation** : toute personne atteignant le
   service accède à tous les documents et conversations.
2. **Aucun cloisonnement par document ni par base** : le filtre `category` est un
   confort de recherche, pas un contrôle d'accès.
3. **Aucune limitation de débit** sur `/api/chat` (coût Groq) ni sur les imports.
4. **Pas de CSRF token** : l'API est same-origin par défaut (`ALLOWED_ORIGINS`
   vide), mais une exposition directe derrière un proxy demanderait des protections.
5. **Contenu servi en `inline`** pour l'original d'un document : acceptable pour
   PDF/DOCX/CSV/XLSX (types autorisés uniquement), à revoir si d'autres formats
   (HTML, SVG) sont un jour acceptés.
6. **Pas de journal d'audit métier** (qui a consulté/supprimé quoi), pas de
   politique de conservation.

### 3.2 Fonctionnel

7. **Pas d'OCR** : un PDF scanné est **refusé** (422 « Aucun contenu
   exploitable », aucun document enregistré) — comportement honnête, mais aucune
   prise en charge des documents image.
8. **Recherche purement vectorielle** : pas de recherche hybride (BM25 + vecteurs),
   pas de reranking, pas de seuil par requête ; `MIN_RELEVANCE_SCORE` est global.
9. **Doublons détectés par empreinte SHA-256 globale** : le même fichier ne peut
   pas être présent dans deux bases de connaissances.
10. **Aucune pagination** sur `/api/documents` ; `/api/conversations` est plafonné
    à 100 éléments (constante, non exposée).
11. **SQLite mono-fichier**, une connexion par requête : adapté à un usage
    intranet modéré, pas à une charge concurrente élevée.
12. **Pas de reprise de flux** : si la connexion tombe en cours de génération, la
    réponse partielle est conservée, mais il faut relancer la question.
13. **Score de pertinence absent à la relecture** d'une source archivée
    (`score: null`) — choix assumé plutôt qu'une valeur inventée.
14. **Pas d'export** de conversation, pas de renommage depuis l'interface
    (l'API `PATCH` existe et est testée, le bouton n'est pas exposé), pas de
    sélection de modèle (configuré côté serveur).

### 3.3 Interface

15. **Accessibilité partiellement vérifiée** : libellés `aria`, dialogues modaux,
    focus visibles, `prefers-reduced-motion` (issu du template), mais **pas de
    piège de focus** dans les modales, ni de mesure de contraste sur les nouveaux
    composants — les outils `docs/design/tools/contrast.py` ciblent l'ancienne
    interface (`frontend/css/tokens.css`).
16. **Mobile non vérifié visuellement** : les points de rupture du template
    (980 px, 720 px) sont conservés, rien ne prouve leur bon comportement.
17. **Pas de test end-to-end navigateur** : les 18 tests front couvrent le rendu et
    la logique, pas les interactions réelles.
18. **Palette ⌘K** limitée à 5 documents + 5 conversations par recherche.
19. **Documentation design** (`CLAUDE.md`, `AGENTS.md`) : encadré ajouté pour
    expliquer la coexistence des deux interfaces, mais les anciens documents
    `docs/design/*` décrivent toujours l'interface historique.

### 3.4 Points techniques mineurs

20. `GET /api/sources/{id}` répond `404` pour un identifiant inconnu, y compris
    quand l'index est vide (vérifié en direct). L'interface prévoit aussi un
    message « extrait archivé » pour un `503` : ce cas n'est plus atteignable en
    pratique, il reste comme filet de sécurité.
21. La route de repli renvoie la page HTML pour **tout** chemin inconnu hors
    `/api` : volontaire (rafraîchissement), mais cela masque une faute de frappe
    d'URL côté serveur (pas côté API).
22. Le rendu markdown des réponses est volontairement minimal (gras, code, listes,
    titres) : les tableaux et liens du modèle s'affichent en texte brut.

## 4. Ce qu'il reste à valider pour déclarer l'application opérationnelle

À exécuter dans un environnement avec accès réseau :

1. `pip install -r requirements.txt` (installe `sentence-transformers` + PyTorch).
2. Laisser le modèle `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
   se télécharger une première fois (Hugging Face), puis vérifier que
   `POST /api/documents` répond **201 avec `chunk_count > 0`** (et non 503).
3. Renseigner `GROQ_API_KEY` dans `.env` et vérifier `llm_configured: true` sur
   `/api/health`.
4. Poser une question réelle sur un document importé et vérifier de bout en bout :
   sources pertinentes, réponse en flux, renvois `[n]` cohérents, `done` reçu,
   message et sources persistés, retour d'usage enregistré.
5. Vérifier les cas d'erreur du fournisseur : clé invalide (401 Groq), quota (429),
   modèle inconnu — l'API doit répondre `502` avec un message lisible, sans fuite
   de détail interne.
6. Ouvrir l'application dans un navigateur (bureau + mobile) pour valider
   l'ergonomie, les contrastes et le glisser-déposer.

Tant que les points 1 à 5 ne sont pas exécutés, **la chaîne IA doit être
considérée comme non validée**, quel que soit l'état de l'intégration.

## 5. Livrables produits

```
docs/integration/analyse-template-nexus.md   analyse du template Figma Make
docs/integration/decisions.md                les 9 conflits et les décisions prises
docs/integration/p1-socle-documentaire.md    base documentaire
docs/integration/p2-conversations.md         conversations et persistance
docs/integration/p4-interface.md             interface React connectée
docs/integration/p5-service-build-react.md   service du build par FastAPI
docs/integration/audit-final.md              ce document
web/                                          interface React (18 tests)
tests/test_frontend_serving.py                service du frontend (16 tests)
frontend/                                     ancienne interface, intacte (repli)
```

## 6. Recommandations par priorité

| Priorité | Action |
| --- | --- |
| **P0** | Valider la chaîne IA réelle (§ 4) avant tout usage |
| **P1** | Authentification (SSO/proxy) + cloisonnement des bases par rôle |
| **P1** | Journal d'audit des consultations/suppressions |
| **P2** | Recherche hybride + reranking ; OCR pour les PDF scannés |
| **P2** | Limitation de débit sur `/api/chat` et les imports |
| **P3** | Pagination des documents, reprise de flux, export de conversation |
| **P3** | Audit d'accessibilité des nouveaux composants, tests navigateur |
