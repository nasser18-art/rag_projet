# Rapport final — refonte « Apple » de l'interface

Dépôt `nasser18-art/rag_projet`. Tout le travail est sur la branche `arena/05d356d8-rag-projet`, qui alimente la **PR #1** vers `master`.

> **Écart assumé par rapport au brief** : la branche `design/apple-ui` n'a pas pu être créée — cette session est liée à `arena/05d356d8-rag-projet` et ne peut pas en changer. Le travail est donc là, et il met à jour la PR #1 au lieu d'une nouvelle PR.
>
> **Deuxième écart** : aucune capture d'écran. Playwright ne s'installe pas ici (voir §6).

---

## 1. Avant / après

Aucune image n'a pu être produite : pas de navigateur dans cet environnement. Ce qui existe à la place :

- **Avant** : commit `9deec4f` (interface d'origine) et `docs/design/phase2-diagnostic.md`, qui décrit l'ancien écran ligne par ligne.
- **Après** : `docs/design/validation-guide.html`. Ouvrez-le après avoir lancé le serveur : il montre les 5 états réels (accueil, en cours, réponse + sources, feuille ouverte, erreur) en 1440 et 390, en clair et en sombre, dans des iframes qui chargent la vraie page. La capture reste à faire dans votre navigateur (`Ctrl+Maj+P` → capture pleine page).
- L'ancien `comparison.html` est conservé tel quel : il documente l'état intermédiaire de la première passe, pas la refonte actuelle.

## 2. Diff par fichier, avec la règle du skill

| Fichier | Nature | Ce qui change | Règle citée |
|---|---|---|---|
| `frontend/css/tokens.css` | **nouveau** | Couleurs clair/sombre, échelle typographique, espacements, rayons 10/14/20/28/capsule, ombres à deux couches, teintes et flous de verre, durées et ressort `linear()` | `apple-design-web/references/tokens.md › Layer structure` ; `typography.md › 2. Tracking is size-specific` ; `liquid-glass.md › Thickness` ; `motion-physics.md › Damping & response` |
| `frontend/css/base.css` | **nouveau** | Remise à zéro, lavis de fond (deux dégradés radiaux), typographie par défaut avec `font-optical-sizing: auto`, anneau de focus unique, lien d'évitement, mouvement réduit global | `typography.md › 1` ; `liquid-glass.md › The mental model` (le verre a besoin de luminance à réfracter) ; `components.md › Buttons` |
| `frontend/css/components.css` | **nouveau** | Matériau `.glass` et ses trois replis ; barre flottante ; pastille d'état ; boutons capsule ; accueil et 2×2 cartes ; fil de conversation ; rail de preuve ; composeur ; feuille glissable ; erreur ; adaptation 760/420 ; `@keyframes` | `liquid-glass.md › Recipe 1 · The four effects` ; `layout.md › Visual hierarchy` ; `components.md › Bottom sheet` ; `loading.md › Best practices` ; `accessibility.md › Vision` |
| `frontend/index.html` | **réécrit** | Coquille en deux couches, barre supérieure en verre, pastille `role="status"`, 4 suggestions, fil, capsule de saisie, feuille unique, région polie, sprite local | `layout.md › Visual hierarchy` ; `feedback.md › Best practices` ; `icons.md › Best practices` |
| `frontend/icons.svg` | **nouveau** | 14 icônes dessinées pour le projet, trait 1,6–1,9 px sur grille 24, `currentColor` | `sf-symbols.md › Best practices` (poids optique aligné sur le texte), `icons.md` |
| `frontend/js/api.js` | **nouveau** | Trois routes, `ApiError`, `describeFailure()` (503 / 502 / 404 / 422 / réseau / abandon), lecteur SSE qui ignore les trames illisibles | `writing.md › Best practices` (erreurs qui disent quoi faire) |
| `frontend/js/ui.js` | **nouveau** | `el()` et `icon()` sans `innerHTML` non échappé, markdown minimal sûr, message, indicateur de frappe, squelettes, rail de preuve, outils de copie, bloc d'erreur, classe `Sheet` complète | `writing.md` ; `motion-physics.md › Dragging (1:1)`, `Momentum projection`, `Rubber banding` ; `feedback.md` |
| `frontend/js/app.js` | **nouveau** | Santé, composeur (auto-hauteur, compteur, Entrée/Maj+Entrée), envoi, flux tamponné par `requestAnimationFrame`, feuille source et historique, `localStorage`, nouvelle conversation, restauration, mode démo | `motion-physics.md › Interruptibility` ; `loading.md › Best practices` ; `feedback.md › Make sure all feedback is accessible` |
| `frontend/styles.css` | **supprimé** | Remplacé par les trois feuilles ci-dessus | `tokens.md › How to use it` |
| `frontend/app.js` | **supprimé** | Remplacé par les trois modules ci-dessus | idem |
| `.claude/skills/apple-design-web/` | **sous-module** | Constructeur, commit `c95fa13` | — |
| `.claude/skills/apple-design-review/` | **sous-module** | Contrôleur, commit `ff4ebdd` | — |
| `CLAUDE.md`, `AGENTS.md` | **réécrits** | Deux skills nommés, ordre de lecture obligatoire, contrat d'API gelé, fichiers interdits, commandes de vérification | — |
| `docs/design/phase2-diagnostic.md` | **nouveau** | 15 constats prioritaires avec `fichier:ligne` et règle citée ; inventaire des IDs/classes/événements | `SKILL.md` (contrôleur) : citer `fichier.md › Titre` |
| `docs/design/phase3-direction.md` | **nouveau** | Brief d'une page : jetons, wireframes 1440/390, élément signature, auto-critique en 4 révisions | `SKILL.md` (contrôleur) › Design improvement mode |
| `docs/design/read-files.md` | **nouveau** | Fichiers réellement lus, section par section | `SKILL.md` (constructeur) › Loading table |
| `docs/design/audit-etat.md` | **nouveau** | Les 15 constats et leur état final | — |
| `docs/design/validation-guide.html` | **nouveau** | Substitut des captures | — |
| `docs/design/tools/ui-check.mjs` | **nouveau** | Harnais DOM (40 contrôles) | — |
| `docs/design/tools/contrast.py` | **réécrit** | Mesure la nouvelle palette, composite les `rgba`, marque les filets « décoratifs » | `accessibility.md › Vision` |
| `docs/design/tools/check_tokens.py` | **réécrit** | Trois feuilles, parité clair/sombre, interdiction des couleurs littérales | `tokens.md › Layer structure` |
| `docs/design/tools/frontend-check.js` | **supprimé** | Remplacé par `ui-check.mjs` (ESM, vrais modules) | — |
| `docs/design/tools/build_comparison.py` | **conservé, obsolète** | Cible l'ancienne interface ; ne s'exécute plus | — |
| `app.py`, `rag/`, scripts numérotés, `requirements.txt` | **intacts** | Vérifiable par `git diff --stat 9deec4f` | contrainte du brief |

## 3. Audit

Tableau complet : `docs/design/audit-etat.md`. Résumé : **15 constats sur 15 traités**, dont 6 de sévérité Haute et 1 Critique. Aucun n'est validé visuellement (§6).

## 4. Jetons

Tous dans `frontend/css/tokens.css`, source unique. Les valeurs proviennent du brief et ont été recalculées.

**Couleur**

| Jeton | Clair | Sombre | Rôle |
|---|---|---|---|
| `--bg` | `#f5f5f7` | `#000000` | fond de page |
| `--bg-surface` | `#ffffff` | `#1c1c1e` | cartes, repli du verre |
| `--bg-elevated` | `#ffffff` | `#2c2c2e` | surfaces hautes |
| `--label` | `#1d1d1f` | `#f5f5f7` | texte principal |
| `--label-secondary` | `#6e6e73` | `#98989d` | texte secondaire (jamais plus clair) |
| `--accent` | `#0066cc` | `#0a84ff` | liens, icônes, jauges |
| `--accent-fill` | `#0066cc` | `#0066cc` | aplat d'action : garde 5,57:1 avec du blanc |
| `--on-accent-fill` | `#ffffff` | `#ffffff` | libellé sur l'aplat |
| `--danger` | `#d70015` | `#ff453a` | erreur (texte) |
| `--status-ok` | `#248a3d` | `#30d158` | point d'état |
| `--status-warn` | `#9a5b00` | `#ffb340` | point d'état dégradé |
| `--separator` / `--separator-opaque` / `--scrim` | `rgba(60,60,67,.29)` / `#c6c6c8` / `rgba(0,0,0,.32)` | `rgba(84,84,88,.60)` / `#38383a` / `rgba(0,0,0,.48)` | filets, défilement, voile |
| `--fill-1…4` | gris translucides 20/16/12/8 % | 36/32/24/18 % | fonds de contrôle |
| `--wash-1/2` | bleus translucides | idem, plus sombres | lavis du fond |
| `--glass-*` | blanc 55/18 %, noir 6 % | blanc 12/6 %, noir 40 % | reflet, lueur, contour |

**Interdits tenus** : `#86868B` n'apparaît nulle part comme couleur de texte (3,62:1) ; le blanc sur `#0A84FF` (3,65:1) n'est utilisé que pour une icône.

**Typographie** : `--text-large-title` 34, `--title-1` 28, `--title-2` 22, `--title-3` 20, `--headline`/`--body` 17, `--callout` 16, `--subhead` 15, `--footnote` 13, `--caption` 12 px. Quatre trackings (`-0.022em`, `-0.014em`, `0`, `+0.01em`), quatre leadings (1,05 / 1,2 / 1,35 / 1,5), quatre graisses.

**Espacement** : `--space-1…12` sur une grille de 4 px (2 → 64 px). **Rayons** : 10 / 14 / 20 / 28 / capsule. **Cibles** : `--tap: 44px`. **Mesure** : `--measure: 720px`, réponses limitées à 68 ch.

**Mouvement** : 100 / 200 / 300 / 450 ms ; `--ease-out`, `--ease-in-out`, `--ease-ios`, `--ease-spring` (ressort amorti ζ = 0,78, ω = 18, échantillonné en `linear()` avec 2 % de dépassement).

## 5. Chargement des skills aux prochaines sessions

**Automatique**

- Les deux sous-modules sont versionnés dans `.gitmodules` et épinglés ; un `git clone --recurse-submodules` les installe.
- `CLAUDE.md` et `AGENTS.md` nomment les deux skills, leurs chemins et l'ordre de lecture obligatoire (routage du constructeur + groupe « Always load » du contrôleur). Un agent qui démarre sur ce dépôt les trouve sans qu'on lui explique.
- `docs/design/read-files.md` dit quels fichiers ont déjà été lus et ce qui en a été retenu.

**Manuel**

- `git submodule update --init --recursive` après un clone normal, sinon les dossiers sont vides.
- `CLAUDE.md` n'est pas magique : il faut **relancer l'agent** dans le dépôt pour que la consigne soit lue ; un agent déjà en cours ne la relit pas.
- Les skills ne se chargent pas eux-mêmes : c'est l'agent qui ouvre les fichiers listés dans le tableau de routage. Rien ne garantit mécaniquement qu'il le fasse — la trace est `read-files.md`.
- Le sous-module historique `.design-rules` et le lien `.claude/skills/apple-design` sont conservés ; leur doublon est expliqué dans `CLAUDE.md › Historique`.

## 6. Non vérifié / limites

Version détaillée : `docs/design/verification.md` §2.

- **Aucun rendu visuel n'a été observé.** Pas de navigateur, donc pas de capture, pas de revue à l'œil. C'est la limite la plus lourde de cette livraison.
- **Aucun flux SSE réel** : sans clé Groq ni index, seuls le 503 réel et un flux simulé ont été exercés. Première réponse réelle jamais vue.
- **Physique de la feuille non ressentie** : projection, caoutchouc et fermeture sont conformes aux formules du skill, jamais testés au doigt.
- **`backdrop-filter` et ses trois replis** non rendus ; Safari et Firefox non ouverts.
- **Lecteur d'écran** non testé.
- **Réfraction SVG** volontairement non implémentée (Chromium seul, ≤ 2 éléments, invérifiable ici) — le verre vit sur les quatre autres effets.
- **Mode démo** (`?demo=…`) est du code de revue présent dans le bundle : petit, inerte sans paramètre, mais c'est du poids mort en production. À retirer si vous préférez un bundle strictement produit.
- **`build_comparison.py`** ne fonctionne plus (il cible l'ancienne interface) ; `comparison.html` reste comme archive figée.

## 7. Commandes PR exactes

La PR #1 existe déjà et pointe `arena/05d356d8-rag-projet` → `master` :

```
git push origin arena/05d356d8-rag-projet
gh pr view 1 --web
```

Pour la mettre à jour côté texte :

```
gh pr edit 1 --title "Refonte Apple de l'interface (Liquid Glass, SF, mouvement)" \
             --body-file docs/design/rapport-final.md
```

Si la PR devait être recréée :

```
gh pr create --base master --head arena/05d356d8-rag-projet \
  --title "Refonte Apple de l'interface (Liquid Glass, SF, mouvement)" \
  --body-file docs/design/rapport-final.md
```
