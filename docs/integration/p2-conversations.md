# P2 — Conversations persistées : rapport d'étape

Statut : **terminé et testé**. S'appuie sur le socle de P1 (SQLite déjà en place).

---

## 1. Fichiers modifiés

| Fichier | Nature | Rôle |
|---|---|---|
| `app.py` | modifié | 6 routes conversations/messages + recherche transverse ; `POST /api/chat` persiste les messages et renvoie `conversation_id` |
| `tests/test_conversations_api.py` | **nouveau** | 11 tests |
| `tests/test_chat_stream.py` | modifié | isole la base (Store temporaire), vérifie `conversation_id`/`message_id` dans `done` |
| `README.md` | modifié | routes conversations, recherche, retour |

Aucune dépendance ajoutée.

---

## 2. Contrat

| Méthode | Route | Rôle | Codes |
|---|---|---|---|
| GET | `/api/conversations` | liste triée par activité | 200 |
| POST | `/api/conversations` | crée (`title`, `category`) | 201, 422 |
| GET | `/api/conversations/{id}` | conversation + messages + sources | 200, 404 |
| PATCH | `/api/conversations/{id}` | renomme | 200, 404, 422 |
| DELETE | `/api/conversations/{id}` | supprime (messages en cascade) | 204, 404 |
| POST | `/api/messages/{id}/feedback` | `up`, `down` ou `null` | 204, 404, 422 |
| GET | `/api/search?q=` | conversations + documents (palette ⌘K) | 200 |

`POST /api/chat` accepte désormais `conversation_id` et `category`, et reste **rétrocompatible** :

- sans `conversation_id` : une conversation est créée, titrée avec la question (60 caractères) ;
- avec un identifiant inconnu : **404**, rien n'est écrit ;
- l'événement SSE `sources` porte `conversation_id`, l'événement `done` porte `conversation_id` et `message_id` ;
- l'échec du moteur (503, 502) **ne crée aucune conversation vide** : la création est différée après le succès de la recherche.

Le message utilisateur est enregistré avant le flux, le message assistant à la fin (ou partiel si le flux casse). Le modèle réellement utilisé est stocké avec la réponse.

---

## 3. Tests exécutés

```
$ python -m unittest discover -s tests -t .
Ran 81 tests in 1.220s
OK
```

Nouveaux tests (11) :

| Test | Vérifie |
|---|---|
| `test_create_list_rename_delete` | cycle complet, 404 après suppression |
| `test_unknown_conversation_is_404` | GET et PATCH |
| `test_invalid_title_is_rejected` | 422 sur titre vide |
| `test_stream_chat_creates_conversation_and_messages` | 2 messages, titre = question, sources et modèle persistés |
| `test_chat_in_existing_conversation_appends` | 4 messages, titre conservé, ordre |
| `test_chat_with_unknown_conversation_is_404` | rien n'est écrit |
| `test_non_streaming_chat_persists_too` | mode JSON |
| `test_failed_chat_does_not_store_messages` | 502 sans pollution |
| `test_failed_engine_leaves_no_empty_conversation` | 503 sans conversation fantôme |
| `test_feedback_on_message` | `up`, `null`, 404, valeur invalide 422 |
| `test_search_finds_conversations_and_documents` | recherche vide et « atlas » |

---

## 4. Vérifications sur serveur réel

| Requête | Résultat |
|---|---|
| `POST /api/conversations` | 201, identifiant renvoyé |
| `POST /api/chat` (sans index) | **503**, la conversation reste à 0 message |
| `GET /api/conversations/{id}` | 200, `messages: 0` |
| `GET /api/search?q=atlas` | 1 conversation, 0 document |
| `PATCH` puis `DELETE` | 200 puis 204, liste vide ensuite |

Au passage : une base de test polluée (20 conversations créées par les premiers tests avant isolation) a été nettoyée ; les tests n'écrivent plus dans `data/rag.db`.

---

## 5. Reste à faire

- **P3** : citations `[n]` réelles, `page` dans les sources du flux, filtre `category` transmis à la recherche, score conservé dans `/api/sources/{id}`.
- **P4** : interface React branchée sur ces routes (documents, conversations, palette, composeur).
- Toujours bloqué ici : embeddings et Groq réels (réseau). Les tests utilisent un moteur et un encodeur bouchonnés, jamais en production.
