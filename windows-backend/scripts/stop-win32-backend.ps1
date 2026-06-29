$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$windowsBackendDir = Split-Path -Parent $scriptDir
$repoRoot = Split-Path -Parent $windowsBackendDir
$runtimeDir = Join-Path $repoRoot "windows-backend\runtime"
$pidFile = Join-Path $runtimeDir "weaknet.pid"
$statusFile = Join-Path $runtimeDir "status.json"

if (-not (Test-Path $pidFile)) {
  Write-Host "Windows weaknet backend is not running."
  exit 0
}

$pidValue = (Get-Content $pidFile -Raw).Trim()
if ($pidValue -match '^\d+$') {
  Stop-Process -Id ([int]$pidValue) -Force -ErrorAction SilentlyContinue
  Write-Host "Stopped Windows weaknet backend process $pidValue."
} else {
  Write-Host "Pid file is invalid; removing it."
}

Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
Remove-Item $statusFile -Force -ErrorAction SilentlyContinue
Write-Host "Weaknet status cleaned."
