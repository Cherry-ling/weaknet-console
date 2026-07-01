param(
  [int]$Port = 8122,
  [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$windowsBackendDir = Split-Path -Parent $scriptDir
$repoRoot = Split-Path -Parent $windowsBackendDir
$ensureVendoredDeps = Join-Path $scriptDir "ensure-vendored-deps.ps1"
$runtimeDir = Join-Path $repoRoot "windows-backend\.runtime"
$launcherPidFile = Join-Path $runtimeDir "weaknet-launcher.pid"
$launcherOut = Join-Path $runtimeDir "weaknet-launcher.out.log"
$launcherErr = Join-Path $runtimeDir "weaknet-launcher.err.log"

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

function Stop-StaleLauncher($Port, $RepoRoot) {
  $listenerPid = Get-ListenerProcessId $Port
  if (-not $listenerPid) {
    return
  }

  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $listenerPid" -ErrorAction SilentlyContinue
  if (-not $process) {
    Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    if (Get-ListenerProcessId $Port) {
      throw "Port $Port is still in use by process $listenerPid. Please close the old Weaknet launcher or run the stop script as Administrator."
    }
    return
  }

  $commandLine = [string]$process.CommandLine
  if ($commandLine -like "*launcher.js*" -or $commandLine -like "*$RepoRoot*") {
    Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    if (Get-ListenerProcessId $Port) {
      throw "Port $Port is still in use by process $listenerPid. Please close the old Weaknet launcher or run the stop script as Administrator."
    }
    return
  }

  throw "Port $Port is already in use by another process: $($process.Name) ($listenerPid)."
}

function Wait-Launcher($Port, $Seconds) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $status = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/launcher/status" -TimeoutSec 2
      if ($status.ok) {
        return $status
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

Ensure-VendoredRuntime
$nodeExe = Resolve-NodeExe
New-Item -ItemType Directory -Force $runtimeDir | Out-Null

Stop-ProcessByPidFile $launcherPidFile
Stop-StaleLauncher $Port $repoRoot
Remove-Item $launcherOut, $launcherErr -Force -ErrorAction SilentlyContinue

$launcherEnv = @{
  HOST = "127.0.0.1"
  LAUNCHER_PORT = "$Port"
  AGENT_HOST = "127.0.0.1"
  AGENT_PORT = "8123"
  NODE_BIN = $nodeExe
}

$launcher = Start-NodeProcess $nodeExe "launcher.js" $repoRoot $launcherOut $launcherErr $launcherEnv
$launcher.Id | Set-Content -Path $launcherPidFile -Encoding ASCII

$status = Wait-Launcher $Port 15
if (-not $status) {
  $stderr = ""
  if (Test-Path -LiteralPath $launcherErr) {
    $stderr = Get-Content -LiteralPath $launcherErr -Tail 80 | Out-String
  }
  throw "Weaknet launcher failed to become ready on port $Port.`n$stderr"
}

if ($OpenBrowser) {
  Start-Process "http://127.0.0.1:$Port" | Out-Null
}

Write-Host "Weaknet launcher started on http://127.0.0.1:$Port"
Write-Host "Node: $nodeExe"
Write-Host "PID: $($launcher.Id)"
