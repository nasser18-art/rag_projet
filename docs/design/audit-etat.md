# Audit — état après refonte

Les 15 constats de `phase2-diagnostic.md` (établis avant toute modification), avec leur état final et la preuve dans le code. Sévérité inchangée depuis la phase 2.

Légende : **Traité** = corrigé et vérifiable dans le code ; **Partiel** = corrigé pour l'essentiel, reste une limite nommée dans `rapport-final.md` §6.

| # | Constat (phase 2) | Sév. | État | Preuve | Règle citée |
|---|---|---|---|---|---|
| 1 | Aucune couche de chrome flottante | Critique | Traité | `.topbar.glass` + `.composer.glass` au-dessus d'un contenu sans verre (`components.css` §1–3, §9) | `liquid-glass.md › The mental model` |
| 2 | Accent vert hors esthétique Apple | Haut | Traité | `--accent: #0066cc` / `--accent-fill` unique, retint par un seul jeton (`tokens.css`) | `tokens.md › Extending the layer` |
| 3 | Icônes en glyphes texte (`☰ ◐ ↑ ✕ ▸`) | Haut | Traité | `frontend/icons.svg`, `<use href="/static/icons.svg#i-…">` ; aucune de ces six glyphes dans le HTML | `icons.md › Best practices` |
| 4 | Corps à 16 px, interlignage non inversé | Haut | Traité | `--text-body: 1.0625rem`, quatre `--leading-*` appariés (`tokens.css`, `components.css` §7) | `typography.md › 3. Leading moves inversely to size` |
| 5 | Un seul niveau de tracking | Haut | Traité | `--tracking-tight / snug / normal / wide` appliqués par taille | `typography.md › 2. Tracking is size-specific` |
| 6 | `font-optical-sizing` absent | Moyen | Traité | `base.css` › `body` | `typography.md › 1` |
| 7 | Rayons arbitraires 6/8/12/16/20 | Moyen | Traité | `--radius-sm/md/lg/xl/capsule` = 10/14/20/28/999 | `tokens.md › Continuous corners` |
| 8 | Sources en `<details>`, API `GET /api/sources/{id}` inutilisée | Haut | Traité | Rail de cartes + jauge + squelettes (`components.css` §8) ; feuille qui appelle `getSource()` (`js/app.js › openSourceSheet`) | `loading.md › Best practices` ; `layout.md › Visual hierarchy` |
| 9 | `GET /api/health` jamais appelé | Haut | Traité | `.status-pill` alimentée par `refreshHealth()`, rafraîchie au retour d'onglet et toutes les 60 s | `feedback.md › Best practices` |
| 10 | Une seule branche d'erreur | Moyen | Traité | `describeFailure()` : 503, 502, 404, 422, réseau, flux interrompu, abandon | `writing.md › Best practices` |
| 11 | Aucun repli sans `backdrop-filter` | Haut | Traité | `@supports not (…)` + `prefers-reduced-transparency` + `prefers-contrast` (`components.css` §1) | `liquid-glass.md › Accessibility & fallbacks` |
| 12 | Bouton de thème propre à l'app | Moyen | Traité | Bouton supprimé ; `prefers-color-scheme` seul ; `[data-theme]` réservé aux pages de revue | `dark-mode.md › Best practices` |
| 13 | Historique en mémoire, perdu au rechargement | Moyen | Traité | `localStorage` (`assistant-documentaire.historique.v1`), 40 entrées, purge explicite | `layout.md › Visual hierarchy` |
| 14 | Feuille unique de 1 266 lignes, `app.js` de 611 lignes | Moyen | Traité | `css/{tokens,base,components}.css` + `js/{api,ui,app}.js` ; anciens fichiers supprimés | `tokens.md › How to use it` |
| 15 | Aucune animation de matériau, aucune physique | Moyen | Traité | Ressort `linear()` en jeton, entrée des messages, appui à l'enfoncement, feuille glissable avec projection et bande de caoutchouc | `motion-physics.md › Interruptibility` |

## Ce que l'audit ne couvre pas

- **Le rendu pixel** : aucun navigateur n'est disponible ici. Aucun de ces constats n'est validé visuellement ; ils sont validés par lecture du code, par le harnais DOM (`tools/ui-check.mjs`, 40/40) et par le guide de revue (`validation-guide.html`).
- **Les jetons translucides** (`--separator`, `--fill-*`, teintes de verre) ne sont pas mesurables deux à deux : `contrast.py` les composite sur leur support quand c'est possible, sinon ils sont contrôlés à la main.
