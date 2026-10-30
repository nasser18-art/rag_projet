# Consignes projet pour les assistants de code

## Règle UI : lire les deux skills Apple avant toute modification d'interface

Deux dépôts **originaux** sont versionnés en sous-modules. Ne jamais les réécrire, les résumer
ni recopier leurs règles dans un fichier local : ils sont la source de vérité.

| Rôle | Chemin | Dépôt |
| --- | --- | --- |
| **Constructeur** (tokens, matériaux, mouvement, composants) | `.claude/skills/apple-design-web/` | https://github.com/bowen31337/apple-design |
| **Contrôleur** (HIG Apple, audit, accessibilité) | `.claude/skills/apple-design-review/` | https://github.com/dickwu/apple-design-skill |

**Avant toute modification de `frontend/`, pour tout audit ou toute revue d'UI :**

1. Lire `.claude/skills/apple-design-web/SKILL.md` **en entier**, puis suivre sa table de
   routage : `references/tokens.md` + `assets/tokens.css`, `references/liquid-glass.md`,
   `references/motion-physics.md`, `references/typography.md`, `references/components.md`,
   et `demos/index.html` comme référence de rendu.
2. Lire `.claude/skills/apple-design-review/SKILL.md` **en entier**, puis sa « always-load set »
   (`references/hig/accessibility.md`, `layout.md`, `typography.md`, `color.md`,
   `designing-for-ios.md` / `designing-for-macos.md`, plus `references/cross-platform.md` car ce
   frontend est du HTML/CSS/JS), puis 3 à 6 pages ciblées (`liquid-glass.md`, `materials.md`,
   `motion.md`, `loading.md`, `feedback.md`, `writing.md` pour ce projet).
3. Citer **fichier + section** dans chaque constat (`liquid-glass.md › Recipe 1`,
   `typography.md › Tracking`, `accessibility.md › Vision`). Jamais une règle approximative.

Le constructeur et le contrôleur se complètent : le premier donne les valeurs et le code, le
second tranche en cas de conflit avec les HIG et fournit les critères d'accessibilité.

### Si les sous-modules ne sont pas présents

```sh
git submodule update --init --recursive
```

Sans cela, `.claude/skills/apple-design-web` et `.claude/skills/apple-design-review` sont vides.

### Historique

`.design-rules/` (même dépôt que `apple-design-review`, ajouté lors de la première refonte) et le
lien `.claude/skills/apple-design/` restent en place pour ne pas casser les sessions existantes.

## Contexte produit (pour « Step 1: Establish context » du contrôleur)

- Plateforme : application **web**, pas une app native Apple. Le contrôleur précise qu'une app web
  n'hérite que des principes et des fondations (accessibilité, couleur, typographie, mise en page,
  écriture), pas des conventions de plateforme Apple — cf. `SKILL.md › Step 1 › Scope and limits`.
- Framework : HTML, CSS et JavaScript **vanilla**, modules ES. Aucun framework, aucune dépendance,
  aucun build, aucun CDN.
- Catégorie : assistant documentaire interne (RAG) francophone, intranet, usage bureau et mobile.
- Contrainte : ne jamais modifier `app.py`, `rag/`, les scripts numérotés, `requirements.txt`.
  Contrat API figé : `POST /api/chat` (SSE `sources` → `token`* → `done` | `error`),
  `GET /api/sources/{id}`, `GET /api/health`, fichiers sous `/static/`, page à `/`.

## Règles de code du projet

- Tout style passe par un jeton de `frontend/css/tokens.css`. Aucune couleur, aucun espacement,
  aucun rayon, aucune ombre, aucune durée en dur dans un composant.
- Le verre (Liquid Glass) reste sur les **couches flottantes** : barre supérieure, capsule de
  saisie, feuille latérale. Jamais sur le contenu.
- Respecter `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast`, et le
  repli sans `backdrop-filter`.
- `innerHTML` interdit avec du texte venant du modèle ou des documents ; échapper avant insertion.
- Un commit par thème (tokens, structure, matériaux, composants, mouvement, accessibilité).
