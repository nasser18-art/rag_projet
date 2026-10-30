# Consignes projet pour les assistants de code

## Règle UI : lire le skill Apple Design avant toute modification d'interface

Le skill **apple-design** est versionné dans ce dépôt sous forme de sous-module Git :

- dépôt : `.design-rules/` → https://github.com/dickwu/apple-design-skill
- point d'entrée du skill : `.design-rules/SKILL.md`
- miroir chargeable par les agents : `.claude/skills/apple-design` → `../../.design-rules`

**Avant toute modification du frontend (`frontend/*.html`, `*.css`, `*.js`), ou pour tout audit,
revue ou critique d'UI :**

1. Lire `.design-rules/SKILL.md` en entier — ne pas se fier à une version résumée ou mémorisée.
2. Suivre ses instructions de chargement : la « always-load set »
   (`references/hig/accessibility.md`, `layout.md`, `typography.md`, `color.md`,
   `designing-for-ios.md` ou `designing-for-macos.md`), plus `references/cross-platform.md`
   car ce frontend est du HTML/CSS/JS et non SwiftUI/UIKit/AppKit.
3. Puis charger 3 à 6 fichiers de `references/hig/` selon ce qui est à l'écran, en utilisant les
   tables « Load by what is on screen » du `SKILL.md`.
4. Citer fichier + section (`typography.md › Dynamic Type sizes`), jamais une règle approximative.

Contrainte de lecture : le skill demande de ne charger que **8 à 12 fichiers** par revue, pas tout
le répertoire.

## Si le sous-module n'est pas présent

```sh
git submodule update --init --recursive
```

Sans cette commande, `.claude/skills/apple-design` est un lien cassé et le skill n'est pas lisible.

## Contexte du produit (pour le skill, section « Step 1: Establish context »)

- Plateforme : application web (navigateur), bureau et mobile, pas une app native Apple.
  Le skill indique explicitement qu'une app web n'hérite que des principes et des fondations
  (accessibilité, couleur, typographie, mise en page, écriture), pas des conventions de plateforme
  Apple — cf. `SKILL.md › Review process › Step 1 › Scope and limits`.
- Framework : HTML, CSS et JavaScript vanilla. Aucun framework, aucune dépendance, aucun build step.
- Catégorie : assistant documentaire interne (RAG) francophone, usage intranet.
- Contrainte : ne pas modifier le backend FastAPI ni les routes ; ne pas renommer les IDs et
  classes utilisés par `frontend/app.js` sans mettre à jour le JavaScript dans le même commit.

## Règles de code du projet

- CSS centralisé dans des tokens (`:root` / `html[data-theme="dark"]`) de `frontend/styles.css`.
- Tout nouveau style passe par un token : pas de couleur, d'espacement, de rayon, d'ombre ou de
  durée codés en dur dans une règle de composant.
- Respecter `prefers-reduced-motion`, `prefers-reduced-transparency` et `prefers-color-scheme`.
- Un commit par thème de travail (tokens, typographie, composants, accessibilité, etc.).
