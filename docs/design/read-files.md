# Fichiers réellement lus dans les deux skills

Deux dépôts, non modifiés, ajoutés en sous-modules sous des noms distincts (Windows, aucun lien symbolique) :

| Rôle | Chemin dans le dépôt | Source | Commit épinglé |
|---|---|---|---|
| Constructeur | `.claude/skills/apple-design-web/` | `https://github.com/bowen31337/apple-design` | `c95fa1324ca371d7a8df9564ce8a03ff4bed5465` |
| Contrôleur | `.claude/skills/apple-design-review/` | `https://github.com/dickwu/apple-design-skill` | `ff4ebddf0488598723a82bfdce1afb04de0b1c44` |

Le contrôleur déclare lui-même `name: apple-design` dans son `SKILL.md`, d'où deux répertoires au nom distinct. Un troisième sous-module plus ancien (`.design-rules`) pointe le même dépôt contrôleur : il est conservé et son histoire est documentée dans `CLAUDE.md`, pas effacé.

## Constructeur — `apple-design-web`

Chargement suivi selon son propre tableau de routage (`SKILL.md` › *Loading table*).

| Fichier | Sections lues | Ce qui a été retenu |
|---|---|---|
| `SKILL.md` | tout | La thèse « objet physique sous une vitre » ; les 4 pièges ; les non-négociables d'accessibilité |
| `references/tokens.md` | *Layer structure*, *Naming*, *Continuous corners*, *Why two-layer shadows*, *Extending the layer* | La couche de jetons comme source unique ; squircle ; ombres à deux couches ; retint par `--accent` |
| `assets/tokens.css` | tout | Vocabulaire et forme des jetons (`--label-secondary`, `--material-*`, `--accent-fill`) |
| `references/liquid-glass.md` | *The mental model*, *Recipe 1 · The four effects*, *Thickness*, *Animating materials*, *Accessibility & fallbacks* | Teinte + `blur() saturate()` + reflet spéculaire + filet ; valeurs de flou ; liste de replis |
| `references/motion-physics.md` | *Damping & response*, *Interruptibility*, *Dragging (1:1)*, *Momentum projection*, *Rubber banding*, *Reduced motion* | Ressort feuille 0,8 / 0,3 ; suivi 1:1 au pointeur ; `project()` ; `rubberBand()` ; seuil de rejet |
| `references/typography.md` | §1 optical sizing, §2 tracking, §3 leading, §4 hierarchy as a set | Quatre niveaux de tracking ; leading inverse ; 700 réservé aux grands titres |
| `references/components.md` | *Buttons*, *Glass nav*, *Bottom sheet*, *Checklist*, *Toast* | Capsule, `:active scale(.97)`, anneau de focus 2 px décalé de 2 px, poignée 36×5, scrim, fermeture au-delà de la moitié |
| `demos/index.html` | lignes 1–120 | Structure d'une démo de matériau : couche flottante au-dessus d'un contenu opaque |

Non lus volontairement : `references/motion-dev.md` et `references/gsap.md` (spécifiques à Motion/GSAP, interdits par le brief).

## Contrôleur — `apple-design-review`

Groupe « Always load » de son `SKILL.md`, plus les fiches convoquées par la revue.

| Fichier | Sections lues | Ce qui a été retenu |
|---|---|---|
| `SKILL.md` | tout | Mode « Design improvement mode » : palette nommée avec ratios, échelle typographique, wireframe, élément signature, auto-critique ; citer `fichier.md › Titre` |
| `accessibility.md` | *Vision*, *Mobility*, *Speech*, *Best practices* | 44 pt, 4,5:1 jusqu'à 17 pt, 3:1 au-delà ou en gras ; ne jamais coder l'information par la couleur seule |
| `layout.md` | *Visual hierarchy*, *Spacing*, *Progressive disclosure* | Différencier les contrôles du contenu ; hiérarchie avant décoration |
| `typography.md` | *Sizes*, *Line length*, *Best practices* | 17 pt corps, 11 pt minimum, mesure de lecture |
| `color.md` | *Semantic colours*, *Best practices* | Couleurs sémantiques, contraste avant esthétique |
| `materials.md` | *Liquid Glass*, *Standard materials* | Verre réservé aux couches flottantes ; matériaux standard pour le contenu |
| `motion.md` | *Durations*, *Easing*, *Best practices* | 200–450 ms, jamais sur la frappe |
| `loading.md` | *Best practices* | Montrer une forme dès que possible (squelettes) |
| `writing.md` | *Error messages*, *Empty states*, *Best practices* | Dire quoi faire, pas seulement ce qui a échoué |
| `feedback.md` | *Best practices* | Retour sur l'appui, état du système visible, annonces accessibles |
| `dark-mode.md` | *Best practices* | Ne pas proposer de réglage d'apparence propre à l'app |

## Citation

Chaque décision du code renvoie à un fichier **et** un titre de section de ces listes. Les références apparaissent en commentaire au-dessus de la règle CSS ou JS concernée, et dans `docs/design/rapport-final.md`.
