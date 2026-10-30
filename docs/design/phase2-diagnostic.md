# Phase 2 — Diagnostic de l'existant (aucune modification)

Périmètre lu : `frontend/index.html` (117 l.), `frontend/styles.css` (1 266 l.),
`frontend/app.js` (611 l.), `app.py` (95 l.), `rag/engine.py` (contract de données).
Règles citées depuis les deux skills (chemins complets :
`.claude/skills/apple-design-web/…` et `.claude/skills/apple-design-review/references/hig/…`).

## (a) Inventaire : ce que le JavaScript actuel utilise

### Identifiants (17)

| ID | Rôle actuel |
| --- | --- |
| `#chat` | conteneur de conversation (`aria-busy` pendant le flux) |
| `#composer` | formulaire d'envoi (événement `submit`) |
| `#question` | textarea (événements `input`, `keydown`) |
| `#send` | bouton d'envoi, `disabled` pendant le flux |
| `#stop` | bouton « Arrêter » (`click` → `AbortController`) |
| `#history` | `nav` de l'historique, boutons `aria-current` |
| `#message-template` | `<template>` du message |
| `#welcome` | état d'accueil (retiré au premier message, cloné pour « Nouvelle conversation ») |
| `#char-count` | compteur 3 500 / 4 000 caractères |
| `#live-status` | région `role="status"` (`aria-live="polite"`) |
| `#composer-hint` | texte d'aide (`aria-describedby`) |
| `#new-chat`, `#mobile-new-chat` | nouvelle conversation (deux points d'entrée) |
| `#mobile-history`, `#sidebar-close`, `#sidebar-scrim` | tiroir latéral |
| `#theme-toggle`, `#mobile-theme` | apparence (3 états) |
| `#sidebar` | panneau latéral (`aria-controls`) |

### Classes pilotées par le JS (23)

`.message`, `.message.user`, `.message.assistant`, `.message-content`, `.markdown`,
`.message-status`, `.loading`, `.loading-dots`, `.sender`, `.avatar`, `.copy`,
`.sources`, `.source`, `.source-list`, `.source-toggle`, `.source-index`, `.source-name`,
`.source-meta`, `.source-excerpt`, `.sources-panel`, `.error-block`, `.error-title`,
`.error-detail`, `.retry-button`, `.history-empty`, `.theme-label`, `.composer-wrap`.

### Événements écoutés (7 types)

`click` (14 écouteurs), `submit` (1), `keydown` (2 : Entrée / Maj+Entrée, Échap du tiroir),
`input` (1 : auto-hauteur + compteur), `resize` (1), `change` sur `matchMedia`
(prefers-color-scheme), et un `ResizeObserver`.

### Contrat serveur consommé

`POST /api/chat` en SSE (`sources` → `token`* → `done` | `error`) ; `GET /api/sources/{id}`
(**non utilisé** par l'interface actuelle) ; `GET /api/health` (**non utilisé**).

## (b) Constats priorisés

| # | Constat | Fichier:ligne | Règle du skill citée | Gravité |
| --- | --- | --- | --- | --- |
| 1 | Aucune couche de chrome flottante : pas de barre supérieure, le seul verre est la capsule de saisie. La page est un document plat — exactement ce que montre la capture fournie. | `index.html:41-95`, `styles.css` (`.mobile-header` seul) | `liquid-glass.md › The mental model` : « A real Apple material is four stacked optical effects » ; `layout.md › Visual hierarchy` : « **Differentiate controls from content.** » | Critique |
| 2 | Accent vert `#0d6b5f` / `#7adccb` sans lien avec l'esthétique Apple ; palette neutre propre mais étrangère à SF. | `styles.css:70-77` | `tokens.md › Extending the layer` : « **Brand accent:** override `--accent` (defaults to `--blue`) » ; `color.md › Best practices` | Haut |
| 3 | Icônes en caractères texte : `◈`, `☰`, `◐`, `＋`, `↑`, `✕`, `▸`, `[1]`. Poids optique incohérent avec le texte, rendu variable selon la police système. | `index.html:31,44,51,58,80,83` ; `styles.css` `summary::before` | `sf-symbols.md › Best practices` (symboles alignés sur le poids du texte) ; `icons.md › Best practices` | Haut |
| 4 | Corps de texte à 16 px alors que l'échelle Apple place le corps à 17 pt ; l'interlignage ne suit pas la règle inverse taille/leading. | `styles.css:96` (`--text-body: 1rem`) | `typography.md › 3. Leading (line-height) moves inversely to size` ; `typography.md › 4. Hierarchy = weight + size + leading as a *set*` | Haut |
| 5 | Un seul niveau de tracking (`--tracking-tight`), pas de `--tracking-snug/normal/wide` par taille ; c'est le « tell » n°1 listé par le skill. | `styles.css:104-105` | `typography.md › 2. Tracking is size-specific — this is the big one` | Haut |
| 6 | `font-optical-sizing` absent : SF Text/Display n'est pas sélectionné par la taille. | `styles.css:94-101` (absent) | `typography.md §1` : « **`font-optical-sizing: auto`** is essential » | Moyen |
| 7 | Rayons arbitraires (6/8/12/16/20 px) au lieu de l'échelle continue 10/14/20/28/capsule. | `styles.css:118-123` | `tokens.md › Continuous corners (the squircle detail)` | Moyen |
| 8 | Sources rendues en accordéon `<details>` : pas de cartes, pas de jauge, pas de squelettes, pas de feuille latérale, `GET /api/sources/{id}` jamais appelé. | `app.js` `addSources()` ; `styles.css` `.sources-panel` | `layout.md › Visual hierarchy` (progressive disclosure) ; `loading.md › Best practices` : « **Show something as soon as possible** » (squelettes) | Haut |
| 9 | Aucune pastille d'état : `GET /api/health` existe (`app.py:50`) et n'est jamais appelé, alors que le backend peut répondre `degraded`. | `index.html` (absent), `app.py:50-52` | `feedback.md › Best practices` : « **Consider integrating status feedback into your interface.** » | Haut |
| 10 | Une seule branche d'erreur : 503, 502, réseau coupé et flux interrompu partagent le même message générique. | `app.js` `streamAnswer()` `catch` | `writing.md › Best practices` : « **Write clear error messages** » ; `feedback.md` : « help them understand why » | Moyen |
| 11 | Aucun repli si `backdrop-filter` n'est pas supporté (seul `prefers-reduced-transparency` est traité) : le verre devient un fond translucide sans flou. | `styles.css:1000-1010` | `liquid-glass.md › Accessibility & fallbacks` : « **No backdrop-filter support (older Firefox): fall back to a solid-ish bg.** » | Haut |
| 12 | Thème : bouton à trois états, donc réglage d'apparence propre à l'app. | `index.html:42-44`, `app.js` `cycleTheme()` | `dark-mode.md › Best practices` : « **Avoid offering an app-specific appearance setting.** » | Moyen |
| 13 | Historique en mémoire (`let messages = []`) : perdu au rechargement, alors que le brief autorise `localStorage` (aucun endpoint serveur). | `app.js:30` | `layout.md › Visual hierarchy` (contexte courant) ; `writing.md` (états vides) | Moyen |
| 14 | Feuille unique de 1 266 lignes, un seul `app.js` de 611 lignes : pas de modules, pas de séparation tokens/base/composants. | `styles.css`, `app.js` | `tokens.md › How to use it` (couche de jetons isolée) + contrainte projet | Moyen |
| 15 | Aucune animation de matériau (le verre apparaît d'un coup), aucune physique de ressort, aucune feuille glissable. | `styles.css` (transitions `ease`), `app.js` | `motion-physics.md §2` : « **Interruptibility — the single most important principle** » ; `liquid-glass.md › Animating materials` | Moyen |

## (c) Conservé / réécrit

| Élément | Décision | Motif |
| --- | --- | --- |
| Backend, routes, contrat SSE | **conservé à l'identique** | contrainte absolue (`app.py` interdit) |
| `POST /api/chat`, parsing SSE, `AbortController` | conservé, déplacé dans `js/api.js` | fonctionnel, testé |
| Sécurité `escapeHtml` + Markdown minimal | conservé, étendu (listes, titres) | contrainte « jamais `innerHTML` sans échappement » |
| Comportements : Entrée / Maj+Entrée, compteur 3 500, focus rendu au champ, annonce unique de fin, `aria-busy` | conservés | fonctionnalités actuelles |
| Historique de session | conservé, **+ persistance `localStorage`** | brief §7 |
| Bouton de thème | **supprimé** (suit `prefers-color-scheme`) | `dark-mode.md › Best practices` |
| Tiroir latéral mobile | **remplacé** par un panneau d'historique en feuille (poignée, glisser, Échap) | cohérence avec la feuille des sources |
| `styles.css` mono-fichier | **réécrit** en `css/tokens.css`, `base.css`, `components.css` | brief §Contraintes |
| `app.js` mono-fichier | **réécrit** en modules ES `js/api.js`, `ui.js`, `app.js` | brief §Contraintes |
| Glyphes texte | **remplacés** par un sprite `frontend/icons.svg` | constat #3 |
| Palette verte | **remplacée** par le bleu système + neutres SF | constat #2 |
