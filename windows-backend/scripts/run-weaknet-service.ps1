param(
  [int]$Port = 8123,
  [string]$SourceSignature = "",
  [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$windowsBackendDir = Split-Path -Parent $scriptDir
$repoRoot = Split-Path -Parent $windowsBackendDir
$ensureVendoredDeps = Join-Path $scriptDir "ensure-vendored-deps.ps1"

function Test-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
}

function Ensure-VendoredRuntime {
  if (-not (Test-Path -LiteralPath $ensureVendoredDeps)) {
    throw "Missing vendor dependency bootstrap script: $ensureVendoredDeps"
  }

  try {
    & $ensureVendoredDeps -Group runtime -Quiet
  } catch {
    throw "Failed to prepare vendored runtime dependencies. $($_.Exception.Message)"
  }
}

function Resolve-NodeExe {
  $candidate = Join-Path $repoRoot "third_party\node\win-x64\node.exe"
  if (Test-Path $candidate) {
    return [System.IO.Path]::GetFullPath($candidate)
  }

  throw "Vendored Node.js was not found at third_party\\node\\win-x64\\node.exe. Run ensure-vendored-deps.ps1 or restore vendor-packs."
}

function Stop-ProcessByPidFile($PidFile) {
  if (-not (Test-Path $PidFile)) {
    return
  }

  $pidValue = (Get-Content $PidFile -Raw).Trim()
  if ($pidValue -match '^\d+$') {
    Stop-Process -Id ([int]$pidValue) -Force -ErrorAction SilentlyContinue
  }
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

function Get-ListenerProcessId($Port) {
  try {
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
    if ($listener) {
      return [int]$listener.OwningProcess
    }
  } catch {
  }

  $line = netstat -ano | Select-String "127.0.0.1:$Port" | Where-Object { $_.ToString() -match 'LISTENING' } | Select-Object -First 1
  if (-not $line) {
    $line = netstat -ano | Select-String ":$Port" | Where-Object { $_.ToString() -match 'LISTENING' } | Select-Object -First 1
  }
  if (-not $line) {
    return 0
  }

  $parts = ($line.ToString() -replace '\s+', ' ').Trim().Split(' ')
  if ($parts.Length -lt 5) {
    return 0
  }
  if ($parts[-1] -match '^\d+$') {
    return [int]$parts[-1]
  }
  return 0
}

function Stop-StaleWeaknetListener($Port, $RepoRoot) {
  $listenerPid = Get-ListenerProcessId $Port
  if (-not $listenerPid) {
    return
  }

  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $listenerPid" -ErrorAction SilentlyContinue
  if (-not $process) {
    throw "Port $Port is already in use by process $listenerPid."
  }

  $commandLine = [string]$process.CommandLine
  if ($commandLine -like "*server.js*" -or $commandLine -like "*$RepoRoot*") {
    Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    return
  }

  throw "Port $Port is already in use by another process: $($process.Name) ($listenerPid)."
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
  return $null
}

function Start-NodeProcess($NodeExe, $ScriptName, $WorkingDirectory, $StdOutPath, $StdErrPath, $EnvironmentMap) {
  $quotedNode = '"' + $NodeExe.Replace('"', '""') + '"'
  $quotedScript = '"' + $ScriptName.Replace('"', '""') + '"'
  $quotedOut = '"' + $StdOutPath.Replace('"', '""') + '"'
  $quotedErr = '"' + $StdErrPath.Replace('"', '""') + '"'
  $setParts = @()
  foreach ($key in $EnvironmentMap.Keys) {
    $value = [string]$EnvironmentMap[$key]
    $setParts += "set `"$key=$value`""
  }
  $prefix = ""
  if ($setParts.Count -gt 0) {
    $prefix = ($setParts -join " && ") + " && "
  }
  $commandLine = "$prefix$quotedNode $quotedScript 1>>$quotedOut 2>>$quotedErr"

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "cmd.exe"
  $psi.Arguments = "/d /c $commandLine"
  $psi.WorkingDirectory = $WorkingDirectory
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true

  return [System.Diagnostics.Process]::Start($psi)
}

if (-not (Test-Admin)) {
  throw "This script must run as Administrator."
}

Ensure-VendoredRuntime
$runtimeDir = Join-Path $repoRoot "windows-backend\.runtime"
$uiRuntimeDir = Join-Path $runtimeDir "ui"
$serverPidFile = Join-Path $runtimeDir "weaknet-server.pid"
$serverOut = Join-Path $runtimeDir "weaknet-server.out.log"
$serverErr = Join-Path $runtimeDir "weaknet-server.err.log"
$shaperExe = Join-Path $repoRoot "windows-backend\dist\win-x64\Weaknet.WinDivertShaper.exe"
$nodeExe = Resolve-NodeExe

New-Item -ItemType Directory -Force $runtimeDir | Out-Null
New-Item -ItemType Directory -Force $uiRuntimeDir | Out-Null

Stop-ProcessByPidFile $serverPidFile
Stop-StaleWeaknetListener $Port $repoRoot
Remove-Item $serverOut, $serverErr -Force -ErrorAction SilentlyContinue

$serverEnv = @{
  WEAKNET_WIN32_RUNTIME_DIR = $uiRuntimeDir
  HOST = "127.0.0.1"
  PORT = "$Port"
  WEAKNET_REQUIRE_VENDORED_ADB = "1"
}
if ($SourceSignature) {
  $serverEnv["WEAKNET_SOURCE_SIGNATURE"] = $SourceSignature
}
if (Test-Path $shaperExe) {
  $serverEnv["WEAKNET_WIN32_SHAPER"] = $shaperExe
}

$server = Start-NodeProcess $nodeExe "server.js" $repoRoot $serverOut $serverErr $serverEnv
$server.Id | Set-Content -Path $serverPidFile -Encoding ASCII

$health = Wait-Health $Port 15
if (-not $health) {
  $stderr = ""
  if (Test-Path $serverErr) {
    $stderr = Get-Content $serverErr -Tail 80 | Out-String
  }
  throw "Weaknet service failed to become healthy on port $Port.`n$stderr"
}

if ($OpenBrowser) {
  Start-Process "http://127.0.0.1:$Port" | Out-Null
}

Write-Host "Weaknet service started on http://127.0.0.1:$Port"
Write-Host "Node: $nodeExe"
Write-Host "PID: $($server.Id)"
