# AGENTS.md

> **Après P1 → P5, deux interfaces coexistent.** `web/` (React 19 + TypeScript +
> Vite) est l'interface active, compilée par `npm run build` et servie par
> FastAPI (`/`, `/assets`, routes `/documents` et `/conversations/{id}`).
> `frontend/` est l'ancienne interface HTML/CSS/JS : elle reste intacte et sert
> de repli. Les règles « ne pas modifier `app.py` / `rag/` » valaient pour la
> refonte graphique seule ; elles ne s'appliquent plus aux étapes d'intégration
> documentées dans `docs/integration/`.
>
> Vérifications minimales avant de proposer un changement :
>
> ```sh
> python -m unittest discover -s tests -t .   # API, documents, conversations, frontend
> cd web && npm test && npm run build         # composants, flux SSE, routes, build
> ```

Consignes pour tout agent de code travaillant sur ce dépôt (voir aussi `CLAUDE.md`, qui porte les
mêmes règles).

## Travail UI : deux skills Apple obligatoires

Ce dépôt vendorise **deux dépôts de skills originaux** en sous-modules. Ils ne doivent jamais être
réécrits, résumés ou recopiés localement.

| Rôle | Chemin | Dépôt |
| --- | --- | --- |
| Constructeur | `.claude/skills/apple-design-web/` | https://github.com/bowen31337/apple-design |
| Contrôleur | `.claude/skills/apple-design-review/` | https://github.com/dickwu/apple-design-skill |

Pour **toute** modification de `frontend/`, tout audit ou toute revue d'interface :

1. Lire `.claude/skills/apple-design-web/SKILL.md`, puis suivre sa table de routage
   (`references/tokens.md`, `assets/tokens.css`, `references/liquid-glass.md`,
   `references/motion-physics.md`, `references/typography.md`, `references/components.md`,
   `demos/index.html`).
2. Lire `.claude/skills/apple-design-review/SKILL.md`, puis sa « always-load set »
   (`references/hig/accessibility.md`, `layout.md`, `typography.md`, `color.md`,
   `designing-for-ios.md` / `designing-for-macos.md`, `references/cross-platform.md`) et 3 à 6
   pages ciblées selon l'écran.
3. Citer `fichier.md › Section` pour chaque décision de design.

Sous-modules absents :

```sh
git submodule update --init --recursive
```

## Contraintes non négociables

- **Ne pas modifier** : `app.py`, `rag/`, les scripts numérotés (`01_*` … `09_*`),
  `requirements.txt`. Aucun nouvel endpoint.
- **Contrat API inchangé** : `POST /api/chat` (SSE : `sources`, `token`, `done`, `error`),
  `GET /api/sources/{id}`, `GET /api/health`, assets sous `/static/`, page à `/`.
- **Frontend** : HTML/CSS/JS vanilla, modules ES, aucune dépendance, aucun build, aucun CDN.
- **Sécurité** : jamais de `innerHTML` avec du texte venant du modèle ou des documents sans
  échappement préalable.
- **Design** : tout style passe par un jeton (`frontend/css/tokens.css`) ; le verre reste sur les
  couches flottantes, jamais sur le contenu ; respecter `prefers-reduced-motion`,
  `prefers-reduced-transparency`, `prefers-contrast` et le repli sans `backdrop-filter`.
- **Aucune ressource Apple copiée** (logo, polices SF, images apple.com).

## Vérifications avant de proposer un changement

```sh
python3 docs/design/tools/contrast.py --strict   # contrastes AA des jetons
python3 docs/design/tools/check_tokens.py        # jetons définis / variantes sombres / couleurs littérales
```

Et pour la vérification fonctionnelle sans navigateur :

```sh
mkdir -p /tmp/domtest && cd /tmp/domtest && npm init -y && npm install jsdom@24
cp /chemin/vers/rag_projet/docs/design/tools/ui-check.mjs .
FRONTEND_DIR=/chemin/vers/rag_projet/frontend node ui-check.mjs
```
