# Phase 3 — Direction artistique

Applique le « Design improvement mode » du contrôleur (`apple-design-review/SKILL.md ›
Design improvement mode`) et la couche de jetons du constructeur
(`apple-design-web/references/tokens.md`).

## 1. Ancrage dans le sujet

| Question du skill | Réponse |
| --- | --- |
| Produit | Assistant documentaire interne francophone (RAG) sur corpus d'entreprise |
| Audience | Salariés, intranet, bureau (clavier/souris) et mobile |
| Travail de l'écran | Poser une question et **vérifier la réponse dans un document** |
| Matériaux du sujet | Le papier, la chemise cartonnée, l'onglet de dossier, la note de bas de page, la tranche d'un document relié |
| Ce que la capture fournie montre | Un chat plat, sans chrome, sans profondeur : lisible mais sans matière |

## 2. Jetons (plan compact)

### Couleur — 8 valeurs nommées, avec variantes

| Rôle | Clair | Sombre | Usage |
| --- | --- | --- | --- |
| surface | `#FFFFFF` | `#1C1C1E` | cartes, messages, feuille |
| fond | `#F5F5F7` | `#000000` | fond de page, dégradé |
| encre | `#1D1D1F` | `#F5F5F7` | texte principal — 15,46:1 / 15,63:1 |
| encre secondaire | `#6E6E73` | `#98989D` | texte secondaire — 5,07:1 / 5,93:1 |
| accent | `#0066CC` | `#0A84FF` | liens, icônes, jauges — 5,57:1 / 4,66:1 |
| accent plein | `#0066CC` | `#0066CC` | boutons pleins, **blanc dessus = 5,57:1** |
| alerte | `#D70015` | `#FF453A` | erreurs — 5,38:1 / 4,99:1 |
| état | `#248A3D` | `#30D158` | pastille de santé (non textuel, ≥ 3:1) |

Interdits respectés : `#86868B` (3,62:1) n'est **jamais** utilisé pour du texte ; le blanc sur
`#0A84FF` (3,65:1) n'est utilisé que pour une **icône** (seuil non textuel 3:1), jamais pour du
texte sous 18 px. Conséquence assumée : le bouton plein garde `#0066CC` dans les deux apparences
plutôt que `#0A84FF`, pour que son libellé blanc reste à 5,57:1.

### Typographie — échelle SF du constructeur (`tokens.css`)

`large-title` 34 px / `title-1` 28 / `title-2` 22 / `title-3` 20 / `headline` 17 semibold /
`body` 17 / `callout` 16 / `subhead` 15 / `footnote` 13 / `caption` 12.
Tracking **par taille** : `-0.022em` (display) → `-0.014em` (titres) → `0` (corps) → `+0.01em`
(petit). Leading **inverse** : 1.05 (titres) → 1.35 (corps) → 1.5 (lecture longue).
`font-optical-sizing: auto` activé (typography.md §1).

### Grille, rayons, profondeur

- Espacements : grille 4/8 pt du constructeur (`--space-1..12`).
- Rayons : **10 / 14 / 20 / 28 / capsule** (demande explicite + `tokens.md › Continuous corners`).
- Ombres : deux couches, `--shadow-1..4` + `--shadow-glass`.
- Bordures : filet translucide 0,5 px + reflet supérieur 1 px sur le verre.

### Mouvement

| Surface | Type | Valeur | Source |
| --- | --- | --- | --- |
| Feuille, tiroir | ressort, glissable | damping 0,8 / response 0,3 | `motion-physics.md › Apple's actual ship values` |
| Apparition de message | ressort critique | bounce 0 / 350 ms équivalent | idem, « default to critically damped » |
| Pression bouton | immédiat | `scale(0.97)`, 100 ms, `--ease-out` | `motion-physics.md §4` |
| Appui sur source | immédiat | idem | idem |

Implémentation **sans dépendance** : `linear()` CSS généré depuis l'équation du ressort pour la
feuille + Web Animations API pour le glissement 1:1 (Pointer Events, bande de caoutchouc,
vitesse de relâchement, projection d'élan) — cf. `motion-physics.md §3–§7`.

## 3. Gabarits

### Desktop 1440

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ░verre░  ◈ Assistant documentaire        ● Service prêt   ⌚ Historique  ＋  │  rayon 28, marge 16
├────────────────────────────────────────────────────────────────────────────┤
│                     ┌────────────── 720 px ──────────────┐                  │
│                     │ Comment puis-je vous aider ?       │  large-title 34  │
│                     │ Réponses sourcées, documents…      │  body 17 secund. │
│                     │ ┌────────────┐ ┌────────────┐      │  cartes r=20     │
│                     │ │ ▣ Congés   │ │ ▣ Internet │      │  2×2, gouttière  │
│                     │ └────────────┘ └────────────┘      │  16 px           │
│                     │ ┌────────────┐ ┌────────────┐      │                  │
│                     │ │ ▣ Télétrav.│ │ ▣ Dépenses │      │                  │
│                     │ └────────────┘ └────────────┘      │                  │
│                     └───────────────────────────────────┘                  │
│  ░verre capsule░  Votre question…                              ( ↑ )        │  ancrée en bas
└────────────────────────────────────────────────────────────────────────────┘
```

### Mobile 390

```
┌──────────────────────────┐
│ ░verre░ ◈      ●     ⌚ ＋ │  barre 56, marge 8
├──────────────────────────┤
│  Comment puis-je         │  title-1 28
│  vous aider ?            │
│  Réponses sourcées…      │  15 secund.
│  ┌────────────────────┐  │
│  │ ▣ Congés           │  │  1 colonne, r=20
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ ▣ Internet         │  │
│  └────────────────────┘  │
│  ░verre capsule░    ( ↑ ) │
└──────────────────────────┘
```

### Conversation + preuve

```
bulle utilisateur à droite (accent plein, rayon 20, 17 px)
réponse : aucun cadre, 17 px, 68 ch max
──── rail de preuve (défilement horizontal) ────────────────────
┌──────────────┐┌──────────────┐┌──────────────┐
│▏RH           ││▏RH           ││▏IT           │   ▏ = tranche teintée
│▏conges.pdf   ││▏teletravail  ││▏charte.pdf   │
│▏▁▁▁▁▁▁▁ 82 % ││▏▁▁▁▁ 61 %    ││▏▁▁ 48 %      │   jauge fine = pertinence
└──────────────┘└──────────────┘└──────────────┘
clic → feuille en verre (poignée, glisser, Échap) → GET /api/sources/{id}
```

## 4. Élément signature

**« La preuve sort du document »** : sous chaque réponse, une rangée de cartes-documents dont le
bord gauche porte une **tranche** teintée, et dont la pertinence est une **jauge filaire** qui
part de cette tranche. Cliquer fait **glisser le document hors de la pile** dans une feuille en
verre qui se lit comme une page.

Pourquoi ce produit et pas un autre : la valeur d'un assistant documentaire n'est pas la réponse,
c'est la **vérifiabilité**. La tranche et la jauge rendent la provenance tangible ; un chat
générique n'aurait ni tranche, ni jauge, ni feuille de lecture.

## 5. Critique du plan — « serait-il identique pour un autre produit ? »

Oui, sur trois points. Révisions :

1. **Fond « aurora » multicolore** (dégradés violet/bleu/rose derrière le verre) : c'est le cliché
   « produit IA ». → Remplacé par **un seul lavis bleu-gris** à deux arrêts, très basse opacité,
   qui donne au verre des variations de luminance sans arc-en-ciel.
2. **Cartes d'exemple avec pictogrammes colorés** : génériques. → Pictogrammes **monochromes**
   dans une pastille teintée d'accent, un par carte ; pas de dégradé, pas d'emoji.
3. **Avatars ronds avec initiale** : marqueur de chat template. → **Supprimés** ; l'auteur est
   nommé une fois par groupe de messages (`writing.md › Best practices`, hiérarchie par poids).
4. Ce qui reste : la tranche + la jauge + la feuille. Conservé, c'est le point de vue.

Restraint (dernier contrôle du skill : « remove one accessory ») : la pastille de santé serait
supprimable — gardée parce que le backend renvoie réellement `degraded` et que `feedback.md`
demande d'intégrer l'état à l'interface plutôt qu'aux alertes. Rien d'autre à retirer.
