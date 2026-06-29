# Windows driver adapter

This folder provides the Node-side adapter used by `server.js` on Windows:

- `buildWin32WeaknetConfig(input)` maps the existing weaknet profile shape to WinDivert rules.
- `startWin32Weaknet(input, options)` starts the standalone Windows shaper.
- `clearWin32Weaknet(options)` stops the standalone shaper process.
- `readWin32WeaknetStatus(options)` reads the backend status file.

Current scopes:

- `win-global`: Windows host global traffic.
- `win-gateway`: forwarded traffic for a test device IP.
- `win-target`: a target IPv4 or IPv4:port pair.
- `android-socks`: Android VPN Agent through a Windows SOCKS endpoint.

The adapter keeps the Windows backend separate from the existing macOS `pfctl`/`dnctl`
path. `server.js` chooses the backend by `process.platform`, so the macOS path
continues to use the existing implementation while Windows uses WinDivert.

Executable lookup order:

1. `WEAKNET_WIN32_SHAPER`
2. `windows-backend\dist\win-x64\Weaknet.WinDivertShaper.exe`
3. development publish output under `windows-backend\Weaknet.WinDivertShaper\bin`

Use `windows-backend\scripts\build-win32-package.ps1` to create the self-contained
`dist\win-x64` package with .NET runtime and WinDivert files bundled.
