# Les 9 conflits : recommandation, conséquence, état

Chaque décision est prise pour être **réversible** : rien n'est supprimé avant votre validation finale. La colonne « état » dit ce qui est déjà appliqué dans le code au terme de P1.

| # | Sujet | Recommandation | Conséquence technique | État |
|---|---|---|---|---|
| 1 | Formats annoncés (XLSX, CSV) | **Les quatre formats sont implémentés et testés** : PDF, DOCX, CSV, XLSX | `rag/documents.py` contient un extracteur par format ; `openpyxl` ajouté aux dépendances ; l'interface ne doit annoncer que `formats` renvoyé par `GET /api/health`. Limite réelle : un tableur est converti en lignes `cellule \| cellule`, la recherche sémantique y est moins bonne que sur du texte suivi | **appliqué** |
| 2 | Bascule de thème | **La garder** (choix explicite persisté), avec `prefers-color-scheme` comme valeur initiale | `data-theme` sur la racine, mémorisé dans `localStorage` ; le CSS du template le gère déjà ; aucun changement backend | en attente (P4) |
| 3 | « Ouvrir le document » | **Servir l'original** via `GET /api/documents/{id}/file` | Fichiers conservés dans `data/documents/` sous un nom opaque (`<id>.<ext>`), nom d'origine restitué dans `Content-Disposition`, `Content-Type` exact, chemin jamais exposé | **appliqué** (P1) |
| 4 | Profil « Alex Martin » | **Le retirer** tant qu'il n'y a pas d'authentification | Un profil inerte est précisément ce que la mission interdit ; le remplacement par un menu « Aide / À propos » reste possible | en attente (P4) |
| 5 | Sélecteur de modèle « Nexus 2.1 » | **Lecture seule** au départ : afficher le modèle réel renvoyé par `/api/health` | Aucun mensonge sur le modèle utilisé ; une liste blanche (`GET /api/models`) et un paramètre `model` pourront venir ensuite, avec validation serveur stricte | en attente (P4) |
| 6 | Étapes d'ingestion | **Synchrone** : un état « Importation et indexation… » couvrant les quatre étapes | Le backend renvoie 201 quand tout est fait, 503 si le modèle est absent, 4xx selon le fichier ; pas de progression inventée. Un job asynchrone (+ polling) est une évolution ultérieure si les gros PDF le justifient | **appliqué** (P1) |
| 7 | « Synchronisé » | **Refléter `/api/health`** : point vert « prêt », ambre « index incomplet », rouge « service injoignable » | Information réelle, rafraîchie au retour d'onglet ; aucune synchronisation fantôme | en attente (P4) |
| 8 | Bases de connaissances | **Catégories réelles** issues des documents indexés | `GET /api/knowledge-bases` renvoie `{name, documents, indexed, chunks}` ; le sélecteur du composeur filtrera la recherche (paramètre `category` de `/api/chat`, P3) | **backend appliqué**, filtre chat en P3 |
| 9 | Ancienne interface (`frontend/` vanilla) | **Conserver jusqu'à validation**, puis supprimer dans un commit dédié | Son code reste dans l'historique Git et dans la PR ; rien n'est perdu. Aucune suppression avant que la nouvelle interface soit complète et testée | en attente (P4/P6) |

## Points ajoutés au-delà des 9 conflits

- **Doublon de fichier** : refusé par empreinte SHA-256 (409) avec le nom du document déjà présent — évite d'indexer deux fois le même texte.
- **Fichier en erreur** : un import dont l'indexation échoue laisse une ligne `erreur` avec le motif exact, supprimable et réimportable. Rien n'est masqué.
- **Extraction vide** : un PDF scanné sans couche texte renvoie 422 avec un message explicite (« document scanné ? ») plutôt que d'indexer du vide.
