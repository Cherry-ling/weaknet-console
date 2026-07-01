# Weaknet Android VPN Agent

Internal APK for the Weaknet Console.

Current Stage 1 scope:

- Installs as `com.weaknet.agent`.
- Requests Android `VpnService` permission on the phone.
- Accepts adb service commands from the weaknet console.
- Supports `normal`, `100% packet-loss`, and SOCKS-backed tun2socks mode for one target package.

Current Stage 3 dataplane:

- The Android Agent captures the target package with `VpnService`.
- Non-100% profiles use `hev-socks5-tunnel` as tun2socks and forward traffic to the host weaknet console SOCKS proxy.
- The host weaknet console applies its local weaknet backend to the Android-to-host tunnel for latency, jitter, bandwidth, loss, and periodic blocking.

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
