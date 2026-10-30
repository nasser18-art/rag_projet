# Vérification — ce qui a été testé, ce qui ne l'a pas été

Environnement : conteneur Linux sans navigateur. `python3.11` + `uvicorn` dans `/tmp/venv`, Node 22, jsdom 24 installé **hors du dépôt** (`/tmp/runcheck/node_modules`).

## 1. Ce qui a été exécuté

### 1.1 Harnais DOM — `docs/design/tools/ui-check.mjs`

Charge le vrai `frontend/index.html`, importe les vrais modules `js/{api,ui,app}.js`, simule `/api/health`, `/api/chat` (SSE), `/api/sources/{id}`.

```
40/40 vérifications passées
```

Couvre : pastille d'état, 4 suggestions, absence de glyphe texte, sprite, envoi par suggestion, squelette puis cartes, jauge à 87 %, texte assemblé, gras et listes rendus, `aria-live` sur la réponse, outil de copie, réactivation du bouton, retrait de l'indicateur de frappe, annonce lecteur d'écran, persistance (2 entrées + sources), ouverture de feuille, scrim, extrait chargé, focus au bouton fermer, verrouillage du défilement, fermeture par Échap, feuille d'historique, compteur masqué puis affiché à 3 500 caractères, `Entrée` qui envoie, erreur 503 avec action de reprise, nouvelle conversation qui vide fil, accueil et stockage.

Reproduction :

```
mkdir -p /tmp/domtest && cd /tmp/domtest
npm init -y && npm install jsdom@24
cp /chemin/rag_projet/docs/design/tools/ui-check.mjs .
FRONTEND_DIR=/chemin/rag_projet/frontend node ui-check.mjs
```

### 1.2 Contraste — `docs/design/tools/contrast.py --strict`

```
Échecs actuels : 0 · échecs d'origine documentés : 6
```

Les 12 couples mesurés dans chaque apparence passent leur seuil. Deux lignes sont marquées « décoratif, hors seuil » : `--separator` (1,70:1 clair / 1,59:1 sombre après composition) et `--separator-opaque` (1,71:1). Ce sont des filets et des barres de défilement, pas des limites de contrôle : WCAG 1.4.11 ne s'y applique pas, et l'identification des cartes repose sur l'ombre et le fond, pas sur le filet.

Repères : texte principal 15,46:1 (clair) / 19,29:1 (sombre) ; secondaire 4,66 / 5,93 ; accent 5,11 / 4,66 ; blanc sur `--accent-fill` 5,57 dans les deux apparences ; erreur 4,94 / 4,99.

### 1.3 Jetons — `docs/design/tools/check_tokens.py`

```
1. jetons utilises mais non definis : 0
2. jetons de couleur : clair 30, sombre 30; 0 sans variante sombre, 0 en sombre seul
3. couleurs litterales hors tokens.css : 0
4. accolades non equilibrees : 0
RESULTAT : OK
```

### 1.4 Serveur réel — `uvicorn app:app --host 0.0.0.0 --port 8000`

| Requête | Résultat observé |
|---|---|
| `GET /` | 200, `text/html` |
| `GET /static/css/{tokens,base,components}.css` | 200, `text/css` |
| `GET /static/js/{app,api,ui}.js` | 200, `text/javascript` |
| `GET /static/icons.svg` | 200, `image/svg+xml` |
| `GET /api/health` | 200 `{"status":"degraded","knowledge_base_ready":false,"llm_configured":false,"model":"openai/gpt-oss-20b"}` |
| `POST /api/chat` | **503** `{"detail":"Le service documentaire n'est pas encore configuré."}` |
| `GET /api/sources/abc` | **503** (même cause : index absent) |
| `POST /api/chat` question vide | 422 |

La pastille affiche donc « Clé modèle absente » sur ce poste : c'est le reflet exact de `llm_configured: false`, pas une erreur.

### 1.5 États de démonstration — `?demo=…&theme=…`

Vérifiés par script (jsdom) : `answer` (2 messages, 2 cartes), `streaming` (indicateur de frappe présent), `sheet` (feuille ouverte), `error` (bloc d'erreur), tous en `data-theme="dark"`. Ces états alimentent `validation-guide.html`.

## 2. Ce qui n'a PAS été testé

À lire comme une liste de trous, pas comme une réserve de politesse.

1. **Aucun rendu visuel.** Aucun navigateur n'est installable ici (`npx playwright install chromium` → `Download failure`, deux tentatives ; pas de Chrome système ; pas de droits root). Personne n'a vu cette interface. Tout ce qui relève de l'apparence — flou, saturation, reflet, épaisseur perçue du verre, équilibre des blancs, netteté des courbes — est **non vérifié**.
2. **Aucune capture avant/après.** Le guide de revue est le substitut annoncé en phase 0 ; les images restent à produire, par vous, sur votre machine.
3. **Le flux SSE avec un vrai modèle.** Sans clé Groq ni index, aucun token n'a jamais été généré par le backend. Le chemin testé est un flux simulé (harnais) et le 503 réel. La latence du premier token, le débit, le comportement d'auto-défilement en conditions réelles : non testés.
4. **La physique de la feuille.** Le glissement, la projection d'élan (`project()`), la bande de caoutchouc et le seuil de fermeture n'ont été validés qu'en lecture, jamais au doigt. Le ressenti du ressort `linear()` n'a pas été observé.
5. **`backdrop-filter` réel.** Ni le flou, ni la saturation, ni les trois replis (`@supports`, `prefers-reduced-transparency`, `prefers-contrast`) n'ont été rendus.
6. **Lecteur d'écran.** `aria-live`, `aria-modal`, le piège de focus et les annonces sont posés selon les règles citées, mais aucun test avec VoiceOver, NVDA ou TalkBack n'a eu lieu.
7. **Safari et Firefox.** Rien n'a été ouvert ailleurs que dans jsdom. `-webkit-backdrop-filter` est présent ; `dvh`, `:has()` (non utilisé), `text-wrap: balance` et `linear()` en easing ne sont pas validés sur les versions anciennes.
8. **Le clavier de bout en bout** a été simulé (Entrée, Échap) mais pas parcouru à la main, onglet par onglet.
9. **La réfraction SVG** (`feTurbulence` + `feDisplacementMap`) n'a pas été implémentée : Chromium uniquement, ≤ 2 éléments, et impossible à valider sans rendu. Le verre repose sur les quatre autres effets.
