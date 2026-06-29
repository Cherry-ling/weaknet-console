@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%one-click-win32-verify.ps1"

echo.
echo If a report was created, it has also been copied to your clipboard.
pause
