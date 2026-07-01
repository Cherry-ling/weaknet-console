param(
  [switch]$IncludeLauncher
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$windowsBackendDir = Split-Path -Parent $scriptDir
$repoRoot = Split-Path -Parent $windowsBackendDir
$runtimeDir = Join-Path $repoRoot "windows-backend\.runtime"
$pidFile = Join-Path $runtimeDir "weaknet.pid"
$statusFile = Join-Path $runtimeDir "status.json"
$serverPidFile = Join-Path $runtimeDir "weaknet-server.pid"
$launcherPidFile = Join-Path $runtimeDir "weaknet-launcher.pid"
$serverOut = Join-Path $runtimeDir "weaknet-server.out.log"
$serverErr = Join-Path $runtimeDir "weaknet-server.err.log"
$launcherOut = Join-Path $runtimeDir "weaknet-launcher.out.log"
$launcherErr = Join-Path $runtimeDir "weaknet-launcher.err.log"

function Stop-ProcessByPidFile($PidFile, $Label) {
  if (-not (Test-Path $PidFile)) {
    return
  }

  $pidValue = (Get-Content $PidFile -Raw).Trim()
  if ($pidValue -match '^\d+$') {
    Stop-Process -Id ([int]$pidValue) -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped $Label process $pidValue."
  } else {
    Write-Host "$Label pid file is invalid; removing it."
  }
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

function Get-ListenerProcessIds($Port) {
  $ids = @()
  try {
    $ids += Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
      Select-Object -ExpandProperty OwningProcess -Unique
  } catch {
  }

  if ($ids.Count -eq 0) {
    $ids += netstat -ano |
      Select-String ":$Port" |
      Where-Object { $_.ToString() -match 'LISTENING' } |
      ForEach-Object {
        $parts = ($_.ToString() -replace '\s+', ' ').Trim().Split(' ')
        if ($parts.Length -ge 5 -and $parts[-1] -match '^\d+$') {
          [int]$parts[-1]
        }
      }
  }

  return $ids | Where-Object { $_ } | Select-Object -Unique
}

function Stop-ListenersByPort($Port, $Label) {
  $ids = @(Get-ListenerProcessIds $Port)
  if ($ids.Count -eq 0) {
    return
  }

  foreach ($processId in $ids) {
    Stop-Process -Id ([int]$processId) -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped $Label listener on port $Port process $processId."
  }
}

Stop-ProcessByPidFile $serverPidFile "Weaknet Console Agent"
Stop-ListenersByPort 8123 "Weaknet Console Agent"

if (-not (Test-Path $pidFile)) {
  Write-Host "Windows weaknet backend is not running."
} else {
  $pidValue = (Get-Content $pidFile -Raw).Trim()
  if ($pidValue -match '^\d+$') {
    Stop-Process -Id ([int]$pidValue) -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped Windows weaknet backend process $pidValue."
  } else {
    Write-Host "Pid file is invalid; removing it."
  }

  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

if ($IncludeLauncher) {
  Stop-ProcessByPidFile $launcherPidFile "Weaknet Launcher"
  Stop-ListenersByPort 8122 "Weaknet Launcher"
}

Remove-Item $statusFile -Force -ErrorAction SilentlyContinue
Remove-Item $serverOut, $serverErr -Force -ErrorAction SilentlyContinue
if ($IncludeLauncher) {
  Remove-Item $launcherOut, $launcherErr -Force -ErrorAction SilentlyContinue
}
Write-Host "Weaknet status cleaned."
