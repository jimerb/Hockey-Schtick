@echo off
setlocal
cd /d "%~dp0"
set "SCHTICK_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "SCHTICK_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  ) else (
    echo Node.js is required. See README.md for setup.
    pause
    exit /b 1
  )
)
if not exist "node_modules\vite\bin\vite.js" (
  echo Dependencies are missing. Run pnpm install --frozen-lockfile first.
  pause
  exit /b 1
)
echo Hockey Schtick: http://127.0.0.1:5173/
echo Keep this window open while playing. Ctrl+C stops the server.
echo If the server is already running, open the address above.
"%SCHTICK_NODE%" "node_modules\vite\bin\vite.js" --host 127.0.0.1 --port 5173 --strictPort --open
pause
