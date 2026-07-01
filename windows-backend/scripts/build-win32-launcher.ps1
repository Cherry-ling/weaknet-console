param(
  [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$windowsBackendDir = Split-Path -Parent $scriptDir
$repoRoot = Split-Path -Parent $windowsBackendDir
$sourceFile = Join-Path $repoRoot "windows-backend\Weaknet.Console.Launcher\Program.cs"
$iconFile = Join-Path $repoRoot "assets\icons\WeakNetConsole.ico"
$compiler = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path -LiteralPath $compiler)) {
  $compiler = Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe"
}

if (-not $OutputDir) {
  $OutputDir = $repoRoot
}

if (-not (Test-Path -LiteralPath $compiler)) {
  throw "csc.exe was not found. Expected the .NET Framework compiler under $env:WINDIR\\Microsoft.NET."
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$exe = Join-Path $OutputDir "WeakNetConsole.exe"

& $compiler `
  /nologo `
  /target:winexe `
  /optimize+ `
  /out:$exe `
  /platform:x64 `
  /win32icon:$iconFile `
  /r:System.dll `
  /r:System.Core.dll `
  $sourceFile
if ($LASTEXITCODE -ne 0) {
  throw "csc compile failed for the Windows launcher."
}

if (-not (Test-Path -LiteralPath $exe)) {
  throw "Launcher build completed but executable was not found: $exe"
}

Get-Item -LiteralPath $exe | Select-Object FullName, Length, LastWriteTime | Format-List
