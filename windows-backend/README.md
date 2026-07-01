# Windows weaknet backend

This is the Windows implementation track for the weaknet console. It is added as a
standalone backend so the existing macOS functionality keeps using its current
`pfctl`/`dnctl` path.

## What it does

`Weaknet.WinDivertShaper` uses WinDivert to capture matching packets, then applies:

- one-way delay derived from the existing RTT profile
- jitter
- packet loss
- upload/download rate pacing
- 100 percent block mode
- periodic disconnect
- network wave mode

The process runs until it is stopped. Clearing weaknet is process stop plus status cleanup.

## Vendored dependencies

The repo now prefers project-local dependencies first, but the Git-friendly form
to commit is `vendor-packs/*.zip`, not the unpacked directories themselves.

At runtime the Windows launcher and service first ensure the required packs are
expanded back into the paths the existing code expects:

- `third_party/node/win-x64`
- `third_party/android/platform-tools`
- `windows-backend/dist/win-x64`

For Android Agent rebuilds, the build script lazily expands the optional build
packs back into:

- `third_party/jdk/win-x64`
- `third_party/android/sdk`

The pack catalog lives in:

```text
vendor-packs/manifest.json
```

and is maintained by:

```powershell
powershell -ExecutionPolicy Bypass -File .\windows-backend\scripts\build-vendor-packs.ps1
```

The generated zip files all stay below the GitHub 100 MB single-file limit.

The repo-local dependency search order still favors these restored locations, so
teammates can reuse the Windows flow without installing a full toolchain manually:

- `third_party/node/win-x64`: vendored Node.js runtime for the local console service
- `third_party/jdk/win-x64`: vendored JDK for Android Agent build
- `third_party/android/sdk`: vendored Android SDK subset for Android Agent build
- `third_party/android/platform-tools`: vendored `adb.exe` and friends
- `windows-backend/dist/win-x64`: self-contained WinDivert backend package

Windows still requires **Administrator** permission when the app loads the
WinDivert driver. That part cannot be removed by packaging.

`windows-backend/.runtime`, `windows-backend/runtime`, `bin`, and `obj` are
local runtime/build outputs and should not be part of the user package.

To vendor local Android platform-tools into the repo:

```powershell
powershell -ExecutionPolicy Bypass -File .\windows-backend\scripts\vendor-android-tools.ps1 -PlatformToolsDir C:\Path\To\platform-tools
```

To vendor a local Android SDK into the repo:

```powershell
powershell -ExecutionPolicy Bypass -File .\windows-backend\scripts\vendor-android-sdk.ps1 -SourceSdk C:\Path\To\Android\Sdk
```

To vendor a local JDK into the repo:

```powershell
powershell -ExecutionPolicy Bypass -File .\windows-backend\scripts\vendor-jdk.ps1 -SourceJdk C:\Path\To\jdk
```

To vendor a local Node.js runtime into the repo:

```powershell
powershell -ExecutionPolicy Bypass -File .\windows-backend\scripts\vendor-node.ps1 -SourceNodeDir "C:\Program Files\nodejs"
```

For Android Agent builds, prefer an Android-compatible JDK such as Unity
OpenJDK or Android Studio JBR.

## Build on Windows for development

Install .NET 8 or newer SDK only if you need to rebuild the Windows backend from
source. End users can run the packaged backend directly.

```powershell
dotnet publish .\windows-backend\Weaknet.WinDivertShaper\Weaknet.WinDivertShaper.csproj -f net8.0 -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -p:DebugType=none -p:DebugSymbols=false
```

Put `WinDivert.dll` and the matching `WinDivert64.sys` next to the published
`Weaknet.WinDivertShaper.exe`, or make `WinDivert.dll` available on `PATH`.

Run from an elevated terminal:

```powershell
.\windows-backend\Weaknet.WinDivertShaper\bin\Release\net8.0\win-x64\publish\Weaknet.WinDivertShaper.exe validate --config .\windows-backend\examples\global-3g.json
.\windows-backend\Weaknet.WinDivertShaper\bin\Release\net8.0\win-x64\publish\Weaknet.WinDivertShaper.exe run --config .\windows-backend\examples\global-3g.json --status .\status.json --pid .\weaknet.pid
```

## Build a user package

For a distributable backend that does not require end users to install .NET for
the WinDivert backend, run this on a Windows build machine:

```powershell
powershell -ExecutionPolicy Bypass -File .\windows-backend\scripts\build-win32-package.ps1 -WinDivertDir C:\Path\To\WinDivert\x64
```

The package is written to:

```text
windows-backend\dist\win-x64
```

It contains a self-contained `Weaknet.WinDivertShaper.exe` plus
`WinDivert.dll` and `WinDivert64.sys`. End users do not need to install .NET SDK,
.NET Runtime, or download WinDivert manually for this backend. They still need to
run the weaknet service as Administrator because Windows requires administrator
permission to load the WinDivert driver.

Build the user-facing Windows launcher exe with:

```powershell
powershell -ExecutionPolicy Bypass -File .\windows-backend\scripts\build-win32-launcher.ps1
```

This writes a tiny WinExe to:

```text
WeakNetConsole.exe
```

The intended user flow is now:

1. User double-clicks `WeakNetConsole.exe`.
2. The launcher ensures runtime vendor packs are expanded.
3. It starts or refreshes the 8122 launcher page.
4. It opens `http://127.0.0.1:8122/`.
5. UAC is only triggered later when the page asks to authorize the 8123 service.

The exe is the primary user-facing entrypoint. You can still fall back to the
scripts under `windows-backend\scripts`:

```text
windows-backend\scripts\open-weaknet-win32.cmd
```

The current console UI is still served by Node `server.js`. The Windows startup
path now ensures the vendored runtime first and then uses the vendored Node.js
runtime strictly, so normal users do not need a machine-wide Node install.

The console normally installs `android-agent\dist\weaknet-agent-debug.apk`
directly. It only rebuilds the Android Agent when that APK is missing or when a
developer explicitly sets `WEAKNET_BUILD_ANDROID_AGENT=1` or
`WEAKNET_REBUILD_ANDROID_AGENT=1`. On Windows, that rebuild uses
`android-agent\build-agent.ps1`, so it does not depend on Git Bash anymore.

## Integration boundary

The UI calls the existing `/api/weaknet/apply`, `/api/weaknet/clear`, and
`/api/network/status` endpoints. On macOS those endpoints still use
`pfctl`/`dnctl`; on Windows the same endpoints route through
`drivers/win32/win32-driver.js` and this backend.

## Guided verification

The easiest path is the one-click verifier. Double-click:

```text
windows-backend\scripts\one-click-win32-verify.cmd
```

It opens an Administrator PowerShell window, builds the backend, finds or asks
for WinDivert, runs a short global 3G sample, stops it, and copies the report to
your clipboard. Paste that report back into Codex.

For a simpler first run on Windows, open PowerShell as Administrator and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\windows-backend\scripts\verify-win32-backend.ps1 -WinDivertDir C:\Path\To\WinDivert\x64
```

The script builds the backend, checks `WinDivert.dll` and `WinDivert64.sys`,
validates the sample config, then asks you to type `START` before it changes
the network.

Stop the running sample with:

```powershell
powershell -ExecutionPolicy Bypass -File .\windows-backend\scripts\stop-win32-backend.ps1
```
