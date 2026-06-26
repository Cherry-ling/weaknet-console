# Weaknet Android VPN Agent

Internal APK for the Weaknet Console.

Current Stage 1 scope:

- Installs as `com.weaknet.agent`.
- Requests Android `VpnService` permission on the phone.
- Accepts adb service commands from the Mac console.
- Supports `normal`, `100% packet-loss`, and SOCKS-backed tun2socks mode for one target package.

Current Stage 3 dataplane:

- The Android Agent captures the target package with `VpnService`.
- Non-100% profiles use `hev-socks5-tunnel` as tun2socks and forward traffic to the Mac console SOCKS proxy.
- The Mac console applies `pf/dnctl` to the Android-to-Mac tunnel for latency, jitter, bandwidth, loss, and periodic blocking.

Build:

```sh
./android-agent/build-agent.sh
```

Output:

```txt
android-agent/dist/weaknet-agent-debug.apk
```
