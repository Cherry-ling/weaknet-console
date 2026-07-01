param()

$ErrorActionPreference = "Stop"

function Get-NativePath([string]$PathValue) {
  return [System.IO.Path]::GetFullPath($PathValue)
}

function Get-FirstExistingPath([string[]]$Candidates) {
  foreach ($candidate in $Candidates) {
    if ([string]::IsNullOrWhiteSpace($candidate)) {
      continue
    }
    if (Test-Path $candidate) {
      return (Get-NativePath $candidate)
    }
  }
  return ""
}

function Test-AndroidSdk([string]$SdkPath) {
  if ([string]::IsNullOrWhiteSpace($SdkPath) -or -not (Test-Path $SdkPath)) {
    return $false
  }
  $androidJar = Get-LatestFile (Join-Path $SdkPath "platforms") "android.jar"
  $buildToolsDir = Get-LatestDirectory (Join-Path $SdkPath "build-tools")
  return -not [string]::IsNullOrWhiteSpace($androidJar) -and -not [string]::IsNullOrWhiteSpace($buildToolsDir)
}

function Get-FirstUsableAndroidSdk([string[]]$Candidates) {
  foreach ($candidate in $Candidates) {
    if ([string]::IsNullOrWhiteSpace($candidate)) {
      continue
    }
    $fullPath = Get-NativePath $candidate
    if (Test-AndroidSdk $fullPath) {
      return $fullPath
    }
  }
  return ""
}

function Get-LatestDirectory([string]$RootPath) {
  if (-not (Test-Path $RootPath)) {
    return ""
  }
  $directory = Get-ChildItem -Path $RootPath -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name |
    Select-Object -Last 1
  if (-not $directory) {
    return ""
  }
  return $directory.FullName
}

function Get-LatestFile([string]$RootPath, [string]$LeafName) {
  if (-not (Test-Path $RootPath)) {
    return ""
  }
  $file = Get-ChildItem -Path $RootPath -Recurse -Filter $LeafName -File -ErrorAction SilentlyContinue |
    Sort-Object FullName |
    Select-Object -Last 1
  if (-not $file) {
    return ""
  }
  return $file.FullName
}

function Resolve-BuildTool([string]$BuildToolsDir, [string]$ToolName) {
  if ([string]::IsNullOrWhiteSpace($BuildToolsDir)) {
    return ""
  }
  return Get-FirstExistingPath @(
    (Join-Path $BuildToolsDir "$ToolName.exe"),
    (Join-Path $BuildToolsDir "$ToolName.bat"),
    (Join-Path $BuildToolsDir $ToolName)
  )
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$EnsureVendoredDeps = Join-Path $RepoRoot "windows-backend\scripts\ensure-vendored-deps.ps1"
$VendoredJdkDir = Join-Path $RepoRoot "third_party\jdk\win-x64"
$VendoredSdkDir = Join-Path $RepoRoot "third_party\android\sdk"
$UnityEditorsRoot = "C:\Program Files\Unity\Hub\Editor"
$UnitySdkDir = ""
$UnityJdkDir = ""

if (Test-Path $UnityEditorsRoot) {
  $latestUnityEditor = Get-ChildItem -Path $UnityEditorsRoot -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name |
    Select-Object -Last 1
  if ($latestUnityEditor) {
    $UnitySdkDir = Join-Path $latestUnityEditor.FullName "Editor\Data\PlaybackEngines\AndroidPlayer\SDK"
    $UnityJdkDir = Join-Path $latestUnityEditor.FullName "Editor\Data\PlaybackEngines\AndroidPlayer\OpenJDK"
  }
}

if (Test-Path -LiteralPath $EnsureVendoredDeps) {
  try {
    & $EnsureVendoredDeps -Group android-build -Quiet
  } catch {
    throw "Failed to prepare vendored Android build dependencies. $($_.Exception.Message)"
  }
}

$SdkDir = Get-FirstUsableAndroidSdk @(
  $VendoredSdkDir,
  $env:ANDROID_HOME,
  $env:ANDROID_SDK_ROOT,
  (Join-Path $env:LOCALAPPDATA "Android\Sdk"),
  $UnitySdkDir
)

$JdkDir = Get-FirstExistingPath @(
  $VendoredJdkDir,
  $env:JBR_DIR,
  $env:JAVA_HOME,
  "C:\Program Files\Java\latest",
  "C:\Program Files\Java\jdk-26.0.1",
  $UnityJdkDir,
  "C:\Program Files\Android\Android Studio\jbr",
  "C:\Program Files\Android\Android Studio\jbr\Contents\Home"
)

if (-not $SdkDir) {
  throw "Missing Android SDK. Put it in third_party\android\sdk or install Android SDK / Unity Android SDK."
}
if (-not $JdkDir) {
  throw "Missing JDK. Expected vendored JDK under third_party\jdk\win-x64 or a local JDK install."
}

$AndroidJar = Get-LatestFile (Join-Path $SdkDir "platforms") "android.jar"
$BuildToolsDir = Get-LatestDirectory (Join-Path $SdkDir "build-tools")
if (-not $AndroidJar) {
  throw "Missing android.jar under SDK: $SdkDir"
}
if (-not $BuildToolsDir) {
  throw "Missing Android build-tools under SDK: $SdkDir"
}
$JavaBin = Get-FirstExistingPath @((Join-Path $JdkDir "bin\java.exe"))
$JavacBin = Get-FirstExistingPath @((Join-Path $JdkDir "bin\javac.exe"))
$KeytoolBin = Get-FirstExistingPath @((Join-Path $JdkDir "bin\keytool.exe"))
$JarBin = Get-FirstExistingPath @((Join-Path $JdkDir "bin\jar.exe"))
$Aapt2 = Resolve-BuildTool $BuildToolsDir "aapt2"
$D8 = Resolve-BuildTool $BuildToolsDir "d8"
$ApkSigner = Resolve-BuildTool $BuildToolsDir "apksigner"
$ZipAlign = Resolve-BuildTool $BuildToolsDir "zipalign"

$env:JAVA_HOME = $JdkDir
$env:PATH = "$(Join-Path $JdkDir "bin");$env:PATH"

$BuildDir = Join-Path $ScriptDir "build"
$DistDir = Join-Path $ScriptDir "dist"
$ClassesDir = Join-Path $BuildDir "classes"
$DexDir = Join-Path $BuildDir "dex"
$GenDir = Join-Path $BuildDir "generated"
$ResourcesZip = Join-Path $BuildDir "resources.zip"
$LinkedApk = Join-Path $BuildDir "linked.apk"
$UnsignedApk = Join-Path $BuildDir "weaknet-agent-unsigned.apk"
$AlignedApk = Join-Path $BuildDir "weaknet-agent-aligned.apk"
$SignedApk = Join-Path $DistDir "weaknet-agent-debug.apk"
$ClassesJar = Join-Path $BuildDir "classes.jar"
$SourcesList = Join-Path $BuildDir "sources.list"
$Keystore = Join-Path $ScriptDir "debug.keystore"

$RequiredTools = @($JavaBin, $JavacBin, $KeytoolBin, $JarBin, $AndroidJar, $Aapt2, $D8, $ApkSigner, $ZipAlign)
foreach ($tool in $RequiredTools) {
  if (-not $tool -or -not (Test-Path $tool)) {
    throw "Missing Android build dependency: $tool"
  }
}

Remove-Item -LiteralPath $BuildDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $ClassesDir, $DexDir, $GenDir, $DistDir | Out-Null

& $Aapt2 compile --dir (Get-NativePath (Join-Path $ScriptDir "res")) -o (Get-NativePath $ResourcesZip)
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed." }

& $Aapt2 link `
  -I (Get-NativePath $AndroidJar) `
  --manifest (Get-NativePath (Join-Path $ScriptDir "AndroidManifest.xml")) `
  --java (Get-NativePath $GenDir) `
  -o (Get-NativePath $LinkedApk) `
  (Get-NativePath $ResourcesZip)
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed." }

$SourceFiles = @()
foreach ($sourceRoot in @((Join-Path $ScriptDir "src\main\java"), $GenDir)) {
  if (Test-Path $sourceRoot) {
    $SourceFiles += Get-ChildItem -Path $sourceRoot -Recurse -Filter "*.java" -File | ForEach-Object { $_.FullName }
  }
}
[System.IO.File]::WriteAllLines($SourcesList, $SourceFiles, [System.Text.UTF8Encoding]::new($false))

& $JavacBin `
  -encoding UTF-8 `
  -source 8 `
  -target 8 `
  -bootclasspath (Get-NativePath $AndroidJar) `
  -d (Get-NativePath $ClassesDir) `
  "@$(Get-NativePath $SourcesList)"
if ($LASTEXITCODE -ne 0) { throw "javac failed." }

Push-Location $ClassesDir
try {
  & $JarBin cf (Get-NativePath $ClassesJar) .
  if ($LASTEXITCODE -ne 0) { throw "jar classes failed." }
} finally {
  Pop-Location
}

& $D8 --min-api 23 --lib (Get-NativePath $AndroidJar) --output (Get-NativePath $DexDir) (Get-NativePath $ClassesJar)
if ($LASTEXITCODE -ne 0) { throw "d8 failed." }

Copy-Item -LiteralPath $LinkedApk -Destination $UnsignedApk -Force
Push-Location $DexDir
try {
  & $JarBin uf (Get-NativePath $UnsignedApk) "classes.dex"
  if ($LASTEXITCODE -ne 0) { throw "jar dex merge failed." }
} finally {
  Pop-Location
}

$JniLibsDir = Join-Path $ScriptDir "jniLibs"
if (Test-Path $JniLibsDir) {
  $ApkLibDir = Join-Path $BuildDir "apk-lib"
  $ApkLibTarget = Join-Path $ApkLibDir "lib"
  New-Item -ItemType Directory -Force -Path $ApkLibTarget | Out-Null
  Copy-Item -Path (Join-Path $JniLibsDir "*") -Destination $ApkLibTarget -Recurse -Force
  Push-Location $ApkLibDir
  try {
    & $JarBin uf (Get-NativePath $UnsignedApk) "lib"
    if ($LASTEXITCODE -ne 0) { throw "jar jniLibs merge failed." }
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path $Keystore)) {
  & $KeytoolBin -genkeypair `
    -keystore (Get-NativePath $Keystore) `
    -storepass android `
    -keypass android `
    -alias weaknet-debug `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -dname "CN=Weaknet Agent Debug,O=Weaknet Console,C=CN" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "keytool failed." }
}

& $ZipAlign -f 4 (Get-NativePath $UnsignedApk) (Get-NativePath $AlignedApk)
if ($LASTEXITCODE -ne 0) { throw "zipalign failed." }

& $ApkSigner sign `
  --ks (Get-NativePath $Keystore) `
  --ks-pass pass:android `
  --key-pass pass:android `
  --ks-key-alias weaknet-debug `
  --out (Get-NativePath $SignedApk) `
  (Get-NativePath $AlignedApk)
if ($LASTEXITCODE -ne 0) { throw "apksigner sign failed." }

& $ApkSigner verify (Get-NativePath $SignedApk)
if ($LASTEXITCODE -ne 0) { throw "apksigner verify failed." }

Write-Output $SignedApk
