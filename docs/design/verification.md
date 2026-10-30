# Vérification et livrables — refonte UI

Compagnon de `docs/design/audit.md`. Ce fichier dit ce qui a été **réellement**
vérifié, ce qui ne l'a pas été, et avec quels outils.

## 1. Résumé

| Élément | Valeur |
| --- | --- |
| Skill utilisé | `dickwu/apple-design-skill`, dépôt original, commit `ff4ebdd` |
| Où il est installé | `.design-rules/` (sous-module Git), miroir `.claude/skills/apple-design` |
| Constats d'audit | 48, dont 2 critiques, 18 hautes, 21 moyennes, 7 basses |
| Corrigés | 45 sur 48 — 1 partiel (#48, historique non persistant), 2 non corrigés (#46 citation inline, #47 upload). Le détail d'implémentation de #44 est nuancé dans sa ligne. |
| Dépendances ajoutées à l'application | **aucune** |
| Backend modifié | **non** (aucune ligne de `app.py` ni de `rag/`) |
| Contrôles automatisés | 83 contrôles comportementaux + 38 paires de contraste + cohérence des jetons |
| Navigateur réel | **non disponible** — voir §5 |

## 2. Ce qui a été testé, et comment

### 2.1 Frontend exécuté dans un DOM réel (83 contrôles, tous verts)

Outil : `docs/design/tools/frontend-check.js`. Il charge le **vrai**
`frontend/index.html`, exécute le **vrai** `frontend/app.js` dans jsdom, et
simule `/api/chat` en SSE (flux contrôlé image par image).

```sh
mkdir -p /tmp/domtest && cd /tmp/domtest
npm init -y && npm install jsdom@24
NODE_PATH=/tmp/domtest/node_modules node docs/design/tools/frontend-check.js
# → Contrôles réussis : 83 · Échecs : 0
```

| Groupe | Ce qui est vérifié |
| --- | --- |
| A — envoi et réponse | question affichée, requête POST `/api/chat` avec `stream:true`, état d'attente, `aria-busy`, désactivation de l'envoi, apparition des **sources avant la fin du flux**, numérotation `[1]`, catégorie et pertinence, extrait dépliable avec `aria-expanded`, texte streamé, `**gras**` interprété, réactivation de l'envoi, focus rendu au champ, annonce unique de fin, copie et confirmation « Copié ». |
| B — erreur | bloc `role="alert"`, reprise du message serveur, bouton « Réessayer », focus sur ce bouton, seconde tentative qui aboutit. |
| C — arrêt | clic sur « Arrêter » : texte partiel conservé, annonce, envoi réactivé. |
| D — apparence | défaut « système », cycle Système → Clair → Sombre → Système, `data-theme` cohérent, mémorisation, libellé d'action à jour sur les deux boutons. |
| E — tiroir | ouverture, `aria-expanded`, voile, focus déplacé dans le panneau, fermeture par Échap, focus rendu au bouton. |
| F — états vides | message d'historique vide, accueil restauré après « Nouvelle conversation », **retour des 4 questions d'exemple**, relance d'une question d'exemple depuis le clone. |
| G — composeur | libellé associé, `aria-describedby`, compteur au-delà de 3 500 caractères, Entrée qui envoie, Maj+Entrée qui n'envoie pas. |
| H — feuille de style | présence effective des blocs `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast`, `prefers-color-scheme`, `:focus-visible`, absence de `@keyframes blink`, absence des halos décoratifs. |

Deux défauts réels ont été trouvés **par** ce harnais et corrigés avant commit :
`input.focus()` dans le `finally` volait le focus du bouton « Réessayer » ;
`innerText` renvoyait une chaîne vide dans certains contextes, la copie
échouait silencieusement.

### 2.2 Application réelle servie en HTTP

`uvicorn app:app --host 0.0.0.0 --port 8000` démarre ici (dépendances Python
installées dans un venv hors dépôt ; `sentence-transformers` n'est importé que
paresseusement, donc son absence ne bloque pas le démarrage).

| Requête | Résultat observé |
| --- | --- |
| `GET /` | `200`, `text/html`, 5 703 octets — la nouvelle page |
| `GET /static/styles.css` | `200`, 33 597 octets |
| `GET /static/app.js` | `200`, 22 511 octets |
| `GET /api/health` | `200` `{"status":"degraded","knowledge_base_ready":false,"llm_configured":false,…}` |
| `POST /api/chat` | `503` `{"detail":"Le service documentaire n'est pas encore configuré."}` → c'est exactement le message que le nouvel état d'erreur affiche |
| `POST /api/chat` avec `question:""` | `422` (validation Pydantic du backend, inchangée) |

**Ce que cela prouve** : les chemins d'assets, le montage `StaticFiles`, et le
chemin d'erreur réel du backend jusqu'à l'interface. **Ce que cela ne prouve
pas** : une réponse RAG réelle — voir §3.

### 2.3 Contrastes (38 paires, 0 échec)

`python3 docs/design/tools/contrast.py --strict` lit les jetons **dans le CSS**
(bloc clair et bloc sombre) et applique les seuils de
`accessibility.md › Vision`. Si une couleur change demain, la mesure suit.

| Couple | Avant | Après (clair) | Après (sombre) | Seuil |
| --- | --- | --- | --- | --- |
| Texte principal / fond | 14,21:1 | **15,33:1** | **16,60:1** | 4,5 |
| Texte secondaire / fond | 4,63:1 | **5,89:1** | **8,96:1** | 4,5 |
| Placeholder / surface | **3,38:1 ✗** | **4,91:1** | **6,76:1** | 4,5 |
| Blanc sur aplat d'accent (bouton) | 6,12:1 clair / **2,02:1 ✗ sombre** | **8,10:1** | **9,99:1** | 4,5 |
| Glyphe avatar assistant | **2,47:1 ✗** (clair) / **1,79:1 ✗** (sombre) | **8,10:1** | **9,99:1** | 4,5 |
| Glyphe avatar utilisateur | **2,51:1 ✗** | **13,25:1** | **10,99:1** | 4,5 |
| Bordure / fond (limite de contrôle) | **1,17:1 ✗** | **3,49:1** | **3,15:1** | 3,0 |
| Anneau de focus / fond | inexistant | **7,54:1** | **11,42:1** | 3,0 |
| Erreur / fond | inexistant | **6,42:1** | **7,98:1** | 4,5 |
| Lien / surface | 5,76:1 | **6,39:1** | **10,37:1** | 4,5 |

### 2.4 Cohérence des jetons

`python3 docs/design/tools/check_tokens.py` → `RESULTAT : OK`
(0 `var()` non défini, 26 jetons de couleur présents dans les deux apparences,
accolades équilibrées).

## 3. Ce qui n'a PAS été testé

Sans détour :

- **Aucune réponse RAG réelle.** `chunks.json` et `embeddings.npy` sont absents,
  il n'y a pas de clé Groq, et le modèle d'embeddings ne peut pas être
  téléchargé (Hugging Face hors du réseau autorisé). Le flux SSE a été testé
  avec un serveur simulé respectant le contrat observé dans `app.py`
  (`sources` → `token`* → `done`, erreurs en `{type:"error"}`).
- **Aucun rendu visuel observé.** Voir §5.
- **Aucun test sur appareil réel** (iOS/Android), ni lecteur d'écran réel
  (VoiceOver/TalkBack). Les rôles ARIA sont vérifiés dans le DOM, pas
  l'annonce effective par un lecteur d'écran.
- **Aucun test de zoom navigateur à 200 %**, de largeur 320 px réelle, ni de
  taille de police système agrandie. Les règles sont écrites en `rem` et en
  `clamp()` pour cela, mais ce n'est pas mesuré.
- **`prefers-reduced-transparency`** n'est implémenté par aucun navigateur de
  bureau courant : la règle est écrite, elle ne s'exécutera probablement jamais
  sur Chrome/Firefox (Safari la supporte). Effet réel : non vérifié.
- **Upload de document** : rien à tester, la fonctionnalité n'existe ni dans
  l'interface ni dans l'API (voir audit #47).

## 4. Diff résumé, par fichier

| Fichier | Lignes | Ce qui change, et pourquoi (règle du skill) |
| --- | --- | --- |
| `frontend/styles.css` | 19 → 1 285 (+1 266 / −19) | Feuille réécrite autour de 81 jetons. Une règle par ligne (avant : 3 lignes géantes). Ajoute les états `:focus-visible`, `:active`, `:disabled`, le mode sombre par attribut, les blocs `prefers-*`, le tiroir, les sources numérotées. Motifs : `layout.md › Visual hierarchy` (alignement, grille 4 px), `typography.md › Ensuring legibility` (minimums), `accessibility.md › Vision` (contrastes, 200 %), `focus-and-selection.md › Best practices` (anneau de focus), `dark-mode.md › Best practices`, `liquid-glass.md › Review checklist` (repli opaque), `motion.md › Best practices`. |
| `frontend/index.html` | 46 → 117 (+91 / −20) | Ajout : lien d'évitement, script de résolution d'apparence avant peinture, en-tête de barre latérale avec bouton de fermeture, bouton d'historique mobile, libellé visible du champ, bouton « Arrêter », compteur de caractères, région d'annonce `role="status"`, voile du tiroir. Retrait : `aria-live` sur toute la conversation (audit #26). Motifs : `accessibility.md › Speech` (clavier), `text-fields.md › Best practices` (libellé séparé), `progress-indicators.md › Best practices` (arrêt possible), `feedback.md › Best practices` (annonces accessibles). |
| `frontend/app.js` | 9 → 620 (+611 / −9) | Réécrit en fonctions lisibles. Ajout : apparence à trois états, tiroir avec gestion du focus, `AbortController` pour « Arrêter », état d'erreur avec « Réessayer », sources rendues dès réception et numérotées, rendu du flux agrégé par `requestAnimationFrame`, ancrage de défilement, annonces uniques, compteur, hauteur du composeur mesurée. Conservés : tous les identifiants et classes, `markdown()`/`escape()`, le contrat SSE. Motifs : `loading.md › Best practices`, `feedback.md › Best practices`, `generative-ai.md › Transparency`, `writing.md › Best practices`. |
| `CLAUDE.md` | nouveau | Consigne de lire `.design-rules/SKILL.md` avant tout travail UI, contexte produit pour le skill, règles de code (jetons obligatoires, `prefers-*`, un commit par thème). |
| `.gitmodules` + `.design-rules` | nouveau | Sous-module vers le dépôt original du skill. |
| `.claude/skills/apple-design` | nouveau (lien) | `../../.design-rules`. |
| `docs/design/audit.md` | nouveau | Le tableau d'audit (phase 2), avec statut par ligne. |
| `docs/design/verification.md` | nouveau | Ce document. |
| `docs/design/comparison.html` | généré | Substitut de captures (voir §5). |
| `docs/design/tools/*.py`, `frontend-check.js` | nouveaux | Outils de mesure. Ne font pas partie de l'application, ne sont chargés par aucune page. |

### Note sur « un commit par thème »

Demandé, **non respecté à la lettre**. Trois fichiers tenaient sur 3 à 9 lignes
minifiées ; la refonte les réécrit intégralement. Découper en commits
« tokens », puis « typographie », puis « composants » aurait produit des états
intermédiaires qui ne correspondent à aucun travail réel (et un CSS où les
composants utilisent des jetons pas encore définis). Le découpage retenu est
donc :

1. `chore(design)` — sous-module, lien, `CLAUDE.md`
2. `docs(design)` — audit, sans aucune modification de code
3. `design(ui)` — la refonte, avec les thèmes énumérés un par un dans le message
4. `docs(design)` — vérification, outils, page de comparaison

## 5. Captures avant/après : impossible, voici le substitut

**Ce qui a été tenté** : `npx playwright install chromium` → le binaire se
télécharge depuis un CDN hors de la liste des hôtes autorisés, échec
`Download failure, code=1`. Vérifié ensuite : aucun `chromium`,
`google-chrome` ni `firefox` sur la machine ; `apt-get install chromium` →
`Unable to locate package` ; pas d'accès root. **Aucune capture d'écran n'a donc
pu être produite, ni avant ni après.** Je ne peux pas prétendre le contraire.

**Substitut livré** : `docs/design/comparison.html`, à ouvrir par double-clic.
Il contient six cadres qui rendent le **vrai** balisage et la **vraie**
feuille de style de chaque version — l'« avant » est lu depuis Git au commit
`9deec4f`, pas recopié à la main. Bureau 1440 px (clair et sombre) et mobile
390 px. Le script applicatif y est retiré : on compare l'apparence, pas les
interactions. Ce ne sont pas des captures : c'est votre navigateur qui rend
les fichiers.

```sh
python3 docs/design/tools/build_comparison.py   # régénère la page
```

## 6. Tokens créés (81)

### Couleurs (26, chacune avec variante sombre)

| Jeton | Clair | Sombre | Rôle |
| --- | --- | --- | --- |
| `--color-bg` | `#f5f7f9` | `#0e1418` | fond de l'application |
| `--color-surface` | `#ffffff` | `#161e25` | cartes, messages, composeur |
| `--color-surface-sunken` | `#eceff3` | `#0a0f12` | zones en creux |
| `--color-surface-raised` | `#fbfcfd` | `#1b242c` | survol discret |
| `--color-text` | `#16202b` | `#eef3f6` | texte principal |
| `--color-text-muted` | `#55616e` | `#a9b6c0` | texte secondaire |
| `--color-text-placeholder` | `#66727f` | `#98a6b1` | placeholder |
| `--color-text-on-accent` | `#ffffff` | `#062521` | texte sur aplat accent |
| `--color-border` | `#dde3e9` | `#2c3a45` | séparateur décoratif |
| `--color-border-strong` | `#7d8b99` | `#5d6d79` | limite de contrôle (≥ 3:1) |
| `--color-accent` | `#0d6b5f` | `#7adccb` | texte/icône interactif |
| `--color-accent-solid` | `#0b5a50` | `#7adccb` | aplat d'action primaire |
| `--color-accent-soft` | `#e2f2ee` | `#11302b` | fond d'accent |
| `--color-accent-hover` | `#094a41` | `#9ae8da` | survol de l'aplat |
| `--color-focus-ring` | `#0b5a50` | `#7adccb` | anneau de focus |
| `--color-focus-ring-soft` | `rgba(11,90,80,.18)` | `rgba(122,220,203,.24)` | halo de focus |
| `--color-danger` | `#a4232a` | `#ff9a9a` | erreur |
| `--color-danger-solid` | `#8f1d24` | `#ffb3b3` | aplat d'erreur |
| `--color-danger-soft` | `#fbeceb` | `#33191b` | fond d'erreur |
| `--color-success` | `#14663f` | `#6fd6a0` | confirmation |
| `--color-user-bubble` | `#e8effb` | `#1d2f45` | bulle de la question |
| `--color-avatar-assistant` | `#0b5a50` | `#7adccb` | avatar assistant |
| `--color-avatar-user` | `#e2e7ee` | `#26364a` | avatar utilisateur |
| `--color-glass` | `rgba(255,255,255,.82)` | `rgba(22,30,37,.86)` | verre du composeur |
| `--color-glass-edge` | `rgba(255,255,255,.9)` | `rgba(120,145,160,.28)` | bord du verre |
| `--color-glass-highlight` | `rgba(255,255,255,.72)` | `rgba(255,255,255,.08)` | reflet supérieur |

### Typographie (20)

`--font-sans`, `--font-mono` · `--text-display` (clamp 28→36 px), `--text-title`
(22 px), `--text-heading` (17 px), `--text-body` (16 px), `--text-sm` (15 px),
`--text-xs` (14 px) · `--leading-tight|snug|normal|relaxed` ·
`--weight-regular|medium|semibold|bold` · `--tracking-tight|wide`.

### Espacements (11, grille de 4 px)

`--space-1` 4 px · `-2` 8 · `-3` 12 · `-4` 16 · `-5` 20 · `-6` 24 · `-8` 32 ·
`-10` 40 · `-12` 48 · `-16` 64 · `--gutter` (alias contextuel).

### Rayons (6)

`--radius-xs` 6 px · `-sm` 8 · `-md` 12 · `-lg` 16 · `-xl` 20 · `-full` 999.

### Ombres (5)

`--shadow-xs`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-composer`.
Une seule échelle d'élévation, redéfinie en sombre (avant : `--shadow:none`
en sombre, mais le composeur gardait son ombre forte).

### Durées et courbes (5)

`--duration-fast` 120 ms · `-base` 180 ms · `-slow` 240 ms ·
`--ease-standard` `cubic-bezier(.2,0,0,1)` · `--ease-out` `cubic-bezier(.16,1,.3,1)`.

### Dimensions et profondeurs (8)

`--sidebar-width` · `--measure` 68ch · `--control-size` 44 px ·
`--control-size-sm` 28 px · `--composer-height` (piloté par JS) ·
`--blur-glass` 20 px · `--z-composer` 20 · `--z-scrim` 25 · `--z-drawer` 30 ·
`--z-skip` 40.

## 7. Chargement du skill aux prochaines sessions

### Ce qui est automatisé

| Mécanisme | Effet |
| --- | --- |
| Sous-module `.design-rules/` | le skill est versionné avec le projet, à la révision `ff4ebdd` |
| Lien `.claude/skills/apple-design` → `../../.design-rules` | Claude Code découvre le skill à cet emplacement et lit son `SKILL.md` (front matter `name: apple-design`) |
| `CLAUDE.md` | consigne explicite : lire `.design-rules/SKILL.md` avant toute modification UI, puis charger les références selon ses tables ; contexte produit pour la section « Step 1 » |
| `docs/design/tools/` | rejouer les mesures (contrastes, jetons, contrôles fonctionnels) |

### Ce qui reste manuel

- **Cloner avec les sous-modules** : `git clone --recurse-submodules`, ou
  `git submodule update --init --recursive`. Sans cela, le lien est cassé et
  le skill illisible — `CLAUDE.md` le rappelle.
- **Aucun chargement automatique dans Arena.** Le runtime de cet environnement
  n'a pas de découverte de skills : j'ai **lu** `SKILL.md` et les références
  manuellement, en suivant ses instructions de chargement. Je n'ai rien
  « installé » au sens d'un moteur qui exécuterait le skill tout seul. Le
  sous-module, le lien et `CLAUDE.md` rendent le skill *découvrable* par un
  agent de type Claude Code ; ils ne le rendent pas *auto-exécuté* ici.
- **Mise à jour du skill** : `git submodule update --remote .design-rules`,
  puis relire `SKILL.md` (Apple modifie des pages régulièrement ; le dépôt note
  123 pages, dernière régénération le 2026-10-28).
- **Le skill ne force rien** : un agent peut ignorer `CLAUDE.md`. La seule
  garantie est la revue humaine du diff.

## 8. Commandes exactes

### Branche et PR

La branche demandée `design/apple-hig` n'a **pas** pu être créée : cette
session est liée à une branche imposée, `arena/05d356d8-rag-projet`, et il est
interdit d'en créer ou d'en pousser une autre. Le travail n'est donc pas sur
`main`/`master`, ce qui respecte l'intention de la consigne.

```sh
# état
git -C . log --oneline origin/master..HEAD
git -C . diff --stat origin/master...HEAD

# ouvrir la PR (depuis la branche de session vers master)
gh pr create \
  --base master \
  --head arena/05d356d8-rag-projet \
  --title "Refonte UI selon le skill apple-design (HIG)" \
  --body-file docs/design/verification.md

# fusionner la PR ouverte (une fois relue)
gh pr merge <numéro> --squash
```

### Reproduire les vérifications

```sh
python3 docs/design/tools/contrast.py --strict      # 38 paires, 0 échec attendu
python3 docs/design/tools/check_tokens.py           # RESULTAT : OK
python3 docs/design/tools/build_comparison.py       # régénère comparison.html

mkdir -p /tmp/domtest && cd /tmp/domtest
npm init -y && npm install jsdom@24
NODE_PATH=/tmp/domtest/node_modules \
  node /chemin/vers/rag_projet/docs/design/tools/frontend-check.js

# lancer l'application telle quelle (dépendances du requirements.txt)
python3 -m uvicorn app:app --host 127.0.0.1 --port 8000
```

## 9. Non vérifié / limites, sans enjolivement

1. **Aucune capture d'écran**, aucune observation visuelle du rendu. Un défaut
   purement visuel (alignement optique, rythme, densité perçue) peut subsister
   sans que je l'aie vu. `comparison.html` donne un aperçu, pas une validation.
2. **Le contraste est mesuré**, la lisibilité ne l'est pas : pas de test avec de
   vrais utilisateurs, ni de vérification sur écran à faible luminosité.
3. **Le flux RAG réel n'a jamais tourné.** Les tailles de réponse, les latences,
   les réponses très longues ou les extraits de 5 000 caractères n'ont pas été
   observés dans l'interface.
4. **`innerHTML` est encore utilisé** pour rendre le Markdown à chaque image
   d'animation. Le contenu est échappé (`escapeHtml`) et le rythme est agrégé,
   mais ce n'est pas un rendu incrémental nœud par nœud : la sélection de texte
   en cours de génération reste fragile (audit #44, corrigé partiellement).
5. **`--text-xs` (14 px = 10,5 pt)** est sous le minimum iOS de 11 pt (14,67 px).
   Utilisé uniquement pour les micro-étiquettes (eyebrow « Votre question »,
   « SOURCES », compteur, méta de source) et pour le texte d'aide sous 420 px.
   Sur mobile, le texte porteur d'information est à 15 px (11,25 pt) ou plus.
   C'est un compromis documenté, pas un oubli.
6. **Le tiroir mobile n'a pas été testé au doigt** : transitions, défilement
   interne et fermeture par balayage ne sont pas vérifiés (seul Échap et le
   voile le sont, dans un DOM).
7. **`prefers-reduced-transparency`** n'est pas implémenté par Chrome/Firefox :
   la règle existe et est testée statiquement, son effet réel ne l'est pas.
8. **Le focus sur le conteneur du composeur** remplace l'anneau natif du
   `<textarea>` (`outline:none` + `:focus-within`). C'est un choix assumé,
   visible et ≥ 3:1, mais il diffère du comportement par défaut du navigateur.
9. **Pas de persistance d'historique** : toujours en mémoire, perdu au
   rechargement (audit #48, « partiel »). Le corriger demanderait un stockage
   côté client ou une route côté serveur — hors périmètre.
10. **Upload absent** (audit #47) : impossible sans toucher au backend, ce qui
    était explicitement exclu. Aucun bouton mort n'a été ajouté pour faire
    semblant.
11. **Aucune vérification multi-navigateurs.** Seuls le CSS écrit et jsdom ont
    été exercés. `color-mix()` de l'ancienne feuille a disparu (bon point pour
    la compatibilité), mais `:has()`, `text-wrap: balance`, `100dvh` et
    `-webkit-line-clamp` restent utilisés sans test réel.
12. **19 fichiers de référence lus** au lieu des « 8 à 12 » recommandés par
    `SKILL.md`. Écart signalé dans l'audit, pas dissimulé.
