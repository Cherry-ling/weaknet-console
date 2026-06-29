param(
  [string]$WinDivertDir = "",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
}

function Stop-OldBackend($PidFile) {
  if (-not (Test-Path $PidFile)) {
    return
  }

  $oldPid = Get-Content $PidFile -Raw
  $oldPid = $oldPid.Trim()
  if ($oldPid -match '^\d+$') {
    Write-Host "Stopping old backend process $oldPid ..."
    Stop-Process -Id ([int]$oldPid) -Force -ErrorAction SilentlyContinue
  }
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

function Copy-IfDifferent($Source, $DestinationDir) {
  $destination = Join-Path $DestinationDir (Split-Path -Leaf $Source)
  $sourcePath = [System.IO.Path]::GetFullPath($Source)
  $destinationPath = [System.IO.Path]::GetFullPath($destination)
  if ($sourcePath -ieq $destinationPath) {
    Write-Host "Already in place: $destinationPath"
    return
  }

  Copy-Item $Source $DestinationDir -Force
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$windowsBackendDir = Split-Path -Parent $scriptDir
$repoRoot = Split-Path -Parent $windowsBackendDir
$project = Join-Path $repoRoot "windows-backend\Weaknet.WinDivertShaper\Weaknet.WinDivertShaper.csproj"
$config = Join-Path $repoRoot "windows-backend\examples\global-3g.json"
$publishDir = Join-Path $repoRoot "windows-backend\Weaknet.WinDivertShaper\bin\Release\net8.0\win-x64\publish"
$exe = Join-Path $publishDir "Weaknet.WinDivertShaper.exe"
$runtimeDir = Join-Path $repoRoot "windows-backend\runtime"
$statusFile = Join-Path $runtimeDir "status.json"
$pidFile = Join-Path $runtimeDir "weaknet.pid"
$logFile = Join-Path $runtimeDir "weaknet.log"

Write-Step "Checking Administrator permission"
if (-not (Test-Admin)) {
  Write-Host "Please right-click PowerShell and choose 'Run as administrator', then run this script again." -ForegroundColor Yellow
  exit 1
}

Write-Step "Checking dotnet"
$dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
if (-not $dotnet) {
  Write-Host "dotnet was not found. Install .NET 8 SDK or newer first." -ForegroundColor Yellow
  exit 1
}
dotnet --version

if (-not $SkipBuild) {
  Write-Step "Building Windows backend"
  dotnet publish $project -f net8.0 -c Release -r win-x64 --self-contained false
}

Write-Step "Checking WinDivert files"
if ($WinDivertDir) {
  $dll = Join-Path $WinDivertDir "WinDivert.dll"
  $sys = Join-Path $WinDivertDir "WinDivert64.sys"
  if (-not (Test-Path $dll) -or -not (Test-Path $sys)) {
    Write-Host "WinDivertDir must contain WinDivert.dll and WinDivert64.sys." -ForegroundColor Yellow
    exit 1
  }
  Copy-IfDifferent $dll $publishDir
  Copy-IfDifferent $sys $publishDir
}

if (-not (Test-Path (Join-Path $publishDir "WinDivert.dll")) -or -not (Test-Path (Join-Path $publishDir "WinDivert64.sys"))) {
  Write-Host "Missing WinDivert.dll or WinDivert64.sys next to Weaknet.WinDivertShaper.exe." -ForegroundColor Yellow
  Write-Host "Run again with: -WinDivertDir C:\Path\To\WinDivert\x64"
  exit 1
}

Write-Step "Validating weaknet config"
& $exe validate --config $config

Write-Host ""
Write-Host "Setup looks good." -ForegroundColor Green
Write-Host "The next step will slow this Windows machine's network with the global 3G sample."
Write-Host "Type START to begin, or press Enter to stop here without changing the network."
$answer = Read-Host "Confirm"
if ($answer -ne "START") {
  Write-Host "Stopped before applying weaknet. No network rule is running."
  exit 0
}

Write-Step "Starting global 3G weaknet sample"
New-Item -ItemType Directory -Force $runtimeDir | Out-Null
Stop-OldBackend $pidFile
Remove-Item $statusFile -Force -ErrorAction SilentlyContinue
Remove-Item $logFile -Force -ErrorAction SilentlyContinue

$arguments = @(
  "run",
  "--config", $config,
  "--status", $statusFile,
  "--pid", $pidFile
)
$process = Start-Process -FilePath $exe -ArgumentList $arguments -PassThru -WindowStyle Minimized
Write-Host "Started backend process: $($process.Id)"
Start-Sleep -Seconds 3

Write-Step "Reading backend status"
if (Test-Path $statusFile) {
  Get-Content $statusFile -Raw
} else {
  Write-Host "No status file yet. Check $logFile if the backend exits."
}

Write-Step "Quick network check"
Write-Host "Running ping. You should see higher latency or packet loss compared with normal network."
ping 223.5.5.5 -n 4

Write-Host ""
Write-Host "Weaknet is still running now." -ForegroundColor Yellow
Write-Host "To stop it, run:"
Write-Host "  powershell -ExecutionPolicy Bypass -File .\windows-backend\scripts\stop-win32-backend.ps1"
