param(
  [Parameter(Mandatory = $true)]
  [string]$PlatformToolsDir
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$windowsBackendDir = Split-Path -Parent $scriptDir
$repoRoot = Split-Path -Parent $windowsBackendDir
$sourceDir = [System.IO.Path]::GetFullPath($PlatformToolsDir)
$targetDir = Join-Path $repoRoot "third_party\android\platform-tools"

if (-not (Test-Path (Join-Path $sourceDir "adb.exe"))) {
  throw "PlatformToolsDir must contain adb.exe. Example: C:\Users\you\Downloads\platform-tools\platform-tools"
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
Copy-Item -Path (Join-Path $sourceDir "*") -Destination $targetDir -Recurse -Force

Write-Host ""
Write-Host "Vendored Android platform-tools into project:" -ForegroundColor Green
Write-Host $targetDir
