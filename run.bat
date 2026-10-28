@echo off
setlocal
cd /d "%~dp0"
if not exist ".env" (
  echo Configuration manquante : copiez .env.example en .env puis renseignez GROQ_API_KEY.
  pause
  exit /b 1
)
py -m uvicorn app:app --host 127.0.0.1 --port 8000
pause
