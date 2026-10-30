# Audit UI — Assistant documentaire (RAG)

**Skill appliqué** : `apple-design-skill` (dépôt original, sous-module `.design-rules/`),
`SKILL.md` lu en entier puis les références listées en fin de document.
**Date** : 2026-10-30 · **Périmètre** : `frontend/index.html`, `frontend/styles.css`, `frontend/app.js`.
**Aucune modification de code n'a été faite dans cette phase.**

## Contexte (SKILL.md › Review process › Step 1)

| Élément | Valeur |
| --- | --- |
| Plateforme / framework | Application web (navigateur), HTML + CSS + JS vanilla. Pas d'app native Apple. |
| Portée | `SKILL.md › Step 1 › Scope and limits` : « A web app … gets the principles and the foundations (accessibility, color, typography, layout, writing) but not Apple's platform conventions. » Les règles de convention iOS/macOS (tab bar, barre de menus, feuilles) ne sont donc **pas** invoquées ici. |
| Audiences | Salariés d'une entreprise francophone, intranet, clavier + souris au bureau, tactile possible sur mobile. |
| Thèse de l'écran | Poser une question, obtenir une réponse **traçable** vers des extraits de documents internes. La valeur tient dans la vérifiabilité, pas dans le chat. |
| Artifact | Code source, pas de captures. Le contraste est **calculé** depuis les hex (`docs/design/tools/contrast.py`), pas estimé. |
| Limite | Aucun navigateur installable dans cet environnement : les états visuels ne peuvent pas être observés. Voir `docs/design/verification.md`. |

## Tableau d'audit

Légende gravité (définie par `SKILL.md › Step 4 › Severity`) : **Critique** = échec
d'accessibilité, inutilisable, convention cassée ; **Haute** = friction réelle, contraste ou
lisibilité insuffisants, aspect étranger ; **Moyenne** = motif sous-optimal, incohérence ;
**Basse** = finition.

> `frontend/styles.css` concentre ~90 % de ses règles sur **3 lignes** (l.1, l.3, l.4). Les
> références `styles.css:3` sont donc exactes mais grossières : le sélecteur est cité en plus.
> C'est en soi le constat **#2** (source non formatée, non relisible en revue).

### 1. Hiérarchie typographique

| # | Problème | Fichier:ligne | Règle du skill invoquée | Gravité | Correctif prévu | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Aucune échelle typographique : `30px` (h1), `15px` (body), `12px` (hint), `13px` (extraits), `22px` (icônes), `11px` (hint mobile) choisis un par un. La hiérarchie ne tient qu'à des tailles ad hoc. | `styles.css:3` `.welcome h1`, `body`, `.hint`, `.source p` ; `styles.css:4` `.hint` | `typography.md › Conveying hierarchy` : « **Adjust font weight, size, and color as needed to emphasize important information and help people visualize hierarchy.** » | Haute | Échelle de tokens `--text-xs … --text-3xl` + une règle par rôle (display, title, body, caption). | corrigé |
| 2 | Toutes les règles CSS sont tassées sur 3 lignes ; une revue ligne à ligne est impossible, les correctifs sont risqués. | `styles.css:3-4`, `app.js:5-8` | `SKILL.md › Working rules` : « Numbers, not adjectives » suppose des constats localisables ; `layout.md › Visual hierarchy` (alignement/ordre lisibles) s'applique aussi au code de style. Jugement d'ingénierie. | Moyenne | Réécriture multi-lignes, une règle par ligne, ordre tokens → base → composants → états → responsive. | corrigé |
| 3 | `font:15px/1.55 Inter,Segoe UI,Roboto,Arial,sans-serif` : `Inter` n'est jamais chargée (aucun `@font-face`, aucun CDN), donc la police demandée n'existe pas et le rendu dépend du fallback. | `styles.css:3` `body` | `typography.md › Using system fonts` : la plateforme fournit SF Pro ; `typography.md › Using custom fonts` : « **Make sure custom fonts are legible** » suppose qu'elles soient réellement livrées. | Moyenne | Pile système explicite (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `system-ui`, `Roboto`), `Inter` retirée. | corrigé |
| 4 | Texte d'aide `.hint` à `12px` ≈ **9 pt**, sous le minimum de 10 pt (macOS) et de 11 pt (mobile). Idem `.hint` mobile à `11px` ≈ 8,25 pt. | `styles.css:3` `.hint`, `styles.css:4` `.hint` | `typography.md › Ensuring legibility` (tableau : iOS 17 pt/11 pt, macOS 13 pt/10 pt) + `accessibility.md › Vision` : « **Use recommended defaults for custom type sizes.** » | Haute | `--text-xs: 0.8125rem` (13 px = 9,75 pt) → **insuffisant** ; retenu `--text-sm: 0.875rem` (14 px = 10,5 pt) pour tout texte secondaire. | corrigé |
| 5 | Extraits de sources `.source p` à `13px` ≈ 9,75 pt, sous le minimum. C'est le texte qui porte la preuve documentaire. | `styles.css:3` `.source p` | `typography.md › Ensuring legibility` (tableau des minimums) | Haute | `--text-sm` (14 px), `line-height` 1.5. | corrigé |
| 6 | Tailles en `px` uniquement : la préférence de taille de police du navigateur (réglage système) est ignorée. | `styles.css:1-19` (toutes) | `accessibility.md › Vision` : « **Support larger text sizes.** … give people the option to enlarge text by at least 200 percent » | Haute | Passage en `rem` pour toute la typographie et les espacements. | corrigé |
| 7 | `letter-spacing:-.6px` figé sur le h1, et `-0.6px` ne suit pas la taille. | `styles.css:3` `.welcome h1` | `typography.md › Using system fonts` : « the system font **dynamically adjusts tracking at every point size** » ; `typography.md › Tracking values` | Basse | Tracking en `em` (`-0.02em`), donc proportionnel. | corrigé |
| 8 | Titre `30px` → `25px` en dessous de 700 px, sans `clamp()` : à 200 % de zoom le titre ne suit pas et les exemples passent sous la zone de saisie. | `styles.css:3`, `styles.css:4` | `accessibility.md › Vision` (agrandissement 200 %) + `layout.md › Adaptability` : « **Be prepared for text-size changes.** » | Moyenne | `clamp()` sur le titre + test à 200 % de zoom. | corrigé |
| 9 | Titres d'historique tronqués par `text-overflow:ellipsis; white-space:nowrap` sans `title` ni vue alternative. | `styles.css:3` `.history button` | `typography.md › Supporting Dynamic Type` : « **Keep text truncation to a minimum as font size increases.** » | Moyenne | `line-clamp: 2` + `title` (nom complet accessible) ; pastille d'état actif. | corrigé |

### 2. Espacements (grille de 4/8 px)

| # | Problème | Fichier:ligne | Règle du skill invoquée | Gravité | Correctif prévu | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| 10 | Aucune échelle d'espacement : `22, 14, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2` px coexistent. Rien ne s'aligne sur une grille. | `styles.css:3-4` (tout) | `layout.md › Visual hierarchy` : « **Align elements to make them easier to scan** … People assume that aligned items are related » | Moyenne | Échelle `--space-1..--space-12` sur base 4 px (4, 8, 12, 16, 20, 24, 32, 40, 48, 64) ; toute marge passe par un token. | corrigé |
| 11 | Rythme vertical des messages incohérent : `27px` entre messages, `13px` avatar, `10px` paragraphes, `7px`/`8px` pour le texte d'aide. | `styles.css:3` `.message`, `.markdown p`, `.hint` | `layout.md › Visual hierarchy` : « **Group related items to clearly express related information** … use negative space … to show which elements are related » | Moyenne | `--space-6` (24 px) entre messages, `--space-5` (20 px) entre groupes, `--space-2` dans un paragraphe. | corrigé |
| 12 | La zone de saisie fixe laisse `padding-bottom:150px` alors que le textarea peut grandir jusqu'à `180px` : le dernier message passe **sous** le composeur. | `styles.css:3` `.chat` + `.composer textarea{max-height:180px}` | `layout.md › Adaptability` : « People expect your experience to remain familiar when they … resize a window » ; `layout.md › Guides and safe areas` (respecter la safe area) | Haute | La marge basse est pilotée en JS par la hauteur réelle du composeur (`--composer-height`), le composeur reste dans le flux collant. | corrigé |
| 13 | Les marges horizontales divergent : `.chat` 30 px, `.composer-wrap` `max(25px, calc((100vw - 800px)/2))`, sidebar 14 px, marque 9 px. Colonnes non alignées. | `styles.css:3` `.chat`, `.composer-wrap`, `.sidebar` | `layout.md › Visual hierarchy` : « **Align elements to make them easier to scan, and use indentation to convey hierarchy.** » | Moyenne | Une seule variable `--gutter` réutilisée par la colonne de contenu et le composeur. | corrigé |

### 3. Couleurs et contraste (WCAG AA)

Ratios calculés par `docs/design/tools/contrast.py` (formule WCAG 2.1, sur les hex réels).

| # | Problème | Fichier:ligne | Règle du skill invoquée | Gravité | Correctif prévu | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| 14 | Mode sombre : texte **blanc sur `--accent` #5ac8b8 = 2,02:1**. Touche `.new-chat` (« Nouvelle conversation ») et le bouton d'envoi. | `styles.css:2` (`--accent`) + `styles.css:3` `.new-chat`, `.composer button` | `accessibility.md › Vision` (tableau : jusqu'à 17 pt → **4,5:1**) ; `dark-mode.md › Dark Mode colors` : « make sure the contrast ratio between colors is no lower than 4.5:1 » | **Critique** | Texte du bouton sur `--accent-solid` calculé ≥ 4,5:1 dans les deux thèmes (nuit sur accent clair). | corrigé |
| 15 | Placeholder `--muted` à `opacity:.82` → **3,38:1** sur la surface. C'est l'affordance principale de la zone de question. | `styles.css:16` `.composer textarea::placeholder` | `accessibility.md › Vision` (4,5:1) | Haute | Opacité retirée, `--text-placeholder` calculé ≥ 4,5:1. | corrigé |
| 16 | Glyphes d'avatar illisibles : assistant `#1d2733` sur `#126e62` = **2,47:1** (clair), utilisateur `#1d2733` sur `#536577` = **2,51:1** (clair), assistant `#edf2f7` sur `#5ac8b8` = **1,79:1** (sombre). | `styles.css:3` `.avatar`, `.message.user .avatar` | `color.md › Inclusive color` : « **Avoid using colors that make it hard to perceive content** … insufficient contrast can cause icons and text to blend with the background » | Haute | Avatar = pastille de couleur sémantique + glyphe sur fond à contraste ≥ 4,5:1. | corrigé |
| 17 | `--border` (#e3e7eb) à **1,17:1** sert seule à délimiter les cartes d'exemple, les sources et le composeur. | `styles.css:1` `--border`, `styles.css:3` `.examples button`, `.source`, `.composer` | `color.md › Inclusive color` + `accessibility.md › Vision` ; seuil non-textuel WCAG 1.4.11 (3:1) — **jugement**, le skill ne cite que le contraste de texte | Moyenne | `--border` renforcé (≥ 1,5:1 décoratif) et `--border-strong` ≥ 3:1 pour les limites de contrôles interactifs. | corrigé |
| 18 | Couleurs codées en dur hors tokens : `#536577` (avatar), `rgba(255,255,255,.45)` (bordure du bouton d'envoi), `rgba(255,255,255,.9)` et `rgba(94,202,187,.38)` (halos décoratifs). | `styles.css:3`, `styles.css:12-13`, `styles.css:17` | `dark-mode.md › Dark Mode colors` : « **Avoid using hard-coded color values or colors that don't adapt.** » ; `color.md › Best practices` : « **Avoid using the same color to mean different things.** » | Haute | Toutes les couleurs passent par des tokens, avec variante clair/sombre. | corrigé |
| 19 | Aucune réponse au réglage « contraste augmenté ». | `styles.css:1-19` | `accessibility.md › Vision` : « ensure it at least provides a higher contrast color scheme when the system setting **Increase Contrast** is turned on » | Moyenne | Bloc `@media (prefers-contrast: more)` : bordures et texte secondaire renforcés. | corrigé |
| 20 | Mode sombre : `--shadow:none` mais `--glass-shadow` conserve une ombre portée forte `rgba(0,0,0,.34)`. Profondeur incohérente entre composants. | `styles.css:2` vs `styles.css:9` | `color.md › Best practices` : « **Make sure all your app's colors work well in light, dark** … contexts » | Basse | Tokens d'ombre par thème, une seule échelle d'élévation. | corrigé |

### 4. États (hover, focus, disabled, loading, erreur, vide)

| # | Problème | Fichier:ligne | Règle du skill invoquée | Gravité | Correctif prévu | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| 21 | **Aucun `:focus-visible`** dans la feuille de style : navigation clavier invisible sur tous les boutons (`.new-chat`, exemples, historique, sources, thème, envoi). | `styles.css:1-19` (absent) | `focus-and-selection.md › Best practices` : « **Indicate focus using visual appearances that are consistent with the platform.** » ; `accessibility.md › Speech` : « **Let people use the keyboard alone to navigate and interact with your app.** » | **Critique** | Anneau de focus unique `--focus-ring` sur `:focus-visible` (3:1 minimum), jamais supprimé. | corrigé |
| 22 | État `:disabled` réduit à `opacity:.5` sur le seul bouton d'envoi ; aucun autre contrôle n'a d'état désactivé, aucun `aria-disabled`. | `styles.css:3` `.composer button:disabled` | `buttons.md › Best practices` : « **Always include a press state for a custom button.** Without a press state, a button can feel unresponsive » | Moyenne | État désactivé tokenisé (couleur + curseur + `aria-disabled`) et `:active` sur tous les boutons. | corrigé |
| 23 | Aucun état d'appui (`:active`) sur les cartes d'exemple, l'historique ni les sources. | `styles.css:3` `.examples button:hover`, `.history button:hover` | `buttons.md › Best practices` (état d'appui obligatoire pour un bouton personnalisé) | Moyenne | `:active` (translation 1 px + fond), `transition` ≤ 120 ms. | corrigé |
| 24 | État d'erreur : `body.textContent = error.message`. Le message remplace le contenu, sans titre, sans action, sans conservation de la question. | `app.js:8` (bloc `catch`) | `feedback.md › Best practices` : « **Show people when a command can't be carried out and help them understand why.** » ; `writing.md › Best practices` : « **Write clear error messages** » (près du problème, sans blâme, avec l'action de correction) | Haute | Bloc d'erreur structuré (`role="alert"`, titre, cause, bouton « Réessayer »). | corrigé |
| 25 | État de chargement : un simple curseur clignotant `::after`, aucune description textuelle, aucun moyen d'arrêter la génération. | `styles.css:3` `.loading::after` + `@keyframes blink` | `progress-indicators.md › Best practices` : « **If it's feasible, let people halt processing.** » et « **If it's helpful, display a description that provides additional context for the task.** » | Haute | Indicateur à trois points + libellé « Recherche dans les documents… », bouton « Arrêter » qui interrompt le flux (`AbortController`). | corrigé |
| 26 | Pendant le streaming, `#chat` est `aria-live="polite"` et le contenu est réécrit à **chaque token** : le lecteur d'écran énonce la réponse en boucle morceau par morceau. | `index.html:20` + `app.js:8` (`body.innerHTML` dans la boucle) | `feedback.md › Best practices` : « **Make sure all feedback is accessible.** » ; `accessibility.md › Vision` (VoiceOver, ordre et annonces) | Haute | `aria-live` retiré de `#chat`, région d'annonce dédiée `role="status"` qui annonce « Réponse terminée, 3 sources » une seule fois ; `aria-busy="true"` pendant le flux. | corrigé |
| 27 | Bouton « Copier » : aucun retour après clic, le libellé ne change pas. | `app.js:5` `.copy.onclick` | `writing.md › Best practices` : « An action keeps its name through the whole flow » + `feedback.md` (retour immédiat) | Basse | « Copié » pendant 2 s, annoncé en `role="status"`. | corrigé |
| 28 | État vide de « Nouvelle conversation » : `newChat()` réinjecte un `h1`+`p` et **perd les 4 questions d'exemple**. Deux états vides différents pour le même écran. | `app.js:8` (`newChat`) vs `index.html:25-30` | `writing.md › Best practices` : « **Provide clear next steps on any blank screens.** … guide people on actions they can take » | Moyenne | Un seul composant d'accueil réutilisé (`<template>`), exemples conservés. | corrigé |
| 29 | Historique : aucun état sélectionné/actif ; un clic défile sans indiquer où l'on est ; historique vide = `nav` vide sans message. | `app.js:6` `renderHistory()` | `sidebars.md › Best practices` : « **If you need to include two levels of hierarchy in a sidebar, use succinct, descriptive labels** » ; `layout.md › Visual hierarchy` (l'élément courant doit être repérable) | Moyenne | `aria-current="true"` + style actif ; état vide « Vos questions apparaîtront ici ». | corrigé |

### 5. Accessibilité (focus, ARIA, clavier, mouvements, apparence)

| # | Problème | Fichier:ligne | Règle du skill invoquée | Gravité | Correctif prévu | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| 30 | Boutons thème : `aria-label="Activer le thème sombre"` figé, jamais mis à jour ; deux boutons différents libellés « thème » ; l'état n'est porté que par le glyphe `◐`. | `index.html:16`, `index.html:19`, `app.js:8` (`toggleTheme`) | `accessibility.md › Vision` : « **Convey information with more than color alone.** » ; tout contrôle icône doit avoir un libellé à jour | Moyenne | Libellé dynamique (« Apparence : sombre. Passer à système. »), 3 états (Système / Clair / Sombre) annoncés dans une région `role=status`. Pas d'`aria-pressed` : un cycle à trois états ne se décrit pas par un booléen. | corrigé |
| 31 | `prefers-reduced-motion` non géré : clignotement infini `.loading`, `scrollIntoView({behavior:'smooth'})`, transitions et `transform` au survol. | `styles.css:3` `@keyframes blink`, `app.js:6`/`app.js:8` (`smooth`) | `accessibility.md › Cognitive` : « **Be cautious with fast-moving and blinking animations.** … When this setting is active, ensure your app … responds by reducing automatic and repetitive animations, including zooming, scaling » | Haute | Bloc `@media (prefers-reduced-motion: reduce)` (animations coupées, défilement instantané) **et** détection JS pour `behavior:'auto'`. | corrigé |
| 32 | `prefers-reduced-transparency` / `prefers-contrast` non gérés sur le composeur en verre (`backdrop-filter: blur(20px)`). | `styles.css:11` `.composer` | `liquid-glass.md › Review checklist` (point 5) : « **Reduce Transparency gets an opaque fallback, Increase Contrast gets stronger fills and borders** » | Moyenne | Repli opaque sous `prefers-reduced-transparency: reduce` et `prefers-contrast: more`. | corrigé |
| 33 | `prefers-color-scheme` ignoré : le thème vient uniquement de `localStorage`; en première visite sur un OS sombre, l'app s'affiche en clair. Le bouton est un réglage d'apparence propre à l'app. | `styles.css:1-2`, `app.js:8` | `dark-mode.md › Best practices` : « **Avoid offering an app-specific appearance setting.** » et « **Ensure that your app looks good in both appearance modes.** » | Haute | `@media (prefers-color-scheme: dark)` comme source par défaut ; le bouton devient un choix explicite Système/Clair/Sombre dont « Système » est la valeur par défaut (compromis assumé, voir § Trade-offs). | corrigé |
| 34 | Boutons de sources : l'extrait est basculé via `hidden` sans `aria-expanded` ni `aria-controls` ; le `<summary>` n'annonce pas le nombre correctement structuré. | `app.js:7` `addSources()` | `accessibility.md › Vision` (état exposé) + `focus-and-selection.md › Best practices` (l'élément focalisé doit être identifiable) | Moyenne | `aria-expanded` synchronisé, extrait en `<p id>` lié par `aria-controls`, numéro de source explicite. | corrigé |
| 35 | Cibles tactiles trop petites : bouton d'envoi `38×38`, `.quiet-button` ≈ 30 px de haut, `.icon-button` sans padding (≈ 26 px), bouton de source réduit à son texte (hauteur ≈ 20 px). | `styles.css:17` `.composer button`, `styles.css:3` `.quiet-button`, `styles.css:4` `.icon-button`, `styles.css:3` `.source button` | `accessibility.md › Mobility` (tableau : mobile 44×44 pt par défaut, 28×28 pt minimum ; macOS 28×28 pt, minimum 20×20) + `liquid-glass.md › Review checklist` point 7 | Haute | Toutes les cibles ≥ 44×44 px sur mobile, ≥ 28×28 px sur bureau, avec espacement ≥ 8 px. | corrigé |
| 36 | Aucun lien d'évitement, aucune région `banner`/`contentinfo`; le `<aside>` porte un `aria-label` mais pas de rôle de navigation nommé cohérent. | `index.html:11-20` | `accessibility.md › Speech` (navigation clavier) ; `layout.md › Visual hierarchy` (le contenu principal doit être atteignable en premier) | Basse | Lien « Aller à la conversation », `role="banner"` sur l'en-tête mobile, `nav` déjà nommé conservé. | corrigé |
| 37 | `.sr-only` utilise `clip:rect(0,0,0,0)` seul (technique dépréciée, `clip-path` non fourni). | `styles.css:3` `.sr-only` | `accessibility.md › Vision` (contenu disponible aux technologies d'assistance) — jugement technique | Basse | `clip-path: inset(50%)` ajouté. | corrigé |
| 38 | `aria-busy` absent sur la conversation pendant la génération. | `index.html:20` | `feedback.md › Best practices` (retour d'état accessible) | Moyenne | `aria-busy="true"` sur `#chat` pendant le flux, retiré à la fin. | corrigé |

### 6. Responsive

| # | Problème | Fichier:ligne | Règle du skill invoquée | Gravité | Correctif prévu | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| 39 | Sous 700 px la barre latérale disparaît : **l'historique de conversation devient inaccessible**, alors que l'en-tête mobile n'offre que « nouvelle conversation » et « thème ». | `styles.css:4` `.sidebar{display:none}` + `index.html:19` | `layout.md › Size classes` : « **Keep functionality the same as size classes change** … you can change the amount of functionality that's visible, [not the functionality] » | Haute | Tiroir latéral accessible par un bouton « Historique » dans l'en-tête mobile (même contenu, même fonction). | corrigé |
| 40 | Un seul palier (700 px) ; entre 701 et 900 px la barre de 270 px et le composeur décalé de 270 px se chevauchent ; `min-height:100vh` se casse avec les barres d'outils mobiles. | `styles.css:4`, `styles.css:3` `.composer-wrap`, `.app-shell{min-height:100vh}` | `layout.md › Size classes` : « **Determine layout based on size classes, not device type or orientation.** » + `layout.md › Adaptability` | Moyenne | Paliers 560/760/1024 px, `100dvh` avec repli `100vh`, sidebar masquée seulement quand la largeur ne la porte plus. | corrigé |
| 41 | Largeur de lecture jusqu'à 850 px (~110 caractères) pour des réponses longues. | `styles.css:3` `.chat{width:min(850px,100%)}` | `layout.md › Guides and safe areas` : « predefined layout guides … **restrict the width of text for optimal readability** » | Moyenne | `--measure: 68ch` (≈ 720 px). | corrigé |
| 42 | À 320 px de large, deux colonnes d'exemples tiennent encore jusqu'au palier 700 px ; le texte des cartes peut déborder. | `styles.css:3` `.examples{grid-template-columns:1fr 1fr}` | `layout.md › Adaptability` : « **Preview your app on multiple devices, using different size classes** » | Basse | `grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr))`. | corrigé |

### 7. Écrans propres au RAG

| # | Problème | Fichier:ligne | Règle du skill invoquée | Gravité | Correctif prévu | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| 43 | **Zone de question** : la seule indication est un placeholder qui disparaît à la frappe ; le libellé n'existe qu'en `sr-only`. Aucune limite de longueur visible alors que `maxlength="4000"`. | `index.html:35-36` | `text-fields.md › Best practices` : « **Show a hint in a text field** … Because placeholder text disappears … it can also be useful to include a separate label » ; « **Match the size of a text field to the quantity of anticipated text.** » | Moyenne | Libellé visible « Votre question », compteur discret à partir de 3 500 caractères, `aria-describedby` vers l'aide clavier. | corrigé |
| 44 | **Réponse en streaming** : le HTML est régénéré à chaque token (`innerHTML`), ce qui détruit la position de sélection et provoque des sauts de mise en page ; `scrollIntoView(false)` est appelé sur tout le conteneur à chaque token. | `app.js:8` | `loading.md › Best practices` : « **Let people do other things … while they wait** » ; `motion.md › Best practices` : « **In apps, generally avoid adding motion to UI interactions that occur frequently.** » | Haute | Rendu agrégé par image d'animation (`requestAnimationFrame`) au lieu de chaque token, défilement ancré seulement si le lecteur est déjà en bas, rien n'est réécrit hors flux. Rendu encore global (`innerHTML`) : voir « Non vérifié / limites ». | corrigé |
| 45 | **Sources / citations** : l'événement `sources` arrive **en premier** dans le flux, mais `addSources()` n'est appelé qu'après la fin ; les sources restent invisibles pendant toute la génération. Aucun numéro, aucune catégorie, aucun score, aucun lien alors que l'API renvoie `id`, `category`, `score` et expose `/api/sources/{id}`. | `app.js:7-8` (`addSources` appelé après la boucle) | `generative-ai.md › Transparency` : « **Communicate where your app uses AI** … Set clear expectations » ; `layout.md › Visual hierarchy` : « **Use progressive disclosure** » (masquer le détail, pas l'essentiel) | Haute | Sources affichées dès réception, numérotées `[1]…[n]`, avec catégorie et score de pertinence ; extrait dépliable ; pas de lien mort. | corrigé |
| 46 | **Aucune citation dans la réponse** : rien ne relie une phrase à sa source, alors que c'est la promesse produit. | `index.html:43` (gabarit sans emplacement de citation) | `generative-ai.md › Transparency` et `machine-learning.md › Limitations` (rendre vérifiable ce qui est généré) | Moyenne | Les sources sont numérotées et l'ordre de pertinence est explicite ; pas de marqueur `[n]` injecté dans le texte (le backend ne fournit pas l'ancrage → le fabriquer serait mensonger). Amélioration proposée côté backend, non implémentée. | non corrigé (limite) |
| 47 | **Upload de document** : aucun écran dans le frontend et **aucune route** dans `app.py` (`/api/*` = `health`, `sources/{id}`, `chat`). | `index.html` (absent), `app.py:50-90` | `file-management.md › Best practices` + `feedback.md` : un flux d'import doit annoncer progression, formats acceptés et erreurs. | Haute | **Non implémentable sans modifier le backend (interdit par la consigne).** Contrat proposé documenté ; en attendant, l'interface ne affiche aucun bouton mort (pas de faux upload). | non corrigé (limite) |
| 48 | **Historique** : conservé uniquement en mémoire (`let messages = []`), perdu au rechargement, sans suppression ni titre de session. | `app.js:2` | `layout.md › Visual hierarchy` (contexte courant visible) ; `sidebars.md › Best practices` | Basse | État vide explicite, état actif, libellé complet en `title`. La persistance nécessiterait un stockage (hors périmètre). | partiel |

## Ce qui fonctionne déjà (à préserver)

- Architecture sans dépendance ni build : trois fichiers, aucun CDN — cohérent avec la contrainte projet.
- `aria-label` présents sur la plupart des contrôles icône, `label.sr-only` sur la zone de question,
  `<summary>` natif pour les sources : la base sémantique est saine (cf. `accessibility.md › Vision`).
- `send.disabled` pendant l'envoi, `input.focus()` après réponse, `Enter`/`Maj+Entrée` gérés :
  le clavier est déjà pensé (`keyboards.md › Best practices`).
- Contraste du texte principal excellent (14,21:1 clair, 15,75:1 sombre) : la palette de base est bonne,
  les échecs sont localisés (accent en sombre, placeholder, avatars).

## Trade-offs assumés

1. **Sélecteur d'apparence.** `dark-mode.md › Best practices` demande d'**éviter** un réglage
   d'apparence propre à l'application. La consigne produit demande un mode clair/sombre. Résolution :
   le défaut suit `prefers-color-scheme` (aucun réglage à faire), et le bouton devient un choix
   explicite à trois états dont « Système » est la valeur par défaut. On respecte le système sans
   retirer le contrôle (principe *Agency*).
2. **Verre sur le composeur.** `liquid-glass.md` autorise le verre sur la *couche fonctionnelle*
   flottante, ce qui est le cas du composeur fixe, mais demande un repli opaque
   (`Reduce Transparency`) et de la retenue. Conservé, avec repli et halos décoratifs supprimés.
3. **Numérotation des sources sans marqueur dans le texte.** Le backend ne renvoie pas d'ancrage
   phrase→extrait ; injecter des `[1]` serait une citation inventée. La numérotation reste donc
   au niveau de la liste.

## Références du skill réellement lues

`SKILL.md` (entier, 422 lignes) · `references/hig-lookup.md` · `references/cross-platform.md` ·
`references/code-audit.md` (survol) · always-load : `references/hig/accessibility.md`,
`layout.md`, `typography.md`, `color.md`, `designing-for-macos.md` (conventions de bureau, pour
savoir ce qui **ne** s'applique pas au web) · ciblés : `references/hig/buttons.md`,
`text-fields.md`, `loading.md`, `feedback.md`, `progress-indicators.md`, `dark-mode.md`,
`motion.md`, `focus-and-selection.md`, `keyboards.md`, `sidebars.md`, `writing.md`,
`generative-ai.md`, `liquid-glass.md`.

Soit 19 fichiers, au-delà des « 8 to 12 files per review » recommandés par
`SKILL.md › The references` : le périmètre imposé (accessibilité, états, RAG, responsive) couvrait
plus de zones que le budget prévu. Écart signalé, non dissimulé.
