param(
  [string]$WinDivertDir = "",
  [int]$RunSeconds = 20
)

$ErrorActionPreference = "Stop"

function Test-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
}

function Quote-Arg($Value) {
  return '"' + ($Value -replace '"', '\"') + '"'
}

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-WinDivertDir($Dir) {
  if (-not $Dir) {
    return $false
  }
  return (Test-Path (Join-Path $Dir "WinDivert.dll")) -and (Test-Path (Join-Path $Dir "WinDivert64.sys"))
}

function Find-WinDivertDir($RepoRoot, $PublishDir) {
  $candidates = @(
    $PublishDir,
    (Join-Path $RepoRoot "windows-backend\WinDivert\x64"),
    (Join-Path $RepoRoot "windows-backend\WinDivert"),
    (Join-Path $RepoRoot "third_party\WinDivert\x64"),
    (Join-Path $RepoRoot "third_party\WinDivert"),
    (Join-Path $RepoRoot "WinDivert\x64"),
    (Join-Path $RepoRoot "WinDivert")
  )

  foreach ($candidate in $candidates) {
    if (Test-WinDivertDir $candidate) {
      return $candidate
    }
  }

  $downloads = Join-Path $env:USERPROFILE "Downloads"
  if (Test-Path $downloads) {
    $dll = Get-ChildItem -Path $downloads -Filter "WinDivert.dll" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($dll) {
      $dir = $dll.DirectoryName
      if (Test-WinDivertDir $dir) {
        return $dir
      }
    }
  }

  return ""
}

function Stop-BackendByPidFile($PidFile) {
  if (-not (Test-Path $PidFile)) {
    return
  }

  $pidValue = (Get-Content $PidFile -Raw).Trim()
  if ($pidValue -match '^\d+$') {
    Stop-Process -Id ([int]$pidValue) -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped previous backend process $pidValue."
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

if (-not (Test-Admin)) {
  $argsList = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", (Quote-Arg $PSCommandPath),
    "-RunSeconds", $RunSeconds
  )
  if ($WinDivertDir) {
    $argsList += @("-WinDivertDir", (Quote-Arg $WinDivertDir))
  }

  Write-Host "Opening an Administrator PowerShell window..." -ForegroundColor Yellow
  Start-Process powershell -Verb RunAs -ArgumentList ($argsList -join " ")
  exit 0
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$windowsBackendDir = Split-Path -Parent $scriptDir
$repoRoot = Split-Path -Parent $windowsBackendDir
$project = Join-Path $repoRoot "windows-backend\Weaknet.WinDivertShaper\Weaknet.WinDivertShaper.csproj"
$config = Join-Path $repoRoot "windows-backend\examples\global-3g.json"
$publishDir = Join-Path $repoRoot "windows-backend\Weaknet.WinDivertShaper\bin\Release\net8.0\win-x64\publish"
$exe = Join-Path $publishDir "Weaknet.WinDivertShaper.exe"
$runtimeDir = Join-Path $repoRoot "windows-backend\runtime"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportFile = Join-Path $runtimeDir "win32-verify-report-$timestamp.txt"
$latestReport = Join-Path $runtimeDir "win32-verify-latest.txt"
$statusFile = Join-Path $runtimeDir "status.json"
$pidFile = Join-Path $runtimeDir "weaknet.pid"
$backendOut = Join-Path $runtimeDir "backend-$timestamp.out.log"
$backendErr = Join-Path $runtimeDir "backend-$timestamp.err.log"

New-Item -ItemType Directory -Force $runtimeDir | Out-Null

$startedTranscript = $false
$backendProcess = $null

try {
  Start-Transcript -Path $reportFile -Force | Out-Null
  $startedTranscript = $true

  Write-Host "Weaknet Windows one-click verification"
  Write-Host "Report file: $reportFile"
  Write-Host "Repo root: $repoRoot"
  Write-Host "Run seconds: $RunSeconds"

  Write-Step "Environment"
  Write-Host "User: $env:USERNAME"
  Write-Host "Computer: $env:COMPUTERNAME"
  Write-Host "OS:"
  Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, OSArchitecture | Format-List

  Write-Step "Checking dotnet"
  $dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
  if (-not $dotnet) {
    throw "dotnet was not found. Please install .NET 8 SDK or newer."
  }
  dotnet --version

  Write-Step "Publishing backend"
  dotnet publish $project -f net8.0 -c Release -r win-x64 --self-contained false
  if (-not (Test-Path $exe)) {
    throw "Publish completed but executable was not found: $exe"
  }

  Write-Step "Finding WinDivert"
  if (-not (Test-WinDivertDir $WinDivertDir)) {
    $WinDivertDir = Find-WinDivertDir $repoRoot $publishDir
  }
  while (-not (Test-WinDivertDir $WinDivertDir)) {
    Write-Host "Could not find WinDivert.dll and WinDivert64.sys automatically." -ForegroundColor Yellow
    Write-Host "Paste the folder path that contains both files, then press Enter."
    Write-Host "Example: C:\Users\you\Downloads\WinDivert-2.2.2-A\x64"
    $WinDivertDir = Read-Host "WinDivert folder"
  }
  Write-Host "Using WinDivert: $WinDivertDir"
  Copy-IfDifferent (Join-Path $WinDivertDir "WinDivert.dll") $publishDir
  Copy-IfDifferent (Join-Path $WinDivertDir "WinDivert64.sys") $publishDir

  Write-Step "Validating config"
  & $exe validate --config $config

  Write-Step "Starting 20-second global 3G sample"
  Stop-BackendByPidFile $pidFile
  Remove-Item $statusFile -Force -ErrorAction SilentlyContinue
  Remove-Item $backendOut -Force -ErrorAction SilentlyContinue
  Remove-Item $backendErr -Force -ErrorAction SilentlyContinue

  $arguments = @("run", "--config", $config, "--status", $statusFile, "--pid", $pidFile)
  $backendProcess = Start-Process -FilePath $exe -ArgumentList $arguments -PassThru -WindowStyle Hidden -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr
  Write-Host "Backend process id: $($backendProcess.Id)"
  Start-Sleep -Seconds 3

  Write-Step "Status after startup"
  if (Test-Path $statusFile) {
    Get-Content $statusFile -Raw
  } else {
    Write-Host "Status file was not created yet."
  }

  Write-Step "Ping check during weaknet"
  ping 223.5.5.5 -n 4

  $remaining = [Math]::Max(1, $RunSeconds - 3)
  Write-Step "Keeping sample active for $remaining more seconds"
  Start-Sleep -Seconds $remaining

  Write-Step "Final status before stopping"
  if (Test-Path $statusFile) {
    Get-Content $statusFile -Raw
  } else {
    Write-Host "Status file missing before stop."
  }
} catch {
  Write-Host ""
  Write-Host "Verification failed: $($_.Exception.Message)" -ForegroundColor Red
} finally {
  Write-Step "Stopping backend"
  if ($backendProcess -and -not $backendProcess.HasExited) {
    Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped backend process $($backendProcess.Id)."
  }
  Stop-BackendByPidFile $pidFile

  Write-Step "Backend stdout"
  if (Test-Path $backendOut) {
    Get-Content $backendOut -Raw
  } else {
    Write-Host "No backend stdout log."
  }

  Write-Step "Backend stderr"
  if (Test-Path $backendErr) {
    Get-Content $backendErr -Raw
  } else {
    Write-Host "No backend stderr log."
  }

  Write-Step "Report location"
  Write-Host $reportFile

  if ($startedTranscript) {
    Stop-Transcript | Out-Null
  }

  if (Test-Path $reportFile) {
    Copy-Item $reportFile $latestReport -Force
    try {
      Get-Content $reportFile -Raw | Set-Clipboard
      Write-Host ""
      Write-Host "Report copied to clipboard. Paste it back to Codex." -ForegroundColor Green
    } catch {
      Write-Host ""
      Write-Host "Could not copy to clipboard. Open this file and copy it:" -ForegroundColor Yellow
      Write-Host $reportFile
    }

    Write-Host ""
    Write-Host "Latest report file:"
    Write-Host $latestReport
  } else {
    Write-Host ""
    Write-Host "No report file was created. Please copy the visible PowerShell output instead." -ForegroundColor Yellow
  }
  Read-Host "Press Enter to close"
}
