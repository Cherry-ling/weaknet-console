param(
  [string]$SourceNodeDir = "C:\Program Files\nodejs",
  [string]$TargetNodeDir = "E:\weaknet-console\third_party\node\win-x64"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $SourceNodeDir)) {
  throw "Source Node.js directory not found: $SourceNodeDir"
}

if (-not (Test-Path (Join-Path $SourceNodeDir "node.exe"))) {
  throw "Source Node.js directory must contain node.exe: $SourceNodeDir"
}

New-Item -ItemType Directory -Force -Path (Split-Path $TargetNodeDir -Parent) | Out-Null
if (Test-Path $TargetNodeDir) {
  Remove-Item -Recurse -Force $TargetNodeDir
}

Copy-Item -Recurse -Force $SourceNodeDir $TargetNodeDir
Write-Host "Vendored Node.js ready at $TargetNodeDir"
