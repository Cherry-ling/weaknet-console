param(
  [Parameter(Mandatory = $true)]
  [string]$SourceSdk,
  [string]$TargetSdk = "E:\weaknet-console\third_party\android\sdk"
)

$ErrorActionPreference = "Stop"

$sourceDir = [System.IO.Path]::GetFullPath($SourceSdk)
$targetDir = [System.IO.Path]::GetFullPath($TargetSdk)

if (-not (Test-Path $sourceDir)) {
  throw "Source Android SDK not found: $sourceDir"
}

if (-not (Test-Path (Join-Path $sourceDir "platforms"))) {
  throw "Source Android SDK is missing platforms/: $sourceDir"
}

if (-not (Test-Path (Join-Path $sourceDir "build-tools"))) {
  throw "Source Android SDK is missing build-tools/: $sourceDir"
}

New-Item -ItemType Directory -Force -Path (Split-Path $targetDir -Parent) | Out-Null
if (Test-Path $targetDir) {
  Remove-Item -Recurse -Force $targetDir
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

$foldersToCopy = @("platforms", "build-tools", "platform-tools", "licenses")
foreach ($folder in $foldersToCopy) {
  $from = Join-Path $sourceDir $folder
  if (Test-Path $from) {
    Copy-Item -Recurse -Force $from (Join-Path $targetDir $folder)
  }
}

Write-Host ""
Write-Host "Vendored Android SDK into project:" -ForegroundColor Green
Write-Host $targetDir
