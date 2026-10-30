@echo off
setlocal
cd /d "%~dp0"
if not exist ".env" (
  echo Configuration manquante : copiez .env.example en .env puis renseignez GROQ_API_KEY.
  pause
  exit /b 1
)
if not exist "web\app-dist\index.html" (
  echo Build de l'interface React absent : compilation dans web/ ...
  pushd web
  call npm ci
  call npm run build
  popd
  if not exist "web\app-dist\index.html" (
    echo Compilation impossible : l'ancienne interface sera servie.
  )
)
py -m uvicorn app:app --host 127.0.0.1 --port 8000
pause
