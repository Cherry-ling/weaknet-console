param(
  [switch]$IncludeOptionalBuildPacks = $true,
  [string]$ManifestPath = ""
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-RepoRoot([string]$ScriptDir) {
  return [System.IO.Path]::GetFullPath((Join-Path $ScriptDir "..\.."))
}

function New-EmptyDirectory([string]$PathValue) {
  if (Test-Path -LiteralPath $PathValue) {
    Remove-Item -LiteralPath $PathValue -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $PathValue | Out-Null
}

function Copy-RelativeItem([string]$SourceRoot, [string]$RelativePath, [string]$StageRoot) {
  $sourcePath = Join-Path $SourceRoot $RelativePath
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Missing vendor source item: $sourcePath"
  }

  $destinationPath = Join-Path $StageRoot $RelativePath
  $destinationDir = if (Test-Path -LiteralPath $sourcePath -PathType Container) {
    $destinationPath
  } else {
    Split-Path -Parent $destinationPath
  }

  if ($destinationDir) {
    New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null
  }

  Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Recurse -Force
}

function New-ZipFromStage([string]$StageRoot, [string]$ArchivePath) {
  if (Test-Path -LiteralPath $ArchivePath) {
    Remove-Item -LiteralPath $ArchivePath -Force
  }
  [System.IO.Compression.ZipFile]::CreateFromDirectory($StageRoot, $ArchivePath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
}

function Copy-RootContents([string]$SourceRoot, [string]$StageRoot) {
  Get-ChildItem -LiteralPath $SourceRoot -Force | ForEach-Object {
    $destination = Join-Path $StageRoot $_.Name
    Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force
  }
}

function Get-FileSha256([string]$FilePath) {
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $FilePath).Hash.ToLowerInvariant()
}

function Update-ManifestPack([object]$ManifestObject, [string]$PackIdValue, [string]$Sha256, [long]$SizeBytes) {
  foreach ($pack in $ManifestObject.packs) {
    if ($pack.id -eq $PackIdValue) {
      $pack.sha256 = $Sha256
      $pack.sizeBytes = $SizeBytes
      return
    }
  }
  throw "Manifest pack id not found: $PackIdValue"
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Get-RepoRoot $scriptDir

if (-not $ManifestPath) {
  $ManifestPath = Join-Path $repoRoot "vendor-packs\manifest.json"
}

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$vendorPackDir = Split-Path -Parent $ManifestPath
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("weaknet-vendor-packs-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

$packSpecs = @(
  @{
    Id = "node-win-x64-runtime"
    SourceRoot = Join-Path $repoRoot "third_party\node\win-x64"
    ArchivePath = Join-Path $vendorPackDir "node-win-x64-runtime.zip"
    RelativeItems = @("node.exe")
  },
  @{
    Id = "android-platform-tools"
    SourceRoot = Join-Path $repoRoot "third_party\android\platform-tools"
    ArchivePath = Join-Path $vendorPackDir "android-platform-tools.zip"
    RelativeItems = @(".")
  },
  @{
    Id = "windows-backend-dist"
    SourceRoot = Join-Path $repoRoot "windows-backend\dist\win-x64"
    ArchivePath = Join-Path $vendorPackDir "windows-backend-dist-win-x64.zip"
    RelativeItems = @(".")
  }
)

if ($IncludeOptionalBuildPacks) {
  $packSpecs += @(
    @{
      Id = "jdk-win-x64-core"
      SourceRoot = Join-Path $repoRoot "third_party\jdk\win-x64"
      ArchivePath = Join-Path $vendorPackDir "jdk-win-x64-core.zip"
      RelativeItems = @("bin", "conf", "include", "legal", "NOTICE", "release", "lib\ct.sym", "lib\fontconfig.bfc", "lib\fontconfig.properties.src", "lib\jawt.lib", "lib\jfr", "lib\jvm.cfg", "lib\jvm.lib", "lib\psfont.properties.ja", "lib\psfontj2d.properties", "lib\security", "lib\server", "lib\client", "lib\tzdb.dat", "lib\tzmappings", "lib\jrt-fs.jar")
    },
    @{
      Id = "jdk-win-x64-lib-modules"
      SourceRoot = Join-Path $repoRoot "third_party\jdk\win-x64"
      ArchivePath = Join-Path $vendorPackDir "jdk-win-x64-lib-modules.zip"
      RelativeItems = @("lib\modules")
    },
    @{
      Id = "jdk-win-x64-lib-src"
      SourceRoot = Join-Path $repoRoot "third_party\jdk\win-x64"
      ArchivePath = Join-Path $vendorPackDir "jdk-win-x64-lib-src.zip"
      RelativeItems = @("lib\src.zip")
    },
    @{
      Id = "android-sdk-build-tools"
      SourceRoot = Join-Path $repoRoot "third_party\android\sdk"
      ArchivePath = Join-Path $vendorPackDir "android-sdk-build-tools.zip"
      RelativeItems = @("build-tools")
    },
    @{
      Id = "android-sdk-platforms"
      SourceRoot = Join-Path $repoRoot "third_party\android\sdk"
      ArchivePath = Join-Path $vendorPackDir "android-sdk-platforms.zip"
      RelativeItems = @("platforms")
    },
    @{
      Id = "android-sdk-licenses"
      SourceRoot = Join-Path $repoRoot "third_party\android\sdk"
      ArchivePath = Join-Path $vendorPackDir "android-sdk-licenses.zip"
      RelativeItems = @("licenses")
    }
  )
}

try {
  foreach ($spec in $packSpecs) {
    $stageDir = Join-Path $tempRoot $spec.Id
    New-EmptyDirectory $stageDir

    foreach ($relativeItem in $spec.RelativeItems) {
      if ($relativeItem -eq ".") {
        Copy-RootContents $spec.SourceRoot $stageDir
      } else {
        Copy-RelativeItem $spec.SourceRoot $relativeItem $stageDir
      }
    }

    New-ZipFromStage $stageDir $spec.ArchivePath
    $archiveItem = Get-Item -LiteralPath $spec.ArchivePath
    if ($archiveItem.Length -ge 95MB) {
      throw "Archive exceeded 95MB limit: $($archiveItem.FullName) ($([math]::Round($archiveItem.Length / 1MB, 2)) MB)"
    }

    Update-ManifestPack $manifest $spec.Id (Get-FileSha256 $spec.ArchivePath) $archiveItem.Length
    Write-Host ("Built {0} -> {1} ({2} MB)" -f $spec.Id, $archiveItem.Name, [math]::Round($archiveItem.Length / 1MB, 2))
  }
} finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}

$manifest | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $ManifestPath -Encoding UTF8
Write-Host "Updated manifest: $ManifestPath"
