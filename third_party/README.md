# Vendored runtime dependencies

This project prefers repo-local runtime dependencies before falling back to
machine-wide installs.

For Git-friendly distribution, the committed form is now `vendor-packs/*.zip`
plus `vendor-packs/manifest.json`. Runtime scripts restore the unpacked layout
on demand before using these paths.

## Windows

- `node/win-x64`
  - vendored Node.js runtime for `windows-backend/scripts/run-weaknet-service.ps1`
- `jdk/win-x64`
  - vendored JDK for `android-agent/build-agent.ps1`
- `android/sdk`
  - vendored Android SDK subset for `android-agent/build-agent.ps1`
- `android/platform-tools`
  - vendored `adb.exe` used by `server.js` and `open-weaknet-win32.cmd`

## Existing packaged runtime

- `windows-backend/dist/win-x64`
  - self-contained Windows weaknet backend plus WinDivert files

## Pack groups

- `runtime`
  - restored before the Windows launcher or Windows service starts
  - includes Node runtime, Android platform-tools, and the WinDivert backend
- `android-build`
  - restored only when rebuilding `android-agent/dist/weaknet-agent-debug.apk`
  - includes vendored JDK and Android SDK subset

## Notes

- Windows weaknet still requires Administrator permission when loading the
  WinDivert driver.
- If repo-local dependencies are missing, the code falls back to common local
  installs such as Node.js, Android SDK, Android Studio, Unity Android SDK, or
  system `adb`.
