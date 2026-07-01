param(
  [string]$NodeExe = "",
  [int]$Port = 8123,
  [switch]$PauseOnExit
)

$ErrorActionPreference = "Stop"

function Test-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
}

function Stop-ProcessByIdFile($PidFile) {
  if (-not (Test-Path $PidFile)) {
    return
  }

  $pidValue = (Get-Content $PidFile -Raw).Trim()
  if ($pidValue -match '^\d+$') {
    Stop-Process -Id ([int]$pidValue) -Force -ErrorAction SilentlyContinue
  }
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

function Wait-Health($Port, $Seconds) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 2
      if ($health.ok) {
        return $health
      }
    } catch {
    }
    Start-Sleep -Milliseconds 500
  }
  throw "server did not become healthy in time"
}

function Post-Json($Port, $Path, $Body) {
  return Invoke-RestMethod -Uri ("http://127.0.0.1:$Port" + $Path) -Method Post -ContentType "application/json" -Body (($Body | ConvertTo-Json -Depth 10 -Compress)) -TimeoutSec 20
}

function Get-Json($Port, $Path) {
  return Invoke-RestMethod -Uri ("http://127.0.0.1:$Port" + $Path) -TimeoutSec 20
}

if (-not (Test-Admin)) {
  throw "This script must run as Administrator."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$windowsBackendDir = Split-Path -Parent $scriptDir
$repoRoot = Split-Path -Parent $windowsBackendDir
$project = Join-Path $repoRoot "windows-backend\Weaknet.WinDivertShaper\Weaknet.WinDivertShaper.csproj"
$distDir = Join-Path $repoRoot "windows-backend\dist\win-x64"
$publishDir = Join-Path $repoRoot "windows-backend\runtime\codex-publish"
$runtimeDir = Join-Path $repoRoot "windows-backend\runtime\codex-ui"
$reportDir = Join-Path $repoRoot "windows-backend\runtime"
$reportFile = Join-Path $reportDir "codex-admin-selftest-report.json"
$traceFile = Join-Path $reportDir "codex-admin-selftest-trace.log"
$logOut = Join-Path $reportDir "codex-server.out.log"
$logErr = Join-Path $reportDir "codex-server.err.log"
$serverPidFile = Join-Path $runtimeDir "weaknet-win32.pid"
$publishExe = Join-Path $publishDir "Weaknet.WinDivertShaper.exe"
$distDll = Join-Path $distDir "WinDivert.dll"
$distSys = Join-Path $distDir "WinDivert64.sys"

if ([string]::IsNullOrWhiteSpace($NodeExe)) {
  $NodeExe = Join-Path $repoRoot "third_party\node\win-x64\node.exe"
}

function New-Profile($presetKey, $displayNameZh, $latencyRttMs, $jitterMs, $packetLossPercent, $downloadKbps, $uploadKbps, $disconnectMode, $disconnectDurationSec, $disconnectIntervalSec, $waveEnabled) {
  return [ordered]@{
    presetKey = $presetKey
    displayNameZh = $displayNameZh
    latencyRttMs = $latencyRttMs
    jitterMs = $jitterMs
    packetLossPercent = $packetLossPercent
    downloadKbps = $downloadKbps
    uploadKbps = $uploadKbps
    disconnectMode = $disconnectMode
    disconnectDurationSec = $disconnectDurationSec
    disconnectIntervalSec = $disconnectIntervalSec
    networkWave = [ordered]@{
      enabled = $waveEnabled
      mode = "subway-elevator"
    }
  }
}

function New-TestCase($name, $targetScope, $profile, $pingHost, $polls, $sleepMs, $targetApp = "") {
  $body = [ordered]@{
    targetScope = $targetScope
    profile = $profile
  }
  if ($targetApp) {
    $body.targetApp = $targetApp
  }

  return [ordered]@{
    name = $name
    body = $body
    ping = $pingHost
    polls = $polls
    sleepMs = $sleepMs
  }
}

if (-not (Test-Path $NodeExe)) {
  throw "Node executable was not found: $NodeExe"
}
if (-not (Test-Path $distDll) -or -not (Test-Path $distSys)) {
  throw "WinDivert.dll or WinDivert64.sys is missing from windows-backend\dist\win-x64"
}

New-Item -ItemType Directory -Force $publishDir | Out-Null
New-Item -ItemType Directory -Force $runtimeDir | Out-Null
New-Item -ItemType Directory -Force $reportDir | Out-Null
Remove-Item $reportFile, $traceFile -Force -ErrorAction SilentlyContinue

$server = $null
$summary = [ordered]@{}

try {
  Start-Transcript -Path $traceFile -Force | Out-Null

  dotnet publish $project -f net8.0 -c Release -r win-x64 --self-contained false -o $publishDir
  Copy-Item $distDll $publishDir -Force
  Copy-Item $distSys $publishDir -Force

  $env:WEAKNET_WIN32_SHAPER = $publishExe
  $env:WEAKNET_WIN32_RUNTIME_DIR = $runtimeDir
  $env:HOST = "127.0.0.1"
  $env:PORT = "$Port"

  Stop-ProcessByIdFile $serverPidFile
  Remove-Item $logOut, $logErr -Force -ErrorAction SilentlyContinue

  $server = Start-Process -FilePath $NodeExe -ArgumentList @("server.js") -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $logOut -RedirectStandardError $logErr

  $summary.health = Wait-Health $Port 15
  $summary.admin = Get-Json $Port "/api/admin/status"

  $tests = @(
    (New-TestCase "global_wifi" "mac-global" (New-Profile "wifi" "Wi-Fi" 80 20 0.1 3000 1000 "none" 0 0 $false) "223.5.5.5" 1 1200),
    (New-TestCase "global_3g" "mac-global" (New-Profile "3g" "3G" 300 80 3 400 100 "none" 0 0 $false) "223.5.5.5" 1 1200),
    (New-TestCase "global_high_latency" "mac-global" (New-Profile "high_latency" "High Latency" 800 200 1 1500 400 "none" 0 0 $false) "223.5.5.5" 1 1200),
    (New-TestCase "global_high_loss" "mac-global" (New-Profile "high_loss" "High Loss" 200 80 10 1200 500 "none" 0 0 $false) "223.5.5.5" 1 1200),
    (New-TestCase "global_loss100" "mac-global" (New-Profile "loss_100" "Loss 100" $null 0 100 $null $null "always" 0 0 $false) "223.5.5.5" 1 1200),
    (New-TestCase "global_wave" "mac-global" (New-Profile "wifi" "Wi-Fi Wave" 100 0 2 500 200 "none" 0 0 $true) "223.5.5.5" 3 1200),
    (New-TestCase "target_wifi" "mac-unity" (New-Profile "wifi" "Target Wi-Fi" 80 20 0.1 3000 1000 "none" 0 0 $false) "223.5.5.5" 1 1200 "223.5.5.5"),
    (New-TestCase "periodic_regression" "mac-global" (New-Profile "custom" "Periodic" 300 50 1 1000 500 "periodic" 3 6 $false) "223.5.5.5" 8 1000)
  )

  $results = @()
  foreach ($test in $tests) {
    $apply = Post-Json $Port "/api/weaknet/apply" $test.body
    Start-Sleep -Milliseconds $test.sleepMs
    try {
      ping $test.ping -n 4 | Out-Null
    } catch {
    }

    $statuses = @()
    for ($i = 0; $i -lt $test.polls; $i += 1) {
      $statuses += ,(Get-Json $Port "/api/network/status")
      if ($i -lt ($test.polls - 1)) {
        Start-Sleep -Milliseconds $test.sleepMs
      }
    }

    $clear = Post-Json $Port "/api/weaknet/clear" @{}
    $results += [ordered]@{
      name = $test.name
      apply = $apply
      statuses = $statuses
      clear = $clear
    }
    Start-Sleep -Milliseconds 500
  }

  $summary.tests = $results
  $summary | ConvertTo-Json -Depth 12 | Set-Content -Path $reportFile -Encoding UTF8
  Get-Content $reportFile -Raw
} catch {
  $_ | Out-String | Set-Content -Path $traceFile -Encoding UTF8
  throw
} finally {
  try {
    Post-Json $Port "/api/weaknet/clear" @{} | Out-Null
  } catch {
  }
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  }
  try {
    Stop-Transcript | Out-Null
  } catch {
  }
  if ($PauseOnExit) {
    Read-Host "Press Enter to close"
  }
}
