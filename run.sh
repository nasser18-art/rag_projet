#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
[ -f .env ] || { echo "Configuration manquante : copiez .env.example en .env puis renseignez GROQ_API_KEY."; exit 1; }
python3 -m uvicorn app:app --host 127.0.0.1 --port 8000
