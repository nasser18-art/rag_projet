# P1 — Socle documentaire : rapport d'étape

Statut : **terminé et testé** (hors embeddings réels, voir §5).
Branche : `arena/05d356d8-rag-projet` (la session est liée à cette branche ; `figma-make` ne peut pas être utilisée, voir §6).

---

## 1. Fichiers créés ou modifiés

| Fichier | Nature | Rôle |
|---|---|---|
| `rag/store.py` | **nouveau** | SQLite : documents, conversations, messages, retours |
| `rag/documents.py` | **nouveau** | validation, extraction (PDF/DOCX/CSV/XLSX), nettoyage, découpage |
| `rag/index.py` | **nouveau** | index vectoriel par document, rechargeable à chaud |
| `rag/config.py` | modifié | `DATA_DIR`, `MAX_UPLOAD_MB`, `CHUNK_SIZE`, `CHUNK_OVERLAP`, chemins dérivés, `allowed_extensions` |
| `rag/engine.py` | modifié | lit l'index par document quand il existe ; `health()` tient compte des deux sources ; API publique inchangée |
| `app.py` | modifié | 6 routes documents + `knowledge-bases`, santé enrichie, moteur branché sur l'index |
| `tests/factories.py` | **nouveau** | PDF écrit à la main, DOCX/CSV/XLSX générés, encodeur déterministe |
| `tests/test_store.py` | **nouveau** | 10 tests de persistance |
| `tests/test_documents.py` | **nouveau** | 17 tests d'extraction et de validation |
| `tests/test_index.py` | **nouveau** | 8 tests d'index |
| `tests/test_documents_api.py` | **nouveau** | 13 tests d'API |
| `tests/test_engine_bridge.py` | **nouveau** | 6 tests de bascule moteur → index |
| `tests/test_chat_stream.py` | **nouveau** | 4 tests du contrat SSE |
| `requirements.txt` | modifié | `python-multipart`, `openpyxl` |
| `.env.example` | modifié | `DATA_DIR`, `MAX_UPLOAD_MB`, `CHUNK_SIZE`, `CHUNK_OVERLAP` |
| `.gitignore` | modifié | `data/` |
| `README.md` | modifié | base documentaire, routes, formats, données locales, tests |
| `docs/integration/decisions.md` | **nouveau** | les 9 conflits, recommandation, conséquence, état |

Aucun fichier de l'ancienne interface n'a été supprimé. Aucun script numéroté n'a été modifié.

---

## 2. Fonctionnalités livrées

- **Import** d'un fichier avec catégorie, depuis l'API (l'interface arrive en P4) : validation d'extension, de signature binaire, de taille, de nom (chemins et caractères de contrôle neutralisés), détection de doublon par SHA-256.
- **Extraction** réelle des quatre formats, avec provenance lisible : `Page n` (PDF), `Feuille <nom>` (XLSX), `Tableau` (CSV), `Document` (DOCX).
- **Nettoyage** et **découpage** page par page (1 000 caractères, 150 de recouvrement, paramétrables).
- **Indexation** par document : un `.json` + un `.npy` par document, rechargement automatique, aucune redémarrage nécessaire.
- **Inventaire** : liste filtrable (statut, catégorie, nom), compteurs par statut, catégories avec nombre de documents/chunks.
- **Suppression** : retire la ligne, le fichier original et les vecteurs.
- **Réindexation** depuis le fichier conservé.
- **Téléchargement / aperçu** de l'original, avec le nom d'origine.
- **Dégradation honnête** : si le modèle d'embeddings est absent, le document est conservé avec le statut `erreur` et le motif exact ; l'API répond 503 en l'expliquant.
- **Moteur RAG conservé** : `RagEngine` lit désormais l'index par document quand les artefacts historiques n'existent pas. Le seuil de pertinence et le refus « je ne trouve pas cette information » sont inchangés.

---

## 3. Tests réellement exécutés

```
$ python -m unittest discover -s tests -t .
Ran 70 tests in 0.920s
OK
```

Détail des catégories :

| Fichier | Tests | Ce qui est vérifié |
|---|---|---|
| `test_store.py` | 10 | création, statuts, doublon SHA, filtres, catégories, suppression, conversations, messages, cascade, réouverture |
| `test_documents.py` | 17 | noms piégés (`../../etc/passwd`), extensions, taille, signatures, extraction des 4 formats, PDF corrompu, PDF sans texte, découpage et labels |
| `test_index.py` | 8 | ajout, recherche pertinente, filtre catégorie, `get_source`, persistance, rechargement à chaud, suppression |
| `test_documents_api.py` | 13 | 201, liste et compteurs, DOCX+CSV, 409, 415, 422, 413, PDF corrompu sans trace, téléchargement, réindexation, suppression 204/404, source depuis l'index, santé |
| `test_engine_bridge.py` | 6 | recherche via l'index, `health`, `get_source`, refus par seuil (sans appeler le modèle), erreur explicite sans index |
| `test_chat_stream.py` | 4 | trames SSE `sources` → `token`* → `done`, mode non-streaming, 503, 422 |

Les 9 tests de `test_api_baseline.py` (contrat d'origine) restent verts : aucune régression.

## 4. Vérifications sur serveur réel

Serveur `uvicorn app:app` relancé, requêtes `curl` :

| Requête | Résultat observé |
|---|---|
| `GET /api/health` | 200 — `documents_count`, `chunks_indexed`, `formats`, `max_upload_bytes` présents ; `degraded` (ni corpus historique, ni clé) |
| `GET /api/knowledge-bases` | 200 — `categories: []`, 4 formats |
| `GET /api/documents` | 200 — liste vide, compteurs à zéro |
| `POST /api/documents` (PDF 1 Ko) | **503** — « Le document est enregistré mais n'a pas pu être indexé : le modèle d'embeddings est indisponible. » |
| `GET /api/documents` après l'échec | 1 document, `status: "erreur"`, motif exact, `pages: 2`, `chunk_count: 0` |
| Second import du même fichier | **409** doublon |
| `POST` avec un `.exe` | **415** format non pris en charge |
| `DELETE /api/documents/{id}` | **204**, puis **404** au second appel, fichier original supprimé |

---

## 5. Problème restant (le seul bloquant pour la démonstration)

**Le modèle d'embeddings ne peut pas être chargé dans cet environnement** : `huggingface.co` est injoignable et `sentence-transformers` n'est pas installé. Conséquence : ici, tout import aboutit à `erreur` et le chat reste en 503.

Ce qui est prouvé malgré tout : toute la chaîne autour de l'encodeur (extraction → découpage → écriture de l'index → recherche → source → suppression) est exercée par les tests avec un encodeur injecté, sur le vrai code. Seul l'appel à `SentenceTransformer` n'a pas tourné ici. Sur votre machine, avec accès à Hugging Face, l'import doit passer de 503 à 201 — c'est le premier test à faire (voir §7).

---

## 6. Branche : écart à signaler

Vous demandez `figma-make`. Cette session est techniquement liée à `arena/05d356d8-rag-projet` : je ne peux ni changer de branche, ni pousser ailleurs. Le travail est donc poussé sur cette branche-là, et la PR #1 reste ouverte vers `master`. Rien n'est fusionné.

Si vous voulez que le résultat arrive sur `figma-make`, deux options : merger la PR dans `master` puis rebaser `figma-make`, ou me laisser produire un patch que vous appliquez vous-même. Je ne peux pas le faire d'ici.

---

## 7. Prochaine étape (P2)

1. `rag/store.py` est déjà prêt pour les conversations : P2 branche `POST/GET/PATCH/DELETE /api/conversations` et persiste les messages à la fin du flux SSE.
2. Test de bout en bout réel **chez vous** : `pip install -r requirements.txt`, importer un PDF, poser une question, vérifier les sources.
3. Ensuite P3 (citations `[n]`, filtre de catégorie, score conservé), puis P4 (interface React branchée).
