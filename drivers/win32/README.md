# Windows driver adapter

This folder is intentionally not wired into `server.js` yet.

It provides the Node-side adapter that the current UI/API can call later:

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
path until the UI integration step.
