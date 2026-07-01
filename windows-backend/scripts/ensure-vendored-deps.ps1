param(
  [string[]]$PackId = @(),
  [string[]]$Group = @(),
  [switch]$Force,
  [switch]$Quiet,
  [string]$ManifestPath = ""
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Write-Step([string]$Message) {
  if (-not $Quiet) {
    Write-Host $Message
  }
}

function Get-RepoRoot([string]$ScriptDir) {
  return [System.IO.Path]::GetFullPath((Join-Path $ScriptDir "..\.."))
}

function Read-JsonFile([string]$PathValue) {
  return Get-Content -LiteralPath $PathValue -Raw | ConvertFrom-Json
}

function Resolve-PathUnderRoot([string]$RepoRoot, [string]$RelativePath) {
  return [System.IO.Path]::GetFullPath((Join-Path $RepoRoot $RelativePath))
}

function Test-KeyFilesPresent([string]$TargetRoot, [object[]]$KeyFiles) {
  foreach ($keyFile in $KeyFiles) {
    $candidate = Join-Path $TargetRoot ([string]$keyFile)
    if (-not (Test-Path -LiteralPath $candidate)) {
      return $false
    }
  }
  return $true
}

function Get-StatePath([string]$RepoRoot, [string]$StateRoot, [string]$PackIdValue) {
  $root = Resolve-PathUnderRoot $RepoRoot $StateRoot
  New-Item -ItemType Directory -Force -Path $root | Out-Null
  return Join-Path $root "$PackIdValue.json"
}

function Get-FileSha256([string]$FilePath) {
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $FilePath).Hash.ToLowerInvariant()
}

function Expand-ZipArchive([string]$ArchivePath, [string]$DestinationPath) {
  $zip = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
  try {
    foreach ($entry in $zip.Entries) {
      $targetPath = [System.IO.Path]::GetFullPath((Join-Path $DestinationPath $entry.FullName))
      if ($entry.FullName.EndsWith('/')) {
        New-Item -ItemType Directory -Force -Path $targetPath | Out-Null
        continue
      }

      $targetDir = Split-Path -Parent $targetPath
      if ($targetDir) {
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
      }
      [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $targetPath, $true)
    }
  } finally {
    $zip.Dispose()
  }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Get-RepoRoot $scriptDir

if (-not $ManifestPath) {
  $ManifestPath = Join-Path $repoRoot "vendor-packs\manifest.json"
}

$manifest = Read-JsonFile $ManifestPath
$stateRoot = if ($manifest.stateRoot) { [string]$manifest.stateRoot } else { ".vendor-state/packs" }

$selectedPacks = @()
if ($PackId.Count -gt 0) {
  foreach ($id in $PackId) {
    $selectedPacks += @($manifest.packs | Where-Object { $_.id -eq $id })
  }
} else {
  $groups = @()
  if ($Group.Count -gt 0) {
    $groups = $Group
  } elseif ($manifest.defaultGroups) {
    $groups = @($manifest.defaultGroups)
  }

  foreach ($groupName in $groups) {
    $selectedPacks += @(
      $manifest.packs | Where-Object {
        $_.groups -and (@($_.groups) -contains $groupName)
      }
    )
  }
}

$selectedPacks = @($selectedPacks | Group-Object id | ForEach-Object { $_.Group[0] })

if ($selectedPacks.Count -eq 0) {
  throw "No vendor packs matched the requested PackId/Group selection."
}

$ensured = @()
foreach ($pack in $selectedPacks) {
  $packIdValue = [string]$pack.id
  $archiveRelative = [string]$pack.archive
  $targetRelative = [string]$pack.targetPath
  $archivePath = Resolve-PathUnderRoot $repoRoot $archiveRelative
  $targetPath = Resolve-PathUnderRoot $repoRoot $targetRelative
  $statePath = Get-StatePath $repoRoot $stateRoot $packIdValue

  if (-not (Test-Path -LiteralPath $archivePath)) {
    throw "Required vendor pack archive is missing: $archiveRelative"
  }

  $expectedSha = [string]$pack.sha256
  $currentSha = Get-FileSha256 $archivePath
  if ($expectedSha -and $expectedSha -ne $currentSha) {
    throw "Vendor pack sha256 mismatch for $packIdValue. Expected $expectedSha but found $currentSha."
  }

  $keyFilesPresent = Test-KeyFilesPresent $targetPath @($pack.keyFiles)
  $state = $null
  if (Test-Path -LiteralPath $statePath) {
    try {
      $state = Read-JsonFile $statePath
    } catch {
      $state = $null
    }
  }

  $stateMatches =
    $state -and
    $state.sha256 -eq $currentSha -and
    $state.version -eq [string]$pack.version -and
    $state.archive -eq $archiveRelative

  if (-not $Force -and $keyFilesPresent -and $stateMatches) {
    Write-Step "Vendor pack OK: $packIdValue"
    $ensured += [pscustomobject]@{
      id = $packIdValue
      archive = $archiveRelative
      targetPath = $targetRelative
      extracted = $false
      sha256 = $currentSha
    }
    continue
  }

  if (-not $Force -and $keyFilesPresent -and -not $stateMatches) {
    [pscustomobject]@{
      id = $packIdValue
      version = [string]$pack.version
      archive = $archiveRelative
      sha256 = $currentSha
      extractedAt = (Get-Date).ToString("o")
      adoptedExistingFiles = $true
    } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $statePath -Encoding UTF8

    Write-Step "Vendor pack adopted without extraction: $packIdValue"
    $ensured += [pscustomobject]@{
      id = $packIdValue
      archive = $archiveRelative
      targetPath = $targetRelative
      extracted = $false
      sha256 = $currentSha
      adoptedExistingFiles = $true
    }
    continue
  }

  Write-Step "Extracting vendor pack: $packIdValue"
  New-Item -ItemType Directory -Force -Path $targetPath | Out-Null
  Expand-ZipArchive $archivePath $targetPath

  if (-not (Test-KeyFilesPresent $targetPath @($pack.keyFiles))) {
    throw "Vendor pack extraction finished but key files are still missing for $packIdValue."
  }

  [pscustomobject]@{
    id = $packIdValue
    version = [string]$pack.version
    archive = $archiveRelative
    sha256 = $currentSha
    extractedAt = (Get-Date).ToString("o")
  } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $statePath -Encoding UTF8

  $ensured += [pscustomobject]@{
    id = $packIdValue
    archive = $archiveRelative
    targetPath = $targetRelative
    extracted = $true
    sha256 = $currentSha
  }
}

$result = [pscustomobject]@{
  ok = $true
  repoRoot = $repoRoot
  manifest = $ManifestPath
  packs = $ensured
}

if (-not $Quiet) {
  $result | ConvertTo-Json -Depth 20
}
