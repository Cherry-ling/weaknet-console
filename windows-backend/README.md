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

## Build on Windows for development

Install .NET 8 or newer SDK, then run:

```powershell
dotnet publish .\windows-backend\Weaknet.WinDivertShaper\Weaknet.WinDivertShaper.csproj -f net8.0 -c Release -r win-x64 --self-contained false
```

Put `WinDivert.dll` and the matching `WinDivert64.sys` next to the published
`Weaknet.WinDivertShaper.exe`, or make `WinDivert.dll` available on `PATH`.

Run from an elevated terminal:

```powershell
.\windows-backend\Weaknet.WinDivertShaper\bin\Release\net8.0\win-x64\publish\Weaknet.WinDivertShaper.exe validate --config .\windows-backend\examples\global-3g.json
.\windows-backend\Weaknet.WinDivertShaper\bin\Release\net8.0\win-x64\publish\Weaknet.WinDivertShaper.exe run --config .\windows-backend\examples\global-3g.json --status .\status.json --pid .\weaknet.pid
```

## Build a user package

For a distributable backend that does not require end users to install .NET,
run this on a Windows build machine:

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

Start the Windows console service from an elevated shell, or double-click:

```text
windows-backend\scripts\open-weaknet-win32.cmd
```

The current console UI is still served by Node `server.js`; this package removes
the separate .NET/WinDivert setup burden, not the Node-based app shell.

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
