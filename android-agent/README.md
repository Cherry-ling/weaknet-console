# Weaknet Android VPN Agent

Internal APK for the Weaknet Console.

Current Stage 1 scope:

- Installs as `com.weaknet.agent`.
- Requests Android `VpnService` permission on the phone.
- Can run standalone from the phone UI: select or enter a target package, confirm it, choose a local preset, apply, clear, and watch live local status.
- Still accepts adb service commands from the weaknet console for install/apply/clear/status compatibility.
- Supports `normal`, `100% packet-loss`, host SOCKS-backed tun2socks mode, and Android-local weaknet mode for one target package.

Current Stage 3 dataplane:

- The Android Agent captures the target package with `VpnService`.
- Non-100% profiles use `hev-socks5-tunnel` as tun2socks and forward traffic to the host weaknet console SOCKS proxy.
- The host weaknet console applies its local weaknet backend to the Android-to-host tunnel for latency, jitter, bandwidth, loss, and periodic blocking.

Android-local dataplane:

- The host console installs/updates the shared APK and can clear/read `status.json`; the phone UI can apply local profiles without a computer.
- The APK starts a local SOCKS5 shaper on `127.0.0.1`, points tun2socks to that local endpoint, and applies latency, jitter, bandwidth, loss, and periodic blocking on the phone.
- This mode does not start the host SOCKS proxy, macOS `pf/dnctl`, or Windows WinDivert.

Build:

```sh
./android-agent/build-agent.sh
```

Windows build:

```powershell
powershell -ExecutionPolicy Bypass -File .\android-agent\build-agent.ps1
```

Output:

```txt
android-agent/dist/weaknet-agent-debug.apk
```
