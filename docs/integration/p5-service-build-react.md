# P5 — FastAPI sert le build React

**Branche** : `arena/05d356d8-rag-projet`
**Objectif** : la racine de l'application affiche l'interface React, sans casser l'API
ni l'ancienne interface.

## 1. Ce qui a changé dans `app.py`

| Élément | Décision |
| --- | --- |
| `REACT_DIST_DIR` | `web/app-dist` (sortie de `npm run build`) |
| `FRONTEND_DIR` | `frontend/` — **inchangé, conservé intact** |
| `react_dist()` | renvoie le build s'il contient `index.html`, sinon `None` ; évalué **à chaque requête** |
| `frontend_dir()` | build React si présent, sinon `frontend/` (repli) |
| `GET /` | sert `index.html` de l'interface active, `Cache-Control: no-cache` |
| `GET /assets/{path}` | fichiers Vite (JS, CSS, polices, favicon), `Cache-Control: public, max-age=31536000, immutable` |
| `GET /{full_path:path}` | routes de l'interface (`/documents`, `/conversations/{id}`) → `index.html` ; les préfixes `api/`, `static/`, `assets/` ne sont **jamais** interceptés |
| protection | `_inside()` vérifie que le chemin résolu reste sous le répertoire servi (traversée bloquée) |
| `/static` | montage existant conservé : l'ancienne interface reste accessible |
| `GET /api/health` | nouveau champ `"frontend": "react" | "legacy"` (diagnostic, sans secret) |

Pourquoi une résolution à chaque requête : un `npm run build` effectué après le
démarrage du serveur est pris en compte immédiatement, et un build absent
n'empêche pas l'application de fonctionner (repli).

## 2. Routes réelles vérifiées sur le serveur (port 8000, processus `api-rag-fastapi-16e2f9b6`)

| Requête | Résultat |
| --- | --- |
| `GET /` | `200 text/html` — build React (`<title>Nexus — assistant documentaire</title>`, `/assets/favicon-*.svg`) |
| `GET /assets/index-kOz63f61.js` | `200 text/javascript`, `cache-control: public, max-age=31536000, immutable` |
| `GET /assets/index-CiPAD5cf.css` | `200 text/css` |
| `GET /documents` | `200 text/html` (rafraîchissement d'une route frontend) |
| `GET /conversations/abc123` | `200 text/html` |
| `GET /documents/` | `200 text/html` |
| `GET /inconnu` | `200 text/html` (repli de l'application, pas de 404 brutal) |
| `GET /api/health` | `200 application/json`, `frontend: "react"` |
| `GET /api/inconnu` | `404 application/json` — jamais du HTML |
| `GET /api/documents` | `200` |
| `GET /static/css/tokens.css`, `/static/js/app.js`, `/static/icons.svg` | `200` (ancienne interface toujours servie) |

**Repli vérifié en direct** : `web/app-dist` déplacé → `GET /` renvoie
l'ancienne interface, `/api/health` répond `frontend: "legacy"`,
`/assets/…` répond `404` JSON ; build restauré → retour immédiat à React,
**sans redémarrage du serveur**.

## 3. Routes côté React (rafraîchissement)

`web/src/lib/router.ts` — les vues ont maintenant de vraies URL :

| URL | Vue |
| --- | --- |
| `/` | conversation vierge |
| `/documents` | gestion documentaire |
| `/conversations/{id}` | conversation chargée depuis l'API |

- `writeRoute()` utilise `history.pushState` / `replaceState` ; un `popstate`
  resynchronise l'état (boutons Précédent / Suivant) ;
- l'URL pilote le chargement : rafraîchir `/conversations/{id}` recharge la
  conversation via `GET /api/conversations/{id}` ;
- une conversation créée par le flux SSE est reflétée dans l'URL (`replaceState`),
  sans rechargement ni nouvelle requête ;
- le serveur renvoie l'application pour ces chemins (route « catch-all » ci-dessus),
  donc un rafraîchissement ne produit jamais de 404.

## 4. Tests ajoutés

`tests/test_frontend_serving.py` — **16 tests**, sur un faux build fabriqué dans
un dossier temporaire (`REACT_DIST_DIR` redirigé, donc aucun build réel requis) :

1. la racine sert le build React (`index.html`, `Cache-Control: no-cache`) ;
2. les assets JS/CSS sont servis avec le bon type MIME et un cache long ;
3. un asset manquant répond `404` **en JSON**, pas en HTML ;
4. traversée de chemin bloquée (`%2e%2e/`, `..%2f`, `/etc/passwd`) ;
5. fichiers du build hors `assets/` (`/favicon.svg`) servis ;
6. `/`, `/documents`, `/conversations/abc123`, `/documents/` renvoient l'application ;
7. `/api/inconnu` renvoie `404` JSON et n'est jamais géré par le frontend ;
8. `/api/health`, `/api/documents`, `/api/conversations`, `/api/knowledge-bases`,
   `/api/chat` (validation 422) fonctionnent avec le build présent ;
9. `/static/*` (ancienne interface) reste accessible ;
10. sans build : `/` sert l'ancienne interface, `/assets/…` → 404 JSON,
    `/documents` → ancienne interface, `/api/health` → `legacy`, API intacte ;
11. `frontend/` et `web/` contiennent toujours leurs fichiers attendus
    (l'ancienne interface ne peut pas disparaître par accident).

`web/tests/router.test.ts` — **3 tests** : lecture des chemins, repli sur la
conversation vierge, conversion route → URL.

`web/tests/app.test.tsx` — 1 test supplémentaire : l'application montée sur
l'URL `/documents` affiche bien la vue Documents.

## 5. Résultats des suites complètes

| Suite | Résultat |
| --- | --- |
| `python -m unittest discover -s tests -t .` | **104 tests OK** (88 + 16) |
| `cd web && npm test` | **17 tests OK** (13 + 4) |
| `cd web && npx tsc --noEmit` | 0 erreur |
| `cd web && npm run build` | OK (index.html 0,53 kB, CSS 29,7 kB, JS 275 kB) |

## 6. Scripts de démarrage

- `run.bat` / `run.sh` : compilent `web/` si `web/app-dist/index.html` manque,
  puis lancent `uvicorn` ; en cas d'échec de compilation, un message explicite
  indique que l'ancienne interface sera servie.
- README : nouvelle section « Compiler l'interface puis lancer l'application »
  (Node.js, `npm ci`, `npm run build`, routes, cache, repli, mode développement).
