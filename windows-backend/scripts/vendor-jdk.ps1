param(
  [string]$SourceJdk = "C:\Program Files\Java\latest",
  [string]$TargetJdk = "E:\weaknet-console\third_party\jdk\win-x64"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $SourceJdk)) {
  throw "Source JDK not found: $SourceJdk"
}

if (-not (Test-Path (Join-Path $SourceJdk "bin\java.exe"))) {
  throw "Source JDK is missing bin\\java.exe: $SourceJdk"
}

New-Item -ItemType Directory -Force -Path (Split-Path $TargetJdk -Parent) | Out-Null
if (Test-Path $TargetJdk) {
  Remove-Item -Recurse -Force $TargetJdk
}

Copy-Item -Recurse -Force $SourceJdk $TargetJdk
Write-Host "Vendored JDK ready at $TargetJdk"
