"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const DEFAULT_RUNTIME_DIR = path.join(os.tmpdir(), "weaknet-console-win32");
const DEFAULT_EXE = path.join(
  __dirname,
  "..",
  "..",
  "windows-backend",
  "Weaknet.WinDivertShaper",
  "bin",
  "Release",
  "net8.0",
  "Weaknet.WinDivertShaper.exe",
);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function readJsonIfExists(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function normalizeProfile(profile = {}) {
  return {
    presetKey: String(profile.presetKey || "custom"),
    displayNameZh: String(profile.displayNameZh || profile.displayName || "Windows weaknet"),
    latencyRttMs: profile.latencyRttMs ?? null,
    jitterMs: Number(profile.jitterMs || 0),
    packetLossPercent: Number(profile.packetLossPercent || 0),
    downloadKbps: profile.downloadKbps ?? null,
    uploadKbps: profile.uploadKbps ?? null,
    disconnectMode: String(profile.disconnectMode || "none"),
    disconnectDurationSec: Number(profile.disconnectDurationSec || 0),
    disconnectIntervalSec: Number(profile.disconnectIntervalSec || 0),
    networkWave: {
      enabled: Boolean(profile.networkWave && profile.networkWave.enabled),
      mode: String((profile.networkWave && profile.networkWave.mode) || "subway-elevator"),
    },
  };
}

function wrapFilter(filter) {
  return String(filter || "true").trim() || "true";
}

function ipFilter(ip, role) {
  if (!ip) throw new Error("deviceIp is required for this Windows weaknet scope");
  if (role === "src") return `ip and ip.SrcAddr == ${ip}`;
  if (role === "dst") return `ip and ip.DstAddr == ${ip}`;
  return `ip and (ip.SrcAddr == ${ip} or ip.DstAddr == ${ip})`;
}

function endpointFilters(targetEndpoint) {
  const raw = String(targetEndpoint || "").trim();
  if (!raw) throw new Error("targetEndpoint is required for win-target scope");
  const match = raw.match(/^([^:\s]+)(?::([0-9]{1,5}))?$/);
  if (!match) throw new Error("targetEndpoint must be an IPv4 address or IPv4:port for the first Windows backend");
  const host = match[1];
  const port = match[2] ? Number(match[2]) : null;
  const addressExpr = `ip and (ip.SrcAddr == ${host} or ip.DstAddr == ${host})`;
  const portExpr = port
    ? ` and (tcp.SrcPort == ${port} or tcp.DstPort == ${port} or udp.SrcPort == ${port} or udp.DstPort == ${port})`
    : "";
  return {
    upload: `outbound and ${addressExpr}${portExpr}`,
    download: `inbound and ${addressExpr}${portExpr}`,
  };
}

function buildWin32WeaknetConfig(input = {}) {
  const targetScope = String(input.targetScope || "win-global");
  const profile = normalizeProfile(input.profile);
  const rules = [];

  if (targetScope === "win-global" || targetScope === "mac-global") {
    rules.push({
      name: "win-global-upload",
      direction: "upload",
      layer: "network",
      filter: "outbound and !loopback and (ip or ipv6)",
    });
    rules.push({
      name: "win-global-download",
      direction: "download",
      layer: "network",
      filter: "inbound and !loopback and (ip or ipv6)",
    });
  } else if (targetScope === "win-gateway" || targetScope === "device" || targetScope === "macos") {
    const deviceIp = String(input.deviceIp || "").trim();
    rules.push({
      name: "win-gateway-upload",
      direction: "upload",
      layer: "network-forward",
      filter: wrapFilter(ipFilter(deviceIp, "src")),
    });
    rules.push({
      name: "win-gateway-download",
      direction: "download",
      layer: "network-forward",
      filter: wrapFilter(ipFilter(deviceIp, "dst")),
    });
  } else if (targetScope === "win-target" || targetScope === "mac-unity") {
    const filters = endpointFilters(input.targetEndpoint || input.targetApp);
    rules.push({
      name: "win-target-upload",
      direction: "upload",
      layer: "network",
      filter: filters.upload,
    });
    rules.push({
      name: "win-target-download",
      direction: "download",
      layer: "network",
      filter: filters.download,
    });
  } else if (targetScope === "android-socks") {
    const deviceIp = String(input.deviceIp || "").trim();
    const socksPort = Number(input.socksPort || 8124);
    const host = String(input.socksHost || input.winHost || "").trim();
    if (!host) throw new Error("socksHost is required for android-socks scope");
    rules.push({
      name: "android-socks-upload",
      direction: "upload",
      layer: "network",
      filter: `ip and ip.SrcAddr == ${deviceIp} and ip.DstAddr == ${host} and (tcp.DstPort == ${socksPort} or udp.DstPort == ${socksPort})`,
    });
    rules.push({
      name: "android-socks-download",
      direction: "download",
      layer: "network",
      filter: `ip and ip.SrcAddr == ${host} and ip.DstAddr == ${deviceIp} and (tcp.SrcPort == ${socksPort} or udp.SrcPort == ${socksPort})`,
    });
  } else {
    throw new Error(`Unsupported Windows weaknet targetScope: ${targetScope}`);
  }

  return {
    mode: targetScope,
    profile,
    statusIntervalMs: Number(input.statusIntervalMs || 1000),
    queue: {
      maxPacketSize: Number(input.maxPacketSize || 65535),
      winDivertQueueLength: Number(input.winDivertQueueLength || 8192),
      winDivertQueueSizeBytes: Number(input.winDivertQueueSizeBytes || 32 * 1024 * 1024),
      winDivertQueueTimeMs: Number(input.winDivertQueueTimeMs || 16000),
    },
    rules,
  };
}

function getRuntimePaths(options = {}) {
  const runtimeDir = options.runtimeDir || DEFAULT_RUNTIME_DIR;
  return {
    runtimeDir,
    configFile: options.configFile || path.join(runtimeDir, "weaknet-win32-config.json"),
    statusFile: options.statusFile || path.join(runtimeDir, "weaknet-win32-status.json"),
    pidFile: options.pidFile || path.join(runtimeDir, "weaknet-win32.pid"),
    logFile: options.logFile || path.join(runtimeDir, "weaknet-win32.log"),
  };
}

function startWin32Weaknet(input = {}, options = {}) {
  if (process.platform !== "win32" && !options.allowNonWindows) {
    throw new Error("Win32 weaknet backend can only be started on Windows.");
  }

  const executable = options.executable || process.env.WEAKNET_WIN32_SHAPER || DEFAULT_EXE;
  const paths = getRuntimePaths(options);
  const config = options.config || buildWin32WeaknetConfig(input);
  ensureDir(paths.runtimeDir);
  writeJson(paths.configFile, config);

  const out = fs.openSync(paths.logFile, "a");
  const child = spawn(
    executable,
    ["run", "--config", paths.configFile, "--status", paths.statusFile, "--pid", paths.pidFile],
    {
      detached: true,
      stdio: ["ignore", out, out],
      windowsHide: true,
    },
  );
  child.unref();

  return {
    ok: true,
    pid: child.pid,
    executable,
    config,
    ...paths,
  };
}

function clearWin32Weaknet(options = {}) {
  const paths = getRuntimePaths(options);
  const rawPid = fs.existsSync(paths.pidFile) ? fs.readFileSync(paths.pidFile, "utf8").trim() : "";
  const pid = Number(rawPid);
  if (!pid) {
    return { ok: true, alreadyStopped: true, message: "Windows weaknet backend is not running", ...paths };
  }

  try {
    process.kill(pid);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }

  try {
    fs.rmSync(paths.pidFile, { force: true });
  } catch {
  }

  return { ok: true, pid, message: "Windows weaknet backend stop requested", ...paths };
}

function readWin32WeaknetStatus(options = {}) {
  const paths = getRuntimePaths(options);
  return {
    ok: true,
    running: fs.existsSync(paths.pidFile),
    status: readJsonIfExists(paths.statusFile),
    ...paths,
  };
}

module.exports = {
  buildWin32WeaknetConfig,
  startWin32Weaknet,
  clearWin32Weaknet,
  readWin32WeaknetStatus,
};
