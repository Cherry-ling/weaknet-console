@echo off
setlocal

cd /d "%~dp0..\.."
set "LAUNCHER_EXE=%CD%\WeakNetConsole.exe"
set "LAUNCHER_SCRIPT=%CD%\windows-backend\scripts\run-weaknet-launcher.ps1"

if exist "%LAUNCHER_EXE%" (
  start "" "%LAUNCHER_EXE%"
  exit /b 0
)

echo Starting Weaknet Launcher on http://127.0.0.1:8122
start "" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER_SCRIPT%"

set "LAUNCHER_READY="
for /L %%i in (1,1,30) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:8122/api/launcher/status' -TimeoutSec 2; if ($r.ok) { exit 0 } else { exit 1 } } catch { exit 1 }"
  if not errorlevel 1 (
    set "LAUNCHER_READY=1"
    goto launcher_ready
  )
  timeout /t 1 /nobreak >nul
)

:launcher_ready
if not defined LAUNCHER_READY (
  echo.
  echo Weaknet Launcher failed to become ready on http://127.0.0.1:8122
  echo Review windows-backend\runtime\weaknet-launcher.out.log and weaknet-launcher.err.log, then press any key to close this window.
  pause
  exit /b 1
)

start "" "http://127.0.0.1:8122/"

exit /b 0
