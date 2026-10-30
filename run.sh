#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
[ -f .env ] || { echo "Configuration manquante : copiez .env.example en .env puis renseignez GROQ_API_KEY."; exit 1; }
if [ ! -f web/app-dist/index.html ]; then
  if command -v npm >/dev/null 2>&1; then
    echo "Build de l'interface React absent : compilation dans web/ ..."
    (cd web && npm ci && npm run build) || echo "Compilation impossible : l'ancienne interface sera servie."
  else
    echo "npm introuvable : l'ancienne interface sera servie (voir README, « Compiler l'interface »)."
  fi
fi
python3 -m uvicorn app:app --host 127.0.0.1 --port 8000
