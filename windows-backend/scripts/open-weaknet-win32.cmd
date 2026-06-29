@echo off
setlocal

cd /d "%~dp0..\.."

net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo Opening Administrator command prompt...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

set "SHAPER=%CD%\windows-backend\dist\win-x64\Weaknet.WinDivertShaper.exe"
if exist "%SHAPER%" (
  set "WEAKNET_WIN32_SHAPER=%SHAPER%"
) else (
  echo Windows backend package was not found:
  echo %SHAPER%
  echo.
  echo Run windows-backend\scripts\build-win32-package.ps1 first.
  echo The service can still use a development publish if one exists.
)

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. This script packages .NET/WinDivert, but the current console UI still needs Node.js to run server.js.
  pause
  exit /b 1
)

echo Starting Weaknet Console Agent on http://127.0.0.1:8123
start "" "http://127.0.0.1:8123"
node server.js

echo.
echo Weaknet Console Agent stopped.
pause
