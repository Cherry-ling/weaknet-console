#!/usr/bin/env node

const http = require("node:http");
const net = require("node:net");
const dgram = require("node:dgram");
const dns = require("node:dns").promises;
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile, spawn } = require("node:child_process");
const win32Weaknet = require("./drivers/win32/win32-driver");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8123);
const HOST = process.env.HOST || "127.0.0.1";
const HOST_PLATFORM = process.platform;
const IS_WIN32 = HOST_PLATFORM === "win32";
const ADB_POLICY = resolveAdbPolicy();
const ADB = resolveAdbBinary();
const PFCTL = process.env.PFCTL || "pfctl";
const DNCTL = process.env.DNCTL || "dnctl";
const WEAKNET_ANCHOR = "weaknet_lab";
const PIPE_DOWN = 61001;
const PIPE_UP = 61002;
const SOCKS_PORT = Number(process.env.SOCKS_PORT || 8124);
const NETWORK_WAVE_CONFIG = {
  mode: "subway-elevator",
  initial: {
    downloadKbps: 500,
    uploadKbps: 200,
    pipeDelayMs: 100,
    packetLossPercent: 2,
  },
  normal: {
    downloadMinKbps: 50,
    downloadMaxKbps: 3000,
    uploadMinKbps: 20,
    uploadMaxKbps: 1000,
    delayMinMs: 30,
    delayMaxMs: 400,
    packetLossMinPercent: 0,
    packetLossMaxPercent: 5,
  },
  signalLost: {
    chance: 0.15,
    downloadMinKbps: 5,
    downloadMaxKbps: 30,
    uploadMinKbps: 2,
    uploadMaxKbps: 15,
    delayMinMs: 500,
    delayMaxMs: 1200,
    packetLossMinPercent: 10,
    packetLossMaxPercent: 30,
  },
  intervalMinMs: 800,
  intervalMaxMs: 2000,
};
const MAC_UNITY_TARGETS_FILE = path.join(ROOT, "mac-unity-targets.json");
const THEME_PREF_FILE = process.env.WEAKNET_THEME_PREF_FILE || path.join(os.homedir(), ".weaknet-console-theme.json");
const THEME_KEYS = new Set(["terminal-aurora", "cyber", "classic"]);
const SOURCE_SIGNATURE_ITEMS = ["index.html", "app.js", "styles.css", "server.js", "mac-unity-targets.json"];
const ANDROID_VPN_AGENT = {
  packageName: "com.weaknet.agent",
  versionCode: 11,
  activityComponent: "com.weaknet.agent/.MainActivity",
  receiverComponent: "com.weaknet.agent/.CommandReceiver",
  apkPath: path.join(ROOT, "android-agent", "dist", "weaknet-agent-debug.apk"),
  buildScript: path.join(ROOT, "android-agent", "build-agent.sh"),
  buildScriptWin32: path.join(ROOT, "android-agent", "build-agent.ps1"),
  statusFile: "files/status.json",
  actions: {
    apply: "com.weaknet.agent.APPLY",
    stop: "com.weaknet.agent.STOP",
  },
};
const ANDROID_PACKAGE_RE = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/;
const WIN32_RUNTIME_DIR =
  process.env.WEAKNET_WIN32_RUNTIME_DIR || path.join(ROOT, "windows-backend", "runtime", "ui");

const weaknetRuntime = {
  generation: 0,
  periodicInterval: null,
  periodicTimeout: null,
  jitterInterval: null,
  blocked: false,
  active: false,
  activeProfile: null,
  currentPipeProfile: null,
  startedAt: null,
  activeMode: "normal",
};

const socksRuntime = {
  active: false,
  server: null,
  udpSocket: null,
  udpRelaySocket: null,
  tcpSockets: new Set(),
  udpClients: new Map(),
  udpTargets: new Map(),
  port: SOCKS_PORT,
  bindHost: "0.0.0.0",
  advertisedHost: "",
  allowedIp: "",
  counters: createSocksCounters(),
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function resolveAdbBinary() {
  if (process.env.ADB) return process.env.ADB;
  if (!IS_WIN32) return "adb";

  const vendoredAdb = path.join(ROOT, "third_party", "android", "platform-tools", "adb.exe");
  const candidates = [
    vendoredAdb,
    process.env.ANDROID_SDK_ROOT && path.join(process.env.ANDROID_SDK_ROOT, "platform-tools", "adb.exe"),
    process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, "platform-tools", "adb.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Android", "Sdk", "platform-tools", "adb.exe"),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Android", "Android Studio", "platform-tools", "adb.exe"),
    process.env["ProgramFiles(x86)"] &&
      path.join(process.env["ProgramFiles(x86)"], "Android", "Android Studio", "platform-tools", "adb.exe"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {}
  }

  if (ADB_POLICY.requireVendored && !fs.existsSync(vendoredAdb)) {
    throw new Error(`Vendored adb.exe is required but missing: ${vendoredAdb}`);
  }

  return "adb";
}

function resolveAdbPolicy() {
  return {
    requireVendored: process.env.WEAKNET_REQUIRE_VENDORED_ADB === "1",
  };
}

function createSourceSignature(root) {
  return SOURCE_SIGNATURE_ITEMS.map((item) => {
    const source = path.join(root, item);
    try {
      const stat = fs.statSync(source);
      return `${item}:${stat.size}:${Math.trunc(stat.mtimeMs)}`;
    } catch {
      return `${item}:missing`;
    }
  }).join("|");
}

function getSourceSignature() {
  return process.env.WEAKNET_SOURCE_SIGNATURE || createSourceSignature(ROOT);
}

function setCommonHeaders(res, type = "application/json; charset=utf-8") {
  res.setHeader("Content-Type", type);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, payload, statusCode = 200) {
  setCommonHeaders(res);
  res.writeHead(statusCode);
  res.end(JSON.stringify(payload));
}

function normalizeTheme(theme) {
  return THEME_KEYS.has(theme) ? theme : "";
}

function readThemePreference() {
  try {
    const data = JSON.parse(fs.readFileSync(THEME_PREF_FILE, "utf8"));
    return normalizeTheme(data.theme);
  } catch {
    return "";
  }
}

function writeThemePreference(theme) {
  const nextTheme = normalizeTheme(theme);
  if (!nextTheme) return "";
  fs.writeFileSync(THEME_PREF_FILE, JSON.stringify({ theme: nextTheme }, null, 2));
  return nextTheme;
}

function run(command, args, timeoutMs = 5000) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 8 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: stdout || "",
        stderr: stderr || "",
        error: error ? error.message : "",
      });
    });
  });
}

function runWithInput(command, args, input = "", timeoutMs = 5000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const settle = (payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(payload);
    };

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      settle({ ok: false, stdout, stderr, error: `timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      settle({ ok: false, stdout, stderr, error: error.message });
    });
    child.on("close", (code) => {
      settle({
        ok: code === 0,
        stdout,
        stderr,
        error: code === 0 ? "" : stderr.trim() || `exit code ${code}`,
      });
    });

    child.stdin.end(input);
  });
}

function withPrivilege(command, args) {
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    return { command, args };
  }
  return { command: "sudo", args: ["-n", command, ...args] };
}

function isRootProcess() {
  return typeof process.getuid === "function" && process.getuid() === 0;
}

async function getWindowsPrivilegeStatus() {
  const script = [
    "$identity = [Security.Principal.WindowsIdentity]::GetCurrent()",
    "$principal = New-Object Security.Principal.WindowsPrincipal($identity)",
    "$principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)",
  ].join("; ");
  const result = await run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], 3000);
  const answer = String(result.stdout || "").trim();
  if (result.ok && /^true$/i.test(answer)) {
    return {
      ok: true,
      mode: "windows-admin",
      platform: HOST_PLATFORM,
      message: "Windows Agent 已以管理员权限运行",
    };
  }

  return {
    ok: false,
    mode: "windows-missing",
    platform: HOST_PLATFORM,
    message: "Windows 弱网需要管理员权限。请右键使用 open-weaknet-win32.cmd，或用管理员 PowerShell 运行 node server.js。",
    error: result.error || result.stderr || result.stdout || "current process is not elevated",
  };
}

async function getPrivilegeStatus() {
  if (IS_WIN32) {
    return getWindowsPrivilegeStatus();
  }

  if (isRootProcess()) {
    return {
      ok: true,
      mode: "root",
      platform: HOST_PLATFORM,
      message: "Agent 已以管理员权限运行",
    };
  }

  const result = await run("sudo", ["-n", "-v"], 3000);
  if (result.ok) {
    return {
      ok: true,
      mode: "sudo-cache",
      platform: HOST_PLATFORM,
      message: "sudo 授权缓存有效",
    };
  }

  return {
    ok: false,
    mode: "missing",
    platform: HOST_PLATFORM,
    message: "Agent 没有管理员权限。请停止当前服务，并用 start-admin.command 或 sudo node server.js 重新启动。",
    error: result.error || result.stderr || result.stdout,
  };
}

async function requireWeaknetPrivilege() {
  const privilege = await getPrivilegeStatus();
  if (!privilege.ok) {
    throw makeHttpError(privilege.message, 403, { privilege });
  }
  return privilege;
}

async function runPrivileged(label, command, args, options = {}) {
  const elevated = withPrivilege(command, args);
  const result =
    options.input === undefined
      ? await run(elevated.command, elevated.args, options.timeoutMs || 8000)
      : await runWithInput(elevated.command, elevated.args, options.input, options.timeoutMs || 8000);
  return {
    label,
    command: elevated.command,
    args: elevated.args,
    ok: result.ok,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error,
  };
}

function isAdbServerRetryableFailure(result) {
  const text = `${result.error || ""}\n${result.stderr || ""}\n${result.stdout || ""}`;
  return /device offline|daemon not running|cannot connect to daemon|server version|protocol fault|device unauthorized|no devices\/emulators found/i.test(
    text,
  );
}

async function ensureAdbServerReady(forceRestart = false) {
  if (forceRestart) {
    await run(ADB, ["kill-server"], 5000);
  }
  return run(ADB, ["start-server"], 8000);
}

async function adb(args, timeoutMs = 5000, options = {}) {
  const allowRetry = options.allowRetry !== false;
  let result = await run(ADB, args, timeoutMs);
  if (result.ok || !allowRetry || !isAdbServerRetryableFailure(result)) {
    return result;
  }

  await ensureAdbServerReady(false);
  result = await run(ADB, args, timeoutMs);
  if (result.ok || !isAdbServerRetryableFailure(result)) {
    return result;
  }

  await ensureAdbServerReady(true);
  return run(ADB, args, timeoutMs);
}

function adbShell(serial, args, timeoutMs = 5000) {
  return adb(["-s", serial, "shell", ...args], timeoutMs);
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function adbShellCommand(serial, command, timeoutMs = 5000) {
  return adb(["-s", serial, "shell", command], timeoutMs);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeCommandStep(label, command, args, result) {
  return {
    label,
    command,
    args,
    ok: result.ok,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error || "",
  };
}

function makeAdbStep(label, args, result) {
  return makeCommandStep(label, ADB, args, result);
}

function makeInternalStep(label, ok, message) {
  return {
    label,
    command: "internal",
    args: [],
    ok,
    stdout: ok ? message : "",
    stderr: ok ? "" : message,
    error: ok ? "" : message,
  };
}

function normalizeRemoteIp(value) {
  return String(value || "").replace(/^::ffff:/, "");
}

function isAllowedSocksClient(address) {
  return normalizeRemoteIp(address) === socksRuntime.allowedIp;
}

function createSocksCounters() {
  return {
    startedAt: "",
    tcpAccepted: 0,
    tcpRejected: 0,
    tcpConnectRequests: 0,
    tcpConnectSuccess: 0,
    tcpConnectFailed: 0,
    udpFromClient: 0,
    udpToRemote: 0,
    udpFromRemote: 0,
    udpToClient: 0,
    udpRejected: 0,
    lastAcceptedIp: "",
    lastRejectedIp: "",
    lastTcpTarget: "",
    lastUdpTarget: "",
    lastError: "",
  };
}

function resetSocksCounters() {
  socksRuntime.counters = createSocksCounters();
  socksRuntime.counters.startedAt = new Date().toISOString();
}

function parseSocksAddress(buffer, offset) {
  const type = buffer[offset];
  if (type === 0x01) {
    if (buffer.length < offset + 7) return null;
    const address = Array.from(buffer.slice(offset + 1, offset + 5)).join(".");
    const port = buffer.readUInt16BE(offset + 5);
    return { address, port, offset: offset + 7 };
  }
  if (type === 0x03) {
    if (buffer.length < offset + 2) return null;
    const length = buffer[offset + 1];
    if (buffer.length < offset + 2 + length + 2) return null;
    const address = buffer.slice(offset + 2, offset + 2 + length).toString("utf8");
    const port = buffer.readUInt16BE(offset + 2 + length);
    return { address, port, offset: offset + 2 + length + 2 };
  }
  if (type === 0x04) {
    if (buffer.length < offset + 19) return null;
    const parts = [];
    for (let index = 0; index < 16; index += 2) {
      parts.push(buffer.readUInt16BE(offset + 1 + index).toString(16));
    }
    const address = parts.join(":");
    const port = buffer.readUInt16BE(offset + 17);
    return { address, port, offset: offset + 19 };
  }
  return { error: `unsupported address type ${type}` };
}

function buildSocksReply(status, bindAddress, bindPort) {
  const parts = getIpv4Parts(bindAddress) || [0, 0, 0, 0];
  const reply = Buffer.alloc(10);
  reply[0] = 0x05;
  reply[1] = status;
  reply[2] = 0x00;
  reply[3] = 0x01;
  parts.forEach((part, index) => {
    reply[4 + index] = part;
  });
  reply.writeUInt16BE(bindPort || 0, 8);
  return reply;
}

function buildSocksUdpPacket(address, port, payload) {
  const parts = getIpv4Parts(address);
  if (parts) {
    const header = Buffer.alloc(10);
    header[0] = 0x00;
    header[1] = 0x00;
    header[2] = 0x00;
    header[3] = 0x01;
    parts.forEach((part, index) => {
      header[4 + index] = part;
    });
    header.writeUInt16BE(port, 8);
    return Buffer.concat([header, payload]);
  }

  const domain = Buffer.from(address);
  const header = Buffer.alloc(7 + domain.length);
  header[0] = 0x00;
  header[1] = 0x00;
  header[2] = 0x00;
  header[3] = 0x03;
  header[4] = domain.length;
  domain.copy(header, 5);
  header.writeUInt16BE(port, 5 + domain.length);
  return Buffer.concat([header, payload]);
}

function writeSocksFailure(socket, status = 0x01) {
  if (!socket.destroyed) socket.end(buildSocksReply(status, "0.0.0.0", 0));
}

function handleSocksTcpClient(socket) {
  const remoteIp = normalizeRemoteIp(socket.remoteAddress);
  if (!isAllowedSocksClient(remoteIp)) {
    socksRuntime.counters.tcpRejected += 1;
    socksRuntime.counters.lastRejectedIp = remoteIp;
    socket.destroy();
    return;
  }

  socksRuntime.counters.tcpAccepted += 1;
  socksRuntime.counters.lastAcceptedIp = remoteIp;
  socksRuntime.tcpSockets.add(socket);
  let buffer = Buffer.alloc(0);
  let stage = "greeting";
  let upstream = null;

  const cleanup = () => {
    socksRuntime.tcpSockets.delete(socket);
    if (upstream && !upstream.destroyed) upstream.destroy();
  };
  socket.on("close", cleanup);
  socket.on("error", cleanup);

  socket.on("data", (chunk) => {
    if (upstream) {
      upstream.write(chunk);
      return;
    }

    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length) {
      if (stage === "greeting") {
        if (buffer.length < 2) return;
        const methodsLength = buffer[1];
        if (buffer.length < 2 + methodsLength) return;
        if (buffer[0] !== 0x05) {
          socket.destroy();
          return;
        }
        socket.write(Buffer.from([0x05, 0x00]));
        buffer = buffer.slice(2 + methodsLength);
        stage = "request";
        continue;
      }

      if (stage === "request") {
        if (buffer.length < 4) return;
        if (buffer[0] !== 0x05) {
          socket.destroy();
          return;
        }
        const command = buffer[1];
        const target = parseSocksAddress(buffer, 3);
        if (!target) return;
        if (target.error) {
          writeSocksFailure(socket, 0x08);
          return;
        }
        const rest = buffer.slice(target.offset);
        buffer = Buffer.alloc(0);

        if (command === 0x01) {
          socksRuntime.counters.tcpConnectRequests += 1;
          socksRuntime.counters.lastTcpTarget = `${target.address}:${target.port}`;
          upstream = net.createConnection({ host: target.address, port: target.port }, () => {
            socksRuntime.counters.tcpConnectSuccess += 1;
            socket.write(buildSocksReply(0x00, socksRuntime.advertisedHost || "0.0.0.0", 0));
            if (rest.length) upstream.write(rest);
          });
          upstream.on("data", (data) => {
            if (!socket.destroyed) socket.write(data);
          });
          upstream.on("error", (error) => {
            socksRuntime.counters.tcpConnectFailed += 1;
            socksRuntime.counters.lastError = error.message;
            writeSocksFailure(socket, 0x01);
          });
          upstream.on("close", () => {
            if (!socket.destroyed) socket.end();
          });
          return;
        }

        if (command === 0x03) {
          socket.write(buildSocksReply(0x00, socksRuntime.advertisedHost || "0.0.0.0", socksRuntime.port));
          stage = "udp";
          return;
        }

        writeSocksFailure(socket, 0x07);
        return;
      }

      return;
    }
  });
}

function handleSocksUdpMessage(message, rinfo) {
  const clientIp = normalizeRemoteIp(rinfo.address);
  if (!isAllowedSocksClient(clientIp) || message.length < 10) {
    socksRuntime.counters.udpRejected += 1;
    socksRuntime.counters.lastRejectedIp = clientIp;
    return;
  }
  if (message[0] !== 0x00 || message[1] !== 0x00 || message[2] !== 0x00) {
    socksRuntime.counters.udpRejected += 1;
    return;
  }

  const target = parseSocksAddress(message, 3);
  if (!target || target.error) {
    socksRuntime.counters.udpRejected += 1;
    return;
  }
  const payload = message.slice(target.offset);
  if (!payload.length) return;

  socksRuntime.counters.udpFromClient += 1;
  socksRuntime.counters.lastUdpTarget = `${target.address}:${target.port}`;
  const clientKey = `${clientIp}:${rinfo.port}`;
  socksRuntime.udpClients.set(clientKey, { address: rinfo.address, port: rinfo.port });
  const targetKey = `${target.address}:${target.port}`;
  socksRuntime.udpTargets.set(targetKey, { clientKey, address: target.address, port: target.port });
  socksRuntime.udpRelaySocket.send(payload, target.port, target.address);
  socksRuntime.counters.udpToRemote += 1;
}

function handleSocksUdpRemote(message, rinfo) {
  socksRuntime.counters.udpFromRemote += 1;
  const targetKey = `${rinfo.address}:${rinfo.port}`;
  const target = socksRuntime.udpTargets.get(targetKey);
  if (!target) return;
  const client = socksRuntime.udpClients.get(target.clientKey);
  if (!client) return;
  const packet = buildSocksUdpPacket(rinfo.address, rinfo.port, message);
  socksRuntime.udpSocket.send(packet, client.port, client.address);
  socksRuntime.counters.udpToClient += 1;
}

function closeSocketServer(server) {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    server.close(() => resolve());
    setTimeout(resolve, 500).unref();
  });
}

async function stopSocksProxy() {
  socksRuntime.active = false;
  for (const socket of socksRuntime.tcpSockets) {
    socket.destroy();
  }
  socksRuntime.tcpSockets.clear();
  socksRuntime.udpClients.clear();
  socksRuntime.udpTargets.clear();
  if (socksRuntime.udpSocket) {
    socksRuntime.udpSocket.close();
    socksRuntime.udpSocket = null;
  }
  if (socksRuntime.udpRelaySocket) {
    socksRuntime.udpRelaySocket.close();
    socksRuntime.udpRelaySocket = null;
  }
  await closeSocketServer(socksRuntime.server);
  socksRuntime.server = null;
}

async function startSocksProxy({ allowedIp, advertisedHost, port = SOCKS_PORT, forceRestart = false }) {
  if (
    !forceRestart &&
    socksRuntime.active &&
    socksRuntime.allowedIp === allowedIp &&
    socksRuntime.advertisedHost === advertisedHost &&
    socksRuntime.port === port
  ) {
    return { ok: true, reused: true, message: "本机 SOCKS 出口已运行" };
  }

  await stopSocksProxy();

  socksRuntime.allowedIp = allowedIp;
  socksRuntime.advertisedHost = advertisedHost;
  socksRuntime.port = port;
  resetSocksCounters();
  socksRuntime.server = net.createServer(handleSocksTcpClient);
  socksRuntime.udpSocket = dgram.createSocket("udp4");
  socksRuntime.udpRelaySocket = dgram.createSocket("udp4");
  socksRuntime.udpSocket.on("message", handleSocksUdpMessage);
  socksRuntime.udpRelaySocket.on("message", handleSocksUdpRemote);

  await Promise.all([
    new Promise((resolve, reject) => {
      socksRuntime.server.once("error", reject);
      socksRuntime.server.listen(port, socksRuntime.bindHost, resolve);
    }),
    new Promise((resolve, reject) => {
      socksRuntime.udpSocket.once("error", reject);
      socksRuntime.udpSocket.bind(port, socksRuntime.bindHost, resolve);
    }),
    new Promise((resolve, reject) => {
      socksRuntime.udpRelaySocket.once("error", reject);
      socksRuntime.udpRelaySocket.bind(0, socksRuntime.bindHost, resolve);
    }),
  ]);

  socksRuntime.active = true;
  return {
    ok: true,
    reused: false,
    message: `本机 SOCKS 出口已启动：${advertisedHost}:${port}`,
    host: advertisedHost,
    port,
  };
}

function getSocksRuntimeStatus() {
  return {
    active: socksRuntime.active,
    host: socksRuntime.advertisedHost,
    port: socksRuntime.port,
    allowedIp: socksRuntime.allowedIp,
    tcpConnections: socksRuntime.tcpSockets.size,
    counters: { ...socksRuntime.counters },
  };
}

function parseAdbDevices(output) {
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial, state, ...parts] = line.split(/\s+/);
      const meta = {};
      parts.forEach((part) => {
        const index = part.indexOf(":");
        if (index > 0) meta[part.slice(0, index)] = part.slice(index + 1);
      });
      return { serial, state, meta };
    });
}

async function getProp(serial, key) {
  const result = await adbShell(serial, ["getprop", key], 2500);
  return result.stdout.trim();
}

function parseDeviceIp(routeOutput) {
  const srcMatch = routeOutput.match(/\bsrc\s+([0-9.]+)/);
  if (srcMatch) return srcMatch[1];
  const ipMatch = routeOutput.match(/\b(?:10|172|192)\.[0-9.]+\b/);
  return ipMatch ? ipMatch[0] : "";
}

async function enrichDevice(device) {
  if (device.state !== "device") return device;

  const [manufacturer, model, androidVersion, route] = await Promise.all([
    getProp(device.serial, "ro.product.manufacturer"),
    getProp(device.serial, "ro.product.model"),
    getProp(device.serial, "ro.build.version.release"),
    adbShell(device.serial, ["ip", "route"], 2500),
  ]);

  return {
    ...device,
    platform: "android",
    manufacturer,
    model: model || device.meta.model || "",
    androidVersion,
    ip: parseDeviceIp(route.stdout),
  };
}

async function listDevices() {
  const result = await adb(["devices", "-l"], 5000);
  const devices = parseAdbDevices(result.stdout);
  const enriched = [];
  for (const device of devices) {
    enriched.push(await enrichDevice(device));
  }
  return {
    adbOk: result.ok,
    devices: enriched,
    raw: result.stdout,
    error: result.error || result.stderr,
  };
}

function extractPackageFromComponent(value) {
  if (!value) return "";
  const match = value.match(/([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)\/[^\s}]+/);
  return match ? match[1] : "";
}

async function getForeground(serial) {
  const result = await adbShell(serial, ["dumpsys", "window"], 8000);
  const output = result.stdout;
  const candidates = [];

  const focus = output.match(/mCurrentFocus=Window\{[^\n]*\s([^\s}]+)\}/);
  const focusedApp = output.match(/mFocusedApp=ActivityRecord\{[^\n]*\s([^\s}]+)\s/);
  const topApp = output.match(/topApp=ActivityRecord\{[^\n]*\s([^\s}]+)\s/);

  [focus && focus[1], focusedApp && focusedApp[1], topApp && topApp[1]].forEach((value) => {
    const packageName = extractPackageFromComponent(value);
    if (packageName && !candidates.includes(packageName)) candidates.push(packageName);
  });

  const systemLike = /(launcher|systemui|\.home$|miui\.home|android\.settings)/i;
  const preferred = candidates.find((item) => !systemLike.test(item)) || candidates[0] || "";
  return { packageName: preferred, candidates, ok: result.ok, error: result.error || result.stderr };
}

function parseCpu(cpuInfo, packageName) {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^\\s*([0-9.]+)%\\s+\\d+/${escaped}(?::[^\\s]+)?`, "m");
  const match = cpuInfo.match(regex);
  return match ? Number(match[1]) : null;
}

function parseMemory(memInfo) {
  const totalPss = memInfo.match(/TOTAL\s+PSS:\s+([0-9,]+)K/i);
  if (totalPss) return Number(totalPss[1].replace(/,/g, "")) / 1024;

  const totalLine = memInfo.match(/^\s*TOTAL\s+([0-9,]+)/m);
  if (totalLine) return Number(totalLine[1].replace(/,/g, "")) / 1024;

  return null;
}

function parseGfx(gfxInfo) {
  const totalFrames = gfxInfo.match(/Total frames rendered:\s+([0-9]+)/i);
  const jankyFrames = gfxInfo.match(/Janky frames:\s+([0-9]+)/i);
  return {
    totalFrames: totalFrames ? Number(totalFrames[1]) : null,
    jankyFrames: jankyFrames ? Number(jankyFrames[1]) : null,
  };
}

function parseSurfaceLayer(listOutput, packageName) {
  const candidates = listOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes(packageName))
    .map((line) => {
      const match = line.match(/^RequestedLayerState\{(.+?)\s(?:parentId|relativeParentId|z=|!handle)/);
      return match ? match[1].trim() : line.replace(/^RequestedLayerState\{|\}$/g, "").trim();
    });

  return (
    candidates.find((line) => line.includes("SurfaceView") && line.includes("(BLAST)")) ||
    candidates.find((line) => line.includes("SurfaceView")) ||
    candidates.find((line) => line.includes(packageName)) ||
    ""
  );
}

function parseSurfaceLatency(latencyOutput) {
  const rows = latencyOutput
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/).map(Number))
    .filter((values) => values.length >= 3 && values[1] > 0);

  if (rows.length < 2) return null;
  const timestamps = rows.map((values) => values[1]).sort((a, b) => a - b);
  const first = timestamps[0];
  const last = timestamps[timestamps.length - 1];
  const seconds = (last - first) / 1e9;
  if (seconds <= 0) return null;
  return Math.min(240, Math.max(0, (timestamps.length - 1) / seconds));
}

async function collectSurfaceFps(serial, packageName) {
  const list = await adbShell(serial, ["dumpsys", "SurfaceFlinger", "--list"], 5000);
  if (!list.ok) return { fps: null, layer: "", error: "Surface 列表读取失败" };
  const layer = parseSurfaceLayer(list.stdout, packageName);
  if (!layer) return { fps: null, layer: "", error: "未找到游戏 Surface 层" };

  const latency = await adbShellCommand(serial, `dumpsys SurfaceFlinger --latency ${shellQuote(layer)}`, 5000);
  if (!latency.ok) return { fps: null, layer, error: "Surface latency 读取失败" };
  return { fps: parseSurfaceLatency(latency.stdout), layer, error: "" };
}

function parseNetDev(netDev) {
  const interfaces = netDev
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item.includes(":"))
    .map((line) => {
      const [name, rest] = line.split(":");
      const values = rest.trim().split(/\s+/).map(Number);
      return {
        interfaceName: name.trim(),
        rxBytes: values[0] || 0,
        txBytes: values[8] || 0,
      };
    });
  if (!interfaces.length) return null;

  const preferred =
    interfaces.find((item) => item.interfaceName === "tun0") ||
    interfaces.find((item) => /^tun\d+$/.test(item.interfaceName)) ||
    interfaces.find((item) => item.interfaceName === "wlan0") ||
    interfaces.find((item) => item.interfaceName === "rmnet_data0") ||
    interfaces.find((item) => item.interfaceName.startsWith("rmnet_data")) ||
    interfaces.find((item) => item.interfaceName !== "lo" && item.rxBytes + item.txBytes > 0);

  return preferred || null;
}

function parsePing(pingOutput) {
  const match = pingOutput.match(/time[=<]([0-9.]+)\s*ms/);
  return match ? Number(match[1]) : null;
}

function calcRate(current, previous) {
  if (!current || !previous) return { downKbps: null, upKbps: null };
  if (current.interfaceName && previous.interfaceName && current.interfaceName !== previous.interfaceName) {
    return { downKbps: null, upKbps: null };
  }
  const seconds = Math.max(0.001, (Date.now() - previous.time) / 1000);
  return {
    downKbps: Math.max(0, ((current.rxBytes - previous.rxBytes) * 8) / seconds / 1000),
    upKbps: Math.max(0, ((current.txBytes - previous.txBytes) * 8) / seconds / 1000),
  };
}

function calcFps(currentGfx, previousGfx) {
  if (!currentGfx.totalFrames || !previousGfx || !previousGfx.totalFrames) return null;
  const seconds = Math.max(0.001, (Date.now() - previousGfx.time) / 1000);
  return Math.max(0, (currentGfx.totalFrames - previousGfx.totalFrames) / seconds);
}

function calcJank(currentGfx, previousGfx) {
  if (currentGfx.jankyFrames === null || !previousGfx || previousGfx.jankyFrames === null) {
    return currentGfx.jankyFrames;
  }
  return Math.max(0, currentGfx.jankyFrames - previousGfx.jankyFrames);
}

async function collectMetrics(serial, packageName, previous = {}) {
  const errors = [];
  const safePackage = packageName.trim();
  if (!safePackage) {
    return { available: false, errors: ["缺少目标游戏包名"] };
  }

  const [cpu, mem, gfx, net, ping] = await Promise.all([
    adbShell(serial, ["dumpsys", "cpuinfo"], 6000),
    adbShell(serial, ["dumpsys", "meminfo", safePackage], 6000),
    adbShell(serial, ["dumpsys", "gfxinfo", safePackage], 6000),
    adbShell(serial, ["cat", "/proc/net/dev"], 3000),
    adbShell(serial, ["ping", "-c", "1", "-W", "1", "223.5.5.5"], 2500),
  ]);

  if (!cpu.ok) errors.push("CPU 采集失败");
  if (!mem.ok || /No process found|Unable to find/i.test(mem.stdout)) errors.push("内存采集失败或应用未运行");
  if (!gfx.ok || /No process found|Unable to find/i.test(gfx.stdout)) errors.push("FPS 采集失败或应用未运行");

  const currentNet = parseNetDev(net.stdout);
  const currentGfx = parseGfx(gfx.stdout);
  const surface = currentGfx.totalFrames ? { fps: null, layer: "", error: "" } : await collectSurfaceFps(serial, safePackage);
  const rates = calcRate(currentNet, previous.net);
  const fps = calcFps(currentGfx, previous.gfx) ?? surface.fps;

  if (surface.error && !currentGfx.totalFrames) errors.push(surface.error);

  return {
    available: errors.length === 0 || cpu.ok || mem.ok || gfx.ok,
    source: "adb",
    timestamp: Date.now(),
    serial,
    packageName: safePackage,
    fps,
    jank: calcJank(currentGfx, previous.gfx),
    cpu: parseCpu(cpu.stdout, safePackage),
    memoryMb: parseMemory(mem.stdout),
    downKbps: rates.downKbps,
    upKbps: rates.upKbps,
    networkInterface: currentNet ? currentNet.interfaceName : "",
    rttMs: parsePing(ping.stdout),
    fpsSource: surface.fps === null ? "gfxinfo" : "surfaceflinger",
    surfaceLayer: surface.layer,
    errors,
    state: {
      net: currentNet ? { ...currentNet, time: Date.now() } : previous.net,
      gfx: currentGfx ? { ...currentGfx, time: Date.now() } : previous.gfx,
    },
  };
}

function makeHttpError(message, statusCode = 400, extra = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
}

function readJsonBody(req, maxBytes = 1024 * 64) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > maxBytes) {
        reject(makeHttpError("request body too large", 413));
        req.destroy();
      }
    });
    req.on("error", reject);
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(makeHttpError("invalid json body", 400));
      }
    });
  });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getIpv4Parts(value) {
  const parts = String(value).trim().split(".");
  if (
    parts.length === 4 &&
    parts.every((part) => {
      if (!/^\d+$/.test(part)) return false;
      const number = Number(part);
      return number >= 0 && number <= 255;
    })
  ) {
    return parts.map(Number);
  }
  return null;
}

function ipv4ToNumber(value) {
  const parts = getIpv4Parts(value);
  if (!parts) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function areSameIpv4Subnet(ipA, ipB, netmask) {
  const a = ipv4ToNumber(ipA);
  const b = ipv4ToNumber(ipB);
  const mask = ipv4ToNumber(netmask);
  if (a === null || b === null || mask === null) return false;
  return (a & mask) === (b & mask);
}

function isValidIpv4(value) {
  return Boolean(getIpv4Parts(value));
}

function isPrivateIpv4Parts(parts) {
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function getMacIpv4Records() {
  return Object.entries(os.networkInterfaces())
    .flatMap(([name, items]) => {
      return (items || [])
        .filter((item) => item.family === "IPv4" || item.family === 4)
        .map((item) => ({
          name,
          address: item.address,
          netmask: item.netmask || "",
          internal: Boolean(item.internal),
        }));
    })
    .filter((item) => isValidIpv4(item.address));
}

function findReachableMacIpForDevice(deviceIp) {
  const records = getMacIpv4Records().filter((item) => !item.internal);
  return (
    records.find((item) => item.netmask && areSameIpv4Subnet(item.address, deviceIp, item.netmask)) ||
    records.find((item) => item.address.startsWith("10.") && String(deviceIp).startsWith("10.")) ||
    records[0] ||
    null
  );
}

async function getDefaultGatewayIp() {
  const result = await run("route", ["-n", "get", "default"], 3000);
  if (!result.ok) return "";
  const match = result.stdout.match(/^\s*gateway:\s*([0-9.]+)\s*$/m);
  return match && isValidIpv4(match[1]) ? match[1] : "";
}

async function getMacDefaultRoute() {
  const result = await run("route", ["-n", "get", "default"], 3000);
  if (!result.ok) {
    return { gatewayIp: "", interfaceName: "", error: result.error || result.stderr };
  }
  const gateway = result.stdout.match(/^\s*gateway:\s*([0-9.]+)\s*$/m);
  const iface = result.stdout.match(/^\s*interface:\s*([^\s]+)\s*$/m);
  return {
    gatewayIp: gateway && isValidIpv4(gateway[1]) ? gateway[1] : "",
    interfaceName: iface ? iface[1] : "",
    error: "",
  };
}

function parseAndroidRouteGet(output) {
  const firstLine = output.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
  const via = firstLine.match(/\bvia\s+([0-9.]+)/);
  const dev = firstLine.match(/\bdev\s+([^\s]+)/);
  const src = firstLine.match(/\bsrc\s+([0-9.]+)/);
  return {
    raw: output.trim(),
    gatewayIp: via && isValidIpv4(via[1]) ? via[1] : "",
    interfaceName: dev ? dev[1] : "",
    sourceIp: src && isValidIpv4(src[1]) ? src[1] : "",
  };
}

async function getAndroidInternetRoute(serial) {
  const routeGet = await adbShell(serial, ["ip", "route", "get", "223.5.5.5"], 3000);
  if (routeGet.ok && routeGet.stdout.trim()) {
    return { ok: true, ...parseAndroidRouteGet(routeGet.stdout), error: "" };
  }

  const routeList = await adbShell(serial, ["ip", "route"], 3000);
  const defaultLine = routeList.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("default "));
  if (routeList.ok && defaultLine) {
    return { ok: true, ...parseAndroidRouteGet(defaultLine), raw: routeList.stdout.trim(), error: "" };
  }

  return {
    ok: false,
    raw: [routeGet.stdout, routeGet.stderr, routeList.stdout, routeList.stderr].filter(Boolean).join("\n").trim(),
    gatewayIp: "",
    interfaceName: "",
    sourceIp: "",
    error: routeGet.error || routeGet.stderr || routeList.error || routeList.stderr || "Android 路由读取失败",
  };
}

async function inspectTrafficPath(serial, deviceIp) {
  const macIps = getMacIpv4Records();
  const macRoute = await getMacDefaultRoute();
  if (!serial) {
    return {
      throughMac: false,
      reason: "缺少 Android 设备序列号，请先连接并授权 USB 调试",
      macRoute,
      macIps,
      androidRoute: null,
    };
  }

  const androidRoute = await getAndroidInternetRoute(serial);
  const macIpSet = new Set(macIps.map((item) => item.address));
  const throughMac = Boolean(androidRoute.gatewayIp && macIpSet.has(androidRoute.gatewayIp));
  let reason = "";

  if (!androidRoute.ok) {
    reason = androidRoute.error || "无法读取 Android 默认路由";
  } else if (!androidRoute.gatewayIp) {
    reason = "Android 默认路由没有网关信息，无法确认流量是否经过 Mac";
  } else if (!throughMac) {
    reason = `Android 当前默认网关是 ${androidRoute.gatewayIp}，不是 Mac 的 IP`;
  } else if (deviceIp && androidRoute.sourceIp && deviceIp !== androidRoute.sourceIp) {
    reason = `页面设备 IP 是 ${deviceIp}，但 Android 出网源 IP 是 ${androidRoute.sourceIp}`;
  }

  return {
    throughMac: throughMac && !reason,
    reason,
    macRoute,
    macIps,
    androidRoute,
    deviceIp,
    currentTopology:
      macRoute.interfaceName === "en0" && androidRoute.interfaceName === "wlan0" && !throughMac
        ? "mac_wifi_and_android_wifi_same_lan"
        : "",
    autoPrepareSupported: false,
    autoPrepareReason:
      macRoute.interfaceName === "en0"
        ? "当前 Mac 自己正在用 Wi-Fi 上网，macOS 不能稳定地把同一个 Wi-Fi 同时作为上游和热点网关"
        : "当前版本还没有启用 macOS Internet Sharing 自动配置",
  };
}

function describeUnsafeIp(deviceIp, localRecords, gatewayIp) {
  const parts = getIpv4Parts(deviceIp);
  if (!parts) return "设备 IP 不是有效 IPv4 地址";

  const localMatch = localRecords.find((item) => item.address === deviceIp);
  if (localMatch) {
    return `这是 Mac 本机 ${localMatch.name} 的 IP，不能作为弱网目标`;
  }

  if (gatewayIp && deviceIp === gatewayIp) {
    return "这是 Mac 当前默认网关 IP，不能作为弱网目标";
  }

  if (parts[0] === 0) return "0.0.0.0/8 是保留地址，不能作为设备 IP";
  if (parts[0] === 127) return "127.0.0.0/8 是本机回环地址，不能作为设备 IP";
  if (parts[0] === 169 && parts[1] === 254) return "169.254.0.0/16 是链路本地地址，不适合作为弱网目标";
  if (parts[0] >= 224 && parts[0] <= 239) return "224.0.0.0/4 是组播地址，不能作为设备 IP";
  if (parts[0] >= 240) return "240.0.0.0/4 是保留地址，不能作为设备 IP";
  if (parts[3] === 0) return "这个地址看起来是网段地址，不能作为设备 IP";
  if (parts[3] === 255) return "这个地址看起来是广播地址，不能作为设备 IP";
  if (!isPrivateIpv4Parts(parts)) {
    return "设备 IP 必须是内网私有地址，避免误伤公网、DNS 或服务器流量";
  }

  return "";
}

async function inspectWeaknetTargetIp(deviceIp) {
  const localRecords = getMacIpv4Records();
  const gatewayIp = await getDefaultGatewayIp();
  const reason = describeUnsafeIp(deviceIp, localRecords, gatewayIp);
  return {
    safe: !reason,
    reason,
    deviceIp,
    gatewayIp,
    macIps: localRecords.map((item) => ({
      name: item.name,
      address: item.address,
      internal: item.internal,
    })),
  };
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampNumber(value, min, max, fallback) {
  const number = nullableNumber(value);
  if (number === null) return fallback;
  return Math.min(max, Math.max(min, number));
}

function inferWeaknetDisconnectMode(profile) {
  if (profile.networkWave && profile.networkWave.enabled) return "none";
  if (profile.presetKey === "normal") return "none";
  if (
    profile.disconnectMode === "always" ||
    profile.packetLossPercent >= 100 ||
    profile.downloadKbps === 0 ||
    profile.uploadKbps === 0
  ) {
    return "always";
  }
  if (profile.disconnectMode === "periodic" || (profile.disconnectDurationSec > 0 && profile.disconnectIntervalSec > 0)) {
    return "periodic";
  }
  return "none";
}

function isMacLocalWeaknetScope(targetScope) {
  return targetScope === "mac-unity" || targetScope === "mac-global";
}

function isLocalWeaknetScope(targetScope) {
  return isMacLocalWeaknetScope(targetScope) || targetScope === "win-global" || targetScope === "win-target";
}

function normalizeNetworkWave(sourceWave = {}) {
  return {
    enabled: Boolean(sourceWave && sourceWave.enabled),
    mode: String((sourceWave && sourceWave.mode) || NETWORK_WAVE_CONFIG.mode),
  };
}

function normalizeWeaknetRequest(body) {
  const sourceProfile = body.profile || {};
  const presetKey = String(sourceProfile.presetKey || "custom");
  const targetScope = String(body.targetScope || sourceProfile.targetScope || "device").trim() || "device";
  const deviceIp = String(body.deviceIp || sourceProfile.deviceIp || "").trim();
  if (!isLocalWeaknetScope(targetScope) && presetKey !== "normal" && !isValidIpv4(deviceIp)) {
    throw makeHttpError("invalid deviceIp; expected an IPv4 address", 400);
  }

  const profile = {
    presetKey,
    displayNameZh: String(sourceProfile.displayNameZh || "自定义弱网").slice(0, 80),
    latencyRttMs: clampNumber(sourceProfile.latencyRttMs, 0, 10000, null),
    jitterMs: clampNumber(sourceProfile.jitterMs, 0, 10000, 0),
    packetLossPercent: clampNumber(sourceProfile.packetLossPercent, 0, 100, 0),
    downloadKbps: clampNumber(sourceProfile.downloadKbps, 0, 10000000, null),
    uploadKbps: clampNumber(sourceProfile.uploadKbps, 0, 10000000, null),
    disconnectMode: String(sourceProfile.disconnectMode || "none"),
    disconnectDurationSec: clampNumber(sourceProfile.disconnectDurationSec, 0, 3600, 0),
    disconnectIntervalSec: clampNumber(sourceProfile.disconnectIntervalSec, 0, 3600, 0),
    networkWave: normalizeNetworkWave(sourceProfile.networkWave),
  };
  profile.disconnectMode = inferWeaknetDisconnectMode(profile);

  return {
    targetScope,
    deviceIp,
    platform: String(body.platform || "android"),
    targetApp: String(body.targetApp || ""),
    targetEndpoint: String(body.targetEndpoint || sourceProfile.targetEndpoint || body.targetApp || "").trim(),
    profile,
  };
}

function normalizeAndroidVpnRequest(body) {
  const sourceProfile = body.profile || {};
  const presetKey = String(sourceProfile.presetKey || "custom");
  const profile = {
    presetKey,
    displayNameZh: String(sourceProfile.displayNameZh || "自定义弱网").slice(0, 80),
    latencyRttMs: clampNumber(sourceProfile.latencyRttMs, 0, 10000, null),
    jitterMs: clampNumber(sourceProfile.jitterMs, 0, 10000, 0),
    packetLossPercent: clampNumber(sourceProfile.packetLossPercent, 0, 100, 0),
    downloadKbps: clampNumber(sourceProfile.downloadKbps, 0, 10000000, null),
    uploadKbps: clampNumber(sourceProfile.uploadKbps, 0, 10000000, null),
    disconnectMode: String(sourceProfile.disconnectMode || "none"),
    disconnectDurationSec: clampNumber(sourceProfile.disconnectDurationSec, 0, 3600, 0),
    disconnectIntervalSec: clampNumber(sourceProfile.disconnectIntervalSec, 0, 3600, 0),
    networkWave: normalizeNetworkWave(sourceProfile.networkWave),
  };
  profile.disconnectMode = inferWeaknetDisconnectMode(profile);

  const serial = String(body.serial || body.deviceSerial || "").trim();
  if (!serial) {
    throw makeHttpError("missing Android device serial", 400);
  }

  const targetApp = String(body.targetApp || sourceProfile.targetPackage || sourceProfile.targetApp || "").trim();
  if (profile.presetKey !== "normal" && !ANDROID_PACKAGE_RE.test(targetApp)) {
    throw makeHttpError("Android VPN 模式需要填写有效的目标应用包名", 400);
  }
  const deviceIp = String(body.deviceIp || sourceProfile.deviceIp || "").trim();

  return {
    serial,
    deviceIp,
    targetApp,
    platform: "Android",
    profile,
  };
}

function getAndroidVpnProfileSupport(profile) {
  if (profile.presetKey === "normal") {
    return {
      supported: true,
      mode: "normal",
      message: "正常网络会清除 Android VPN Agent 状态",
    };
  }

  if (
    profile.disconnectMode === "always" ||
    profile.packetLossPercent >= 100 ||
    profile.downloadKbps === 0 ||
    profile.uploadKbps === 0
  ) {
    return {
      supported: true,
      mode: "blackhole",
      message: "当前 Android VPN Agent MVP 会对目标包名执行 100% 丢包",
    };
  }

  return {
    supported: true,
    mode: "socks",
    message: IS_WIN32
      ? "Android VPN Agent 将通过 Windows SOCKS 出口和 WinDivert 执行该弱网预设"
      : "Android VPN Agent 将通过 Mac SOCKS 出口和 pf/dnctl 执行该弱网预设",
  };
}

async function isAndroidVpnAgentInstalled(serial) {
  const result = await adbShell(serial, ["pm", "path", ANDROID_VPN_AGENT.packageName], 5000);
  return result.ok && result.stdout.includes(ANDROID_VPN_AGENT.packageName);
}

function isTruthyEnv(value) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

function getAndroidAgentBuildCommand() {
  if (!IS_WIN32) {
    return {
      command: ANDROID_VPN_AGENT.buildScript,
      args: [],
      scriptPath: ANDROID_VPN_AGENT.buildScript,
    };
  }

  return {
    command: "powershell.exe",
    args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ANDROID_VPN_AGENT.buildScriptWin32],
    scriptPath: ANDROID_VPN_AGENT.buildScriptWin32,
  };
}

function shouldRebuildAndroidAgentApk() {
  if (!fs.existsSync(ANDROID_VPN_AGENT.apkPath)) return true;
  return isTruthyEnv(process.env.WEAKNET_BUILD_ANDROID_AGENT) || isTruthyEnv(process.env.WEAKNET_REBUILD_ANDROID_AGENT);
}

async function ensureAndroidAgentApk(steps) {
  if (fs.existsSync(ANDROID_VPN_AGENT.apkPath) && !shouldRebuildAndroidAgentApk()) {
    return;
  }

  const buildCommand = getAndroidAgentBuildCommand();
  if (!fs.existsSync(buildCommand.scriptPath)) {
    throw makeHttpError("Android VPN Agent 构建脚本不存在", 500, { steps });
  }

  const result = await run(buildCommand.command, buildCommand.args, 120000);
  steps.push(makeCommandStep("构建 Android VPN Agent", buildCommand.scriptPath, [], result));
  if (!result.ok || !fs.existsSync(ANDROID_VPN_AGENT.apkPath)) {
    throw makeHttpError("Android VPN Agent APK 构建失败", 500, { steps });
  }
}

async function getAndroidVpnAgentVersion(serial) {
  const result = await adbShell(serial, ["dumpsys", "package", ANDROID_VPN_AGENT.packageName], 6000);
  if (!result.ok) return { installed: false, versionCode: 0, error: result.error || result.stderr };
  const match = result.stdout.match(/\bversionCode=(\d+)/);
  return {
    installed: Boolean(match),
    versionCode: match ? Number(match[1]) : 0,
    error: match ? "" : "versionCode not found",
  };
}

async function ensureAndroidVpnAgentCurrent(serial, steps) {
  const version = await getAndroidVpnAgentVersion(serial);
  if (version.installed && version.versionCode >= ANDROID_VPN_AGENT.versionCode) {
    return { ok: true, installed: true, versionCode: version.versionCode };
  }
  const install = await installAndroidVpnAgent({ serial });
  steps.push(...(install.steps || []));
  return {
    ok: install.ok,
    installed: install.ok,
    versionCode: install.ok ? ANDROID_VPN_AGENT.versionCode : version.versionCode,
    install,
  };
}

async function installAndroidVpnAgent(body) {
  const serial = String(body.serial || body.deviceSerial || "").trim();
  if (!serial) throw makeHttpError("missing Android device serial", 400);

  const steps = [];
  await ensureAndroidAgentApk(steps);
  let args = ["-s", serial, "install", "--no-incremental", "-r", "-d", ANDROID_VPN_AGENT.apkPath];
  let result = await adb(args, 120000);
  steps.push(makeAdbStep("安装 Android VPN Agent", args, result));

  if (!result.ok && !/Success/i.test(result.stdout || "")) {
    args = ["-s", serial, "install", "-r", "-d", ANDROID_VPN_AGENT.apkPath];
    result = await adb(args, 120000);
    steps.push(makeAdbStep("安装 Android VPN Agent（兼容模式）", args, result));
  }

  const ok = result.ok || /Success/i.test(result.stdout);
  const installError = result.error || result.stderr || result.stdout;
  const userRestricted = /INSTALL_FAILED_USER_RESTRICTED|Install canceled by user|USER_RESTRICTED/i.test(installError);
  return {
    ok,
    mode: "install",
    message: ok
      ? "Android VPN Agent 已安装/更新"
      : userRestricted
        ? "手机系统阻止了 USB 安装；请在手机开发者选项中允许 USB 安装，并在弹窗中确认安装"
        : "Android VPN Agent 安装失败",
    steps: publicizeSteps(steps),
    apkPath: ANDROID_VPN_AGENT.apkPath,
    packageName: ANDROID_VPN_AGENT.packageName,
    requiresUserAction: userRestricted,
    error: ok ? "" : installError,
  };
}

async function openAndroidVpnAuthorization(body) {
  const serial = String(body.serial || body.deviceSerial || "").trim();
  if (!serial) throw makeHttpError("missing Android device serial", 400);

  const steps = [];
  await ensureAndroidAgentApk(steps);
  const agentCurrent = await ensureAndroidVpnAgentCurrent(serial, steps);
  if (!agentCurrent.ok) {
    return { ...(agentCurrent.install || {}), ok: false, steps: publicizeSteps(steps) };
  }

  const args = ["-s", serial, "shell", "am", "start", "-n", ANDROID_VPN_AGENT.activityComponent];
  const result = await adb(args, 10000);
  steps.push(makeAdbStep("打开 Android VPN 授权页", args, result));
  const ok = result.ok;
  return {
    ok,
    mode: "authorize",
    message: ok ? "已在 Android 设备上打开 Weaknet Agent，请在手机上同意 VPN 权限" : "打开 VPN 授权页失败",
    steps: publicizeSteps(steps),
    packageName: ANDROID_VPN_AGENT.packageName,
    error: ok ? "" : result.error || result.stderr || result.stdout,
  };
}

function parseAndroidAgentStatus(output) {
  const text = String(output || "").trim();
  if (!text || text === "{}") return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function getAndroidVpnAgentStatus(serial) {
  if (!serial) {
    throw makeHttpError("missing Android device serial", 400);
  }

  const installed = await isAndroidVpnAgentInstalled(serial);
  if (!installed) {
    return {
      ok: true,
      installed: false,
      running: false,
      packageName: ANDROID_VPN_AGENT.packageName,
      status: null,
      message: "Android VPN Agent 尚未安装",
    };
  }
  const version = await getAndroidVpnAgentVersion(serial);

  const [statusResult, serviceResult] = await Promise.all([
    adbShell(serial, ["run-as", ANDROID_VPN_AGENT.packageName, "cat", ANDROID_VPN_AGENT.statusFile], 5000),
    adbShell(serial, ["dumpsys", "activity", "services", ANDROID_VPN_AGENT.packageName], 5000),
  ]);
  const status = statusResult.ok ? parseAndroidAgentStatus(statusResult.stdout) : null;
  const serviceRunning = /WeaknetVpnService|com\.weaknet\.agent\/\.WeaknetVpnService/.test(serviceResult.stdout || "");
  const running = Boolean(serviceRunning || (status && status.running));
  const macSocks = getSocksRuntimeStatus();
  const socksMissing = Boolean(status && status.running && status.mode === "socks" && !macSocks.active);

  return {
    ok: true,
    healthy: !socksMissing,
    installed: true,
    versionCode: version.versionCode,
    expectedVersionCode: ANDROID_VPN_AGENT.versionCode,
    updateRequired: version.versionCode < ANDROID_VPN_AGENT.versionCode,
    running,
    hostSocks: macSocks,
    macSocks,
    packageName: ANDROID_VPN_AGENT.packageName,
    status,
    message: socksMissing
      ? "Android VPN Agent 正在 SOCKS 模式运行，但本机 SOCKS 出口未运行；请重新点击应用预设"
      : status && status.message
        ? status.message
        : "Android VPN Agent 已安装",
    statusReadError: statusResult.ok ? "" : statusResult.error || statusResult.stderr,
  };
}

function encodeProfileForAndroidAgent(profile, targetPackage) {
  return Buffer.from(JSON.stringify({ ...profile, targetPackage }), "utf8").toString("base64");
}

async function prepareAndroidSocksWeaknetWin32(request) {
  const privilege = await requireWeaknetPrivilege();
  const { deviceIp, profile } = request;
  if (!isValidIpv4(deviceIp)) {
    throw makeHttpError("Android VPN SOCKS 模式需要有效的设备 IP，请先刷新设备", 400);
  }

  const hostRecord = findReachableMacIpForDevice(deviceIp);
  if (!hostRecord || !hostRecord.address) {
    throw makeHttpError("没有找到与 Android 同网段的 Windows IP，无法启动 Windows SOCKS 出口", 400);
  }

  const socks = await startSocksProxy({
    allowedIp: deviceIp,
    advertisedHost: hostRecord.address,
    port: SOCKS_PORT,
    forceRestart: true,
  });
  const steps = [makeInternalStep("启动 Windows SOCKS 出口", socks.ok, (socks.message || "").replace(/^Mac /, "Windows "))];

  let config = null;
  try {
    config = win32Weaknet.buildWin32WeaknetConfig({
      ...request,
      targetScope: "android-socks",
      socksHost: hostRecord.address,
      socksPort: SOCKS_PORT,
    });
    steps.push(makeWin32Step("生成 Windows SOCKS WinDivert 配置", true, `mode=${config.mode}, rules=${config.rules.length}`));
  } catch (error) {
    steps.push(makeWin32Step("生成 Windows SOCKS WinDivert 配置", false, error.message));
    return buildWeaknetResponse("android-socks-win32-config", "Windows SOCKS 弱网配置生成失败", steps, {
      privilege,
      socks,
      macIp: hostRecord.address,
      socksPort: SOCKS_PORT,
    });
  }

  try {
    const stopResult = win32Weaknet.clearWin32Weaknet(getWin32DriverOptions());
    steps.push(makeWin32Step("清理上一次 Windows WinDivert 后端", true, stopResult));
  } catch (error) {
    steps.push(makeWin32Step("清理上一次 Windows WinDivert 后端", false, error.message));
    return buildWeaknetResponse("android-socks-win32-preflight", "Windows SOCKS 弱网下发前清理失败", steps, {
      privilege,
      socks,
      macIp: hostRecord.address,
      socksPort: SOCKS_PORT,
    });
  }

  let startResult = null;
  try {
    startResult = win32Weaknet.startWin32Weaknet(
      { ...request, targetScope: "android-socks", socksHost: hostRecord.address, socksPort: SOCKS_PORT },
      { ...getWin32DriverOptions(), config },
    );
    steps.push(makeWin32Step("启动 Windows SOCKS WinDivert 后端", true, `pid=${startResult.pid}, exe=${startResult.executable}`));
  } catch (error) {
    steps.push(makeWin32Step("启动 Windows SOCKS WinDivert 后端", false, error.message));
    return buildWeaknetResponse("android-socks-win32-start", "Windows SOCKS WinDivert 后端启动失败", steps, {
      privilege,
      socks,
      macIp: hostRecord.address,
      socksPort: SOCKS_PORT,
    });
  }

  const response = buildWeaknetResponse("android-socks-win32", "Windows SOCKS 弱网链路已准备", steps, {
    privilege,
    socks,
    macIp: hostRecord.address,
    socksPort: SOCKS_PORT,
    win32: {
      pid: startResult.pid,
      executable: startResult.executable,
      configFile: startResult.configFile,
      statusFile: startResult.statusFile,
      pidFile: startResult.pidFile,
      logFile: startResult.logFile,
    },
  });
  if (response.ok) rememberWin32WeaknetProfile(profile, "android-socks");
  return response;
}

async function prepareAndroidSocksWeaknet(request) {
  if (IS_WIN32) {
    return prepareAndroidSocksWeaknetWin32(request);
  }

  const privilege = await requireWeaknetPrivilege();
  const { deviceIp, profile } = request;
  if (!isValidIpv4(deviceIp)) {
    throw makeHttpError("Android VPN SOCKS 模式需要有效的设备 IP，请先刷新设备", 400);
  }

  const macRecord = findReachableMacIpForDevice(deviceIp);
  if (!macRecord || !macRecord.address) {
    throw makeHttpError("没有找到与 Android 同网段的 Mac IP，无法启动 Mac SOCKS 出口", 400);
  }

  const socks = await startSocksProxy({
    allowedIp: deviceIp,
    advertisedHost: macRecord.address,
    port: SOCKS_PORT,
    forceRestart: true,
  });
  const steps = [makeInternalStep("启动 Mac SOCKS 出口", socks.ok, socks.message)];

  steps.push(...(await runClearWeaknetSteps()));
  let response = buildWeaknetResponse("android-socks-preflight", "弱网下发前清理失败", steps, {
    privilege,
    socks,
  });
  if (!response.ok) return { ...response, macIp: macRecord.address, socksPort: SOCKS_PORT };

  steps.push(await installWeaknetRootAnchor());
  steps.push(await enablePf());
  response = buildWeaknetResponse("android-socks-preflight", "pf 初始化失败", steps, { privilege, socks });
  if (!response.ok) return { ...response, macIp: macRecord.address, socksPort: SOCKS_PORT };

  if (profile.disconnectMode === "always") {
    steps.push(await loadAnchorRules("加载 SOCKS 阻断规则", buildSocksBlockRules(deviceIp, macRecord.address, SOCKS_PORT)));
  } else {
    steps.push(...(await configureWeaknetPipes(profile)));
    response = buildWeaknetResponse("android-socks-shaped", "dummynet pipe 配置失败", steps, {
      privilege,
      socks,
    });
    if (!response.ok) return { ...response, macIp: macRecord.address, socksPort: SOCKS_PORT };

    steps.push(
      await loadAnchorRules("加载 SOCKS 弱网整形规则", buildSocksShapeRules(deviceIp, macRecord.address, SOCKS_PORT)),
    );
  }
  steps.push(...(await killSocksTunnelStates(deviceIp, macRecord.address)));

  const mode = profile.disconnectMode === "periodic" ? "android-socks-periodic" : "android-socks-shaped";
  response = buildWeaknetResponse(mode, "Mac SOCKS 弱网链路已准备", steps, { privilege, socks });
  if (response.ok) {
    rememberWeaknetProfile(profile, mode);
    startWeaknetTimers(profile, deviceIp, {
      shape: () => buildSocksShapeRules(deviceIp, macRecord.address, SOCKS_PORT),
      block: () => buildSocksBlockRules(deviceIp, macRecord.address, SOCKS_PORT),
      killStates: () => killSocksTunnelStates(deviceIp, macRecord.address),
    });
  }
  return { ...response, macIp: macRecord.address, socksPort: SOCKS_PORT };
}

async function clearAndroidVpn(body) {
  const serial = String(body.serial || body.deviceSerial || "").trim();
  if (!serial) throw makeHttpError("missing Android device serial", 400);

  const steps = [];
  const privilege = await getPrivilegeStatus();
  if (IS_WIN32) {
    if (socksRuntime.active || weaknetRuntime.active) {
      const weaknet = await clearWin32WeaknetRules();
      steps.push(...(weaknet.steps || []));
    }
  } else if (privilege.ok) {
    steps.push(...(await runClearWeaknetSteps()));
  } else if (socksRuntime.active || weaknetRuntime.active) {
    steps.push(makeInternalStep("跳过 Mac 弱网清理", false, privilege.message));
  }
  if (socksRuntime.active) {
    await stopSocksProxy();
    steps.push(makeInternalStep("停止 Mac SOCKS 出口", true, "Mac SOCKS 出口已停止"));
  }

  if (!(await isAndroidVpnAgentInstalled(serial))) {
    return {
      ok: steps.every((step) => step.ok),
      mode: "normal",
      message: "Android VPN Agent 未安装，无需清除",
      steps: publicizeSteps(steps),
      status: await getAndroidVpnAgentStatus(serial),
    };
  }

  const args = [
    "-s",
    serial,
    "shell",
    "am",
    "broadcast",
    "-n",
    ANDROID_VPN_AGENT.receiverComponent,
    "-a",
    ANDROID_VPN_AGENT.actions.stop,
  ];
  const result = await adb(args, 10000);
  steps.push(makeAdbStep("清除 Android VPN 弱网", args, result));
  await wait(500);
  const status = await getAndroidVpnAgentStatus(serial);
  const ok = result.ok && steps.every((step) => step.ok);
  return {
    ok,
    mode: "normal",
    message: ok ? "Android VPN 弱网已清除" : "Android VPN 弱网清除失败",
    steps: publicizeSteps(steps),
    status,
    error: ok ? "" : result.error || result.stderr || result.stdout || steps.filter((step) => !step.ok).map(formatStepError).join("；"),
  };
}

async function applyAndroidVpn(body) {
  const request = normalizeAndroidVpnRequest(body);
  const { serial, targetApp, profile } = request;
  const support = getAndroidVpnProfileSupport(profile);
  if (!support.supported) {
    throw makeHttpError(support.message, 400, { support, request });
  }

  if (support.mode === "normal") {
    const result = await clearAndroidVpn({ serial });
    return { ...result, ...request, support };
  }

  const steps = [];
  await ensureAndroidAgentApk(steps);
  const agentCurrent = await ensureAndroidVpnAgentCurrent(serial, steps);
  if (!agentCurrent.ok) {
    return {
      ...(agentCurrent.install || {}),
      ok: false,
      steps: publicizeSteps(steps),
      ...request,
      support,
    };
  }

  if (support.mode !== "socks" && (socksRuntime.active || weaknetRuntime.active)) {
    await clearAndroidVpn({ serial });
  }

  let profileForAgent = profile;
  let socksTunnel = null;
  if (support.mode === "socks") {
    socksTunnel = await prepareAndroidSocksWeaknet(request);
    steps.push(...(socksTunnel.steps || []));
    if (!socksTunnel.ok) {
      return {
        ...socksTunnel,
        ok: false,
        mode: socksTunnel.mode || "android-socks-preflight",
        steps: publicizeSteps(steps),
        ...request,
        support,
      };
    }
    profileForAgent = {
      ...profile,
      socksHost: socksTunnel.macIp,
      socksPort: socksTunnel.socksPort,
      socksUdpMode: "udp",
    };
  }

  const profileBase64 = encodeProfileForAndroidAgent(profileForAgent, targetApp);
  const args = [
    "-s",
    serial,
    "shell",
    "am",
    "broadcast",
    "-n",
    ANDROID_VPN_AGENT.receiverComponent,
    "-a",
    ANDROID_VPN_AGENT.actions.apply,
    "--es",
    "profileBase64",
    profileBase64,
    "--es",
    "targetPackage",
    targetApp,
  ];
  const result = await adb(args, 10000);
  steps.push(makeAdbStep("下发 Android VPN 弱网", args, result));
  await wait(900);
  let status = await getAndroidVpnAgentStatus(serial);

  if (status.status && status.status.mode === "needs_permission") {
    const auth = await openAndroidVpnAuthorization({ serial });
    return {
      ok: false,
      mode: "needs_permission",
      message: "Android VPN Agent 需要首次 VPN 授权；已打开手机授权页，请在手机上同意后再次点击应用预设",
      error: "Android VPN permission is required",
      requiresUserAction: true,
      steps: [...publicizeSteps(steps), ...(auth.steps || [])],
      status,
      ...request,
      support,
    };
  }

  const expectedMode = support.mode === "socks" ? "socks" : "blackhole";
  const ok = result.ok && status.status && status.status.running && status.status.mode === expectedMode;
  return {
    ok,
    mode: ok ? expectedMode : "android-vpn",
    message: ok
      ? `${profile.displayNameZh} 已通过 Android VPN Agent 下发`
      : "Android VPN Agent 下发后未进入预期状态",
    error: ok ? "" : result.error || result.stderr || (status.status && status.status.error) || status.message,
    steps: publicizeSteps(steps),
    status,
    socksTunnel,
    ...request,
    support,
  };
}

function getOneWayDelay(profile) {
  if (profile.latencyRttMs === null || profile.latencyRttMs === undefined) return null;
  return Math.round(profile.latencyRttMs / 2);
}

function getDynamicDelay(profile) {
  const baseDelay = getOneWayDelay(profile);
  if (baseDelay === null) return null;
  const jitter = Math.round((profile.jitterMs || 0) / 2);
  if (!jitter) return baseDelay;
  const min = Math.max(0, baseDelay - jitter);
  const max = baseDelay + jitter;
  return Math.round(min + Math.random() * (max - min));
}

function isNetworkWaveEnabled(profile) {
  return Boolean(profile && profile.networkWave && profile.networkWave.enabled);
}

function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function randomFloat(min, max) {
  return min + Math.random() * (max - min);
}

function buildNetworkWavePipeProfile(profile, initial = false) {
  const source = initial
    ? NETWORK_WAVE_CONFIG.initial
    : Math.random() < NETWORK_WAVE_CONFIG.signalLost.chance
      ? NETWORK_WAVE_CONFIG.signalLost
      : NETWORK_WAVE_CONFIG.normal;

  if (initial) {
    return {
      ...profile,
      downloadKbps: source.downloadKbps,
      uploadKbps: source.uploadKbps,
      packetLossPercent: source.packetLossPercent,
      pipeDelayMs: source.pipeDelayMs,
      networkWave: { enabled: true, mode: NETWORK_WAVE_CONFIG.mode },
    };
  }

  return {
    ...profile,
    downloadKbps: randomInt(source.downloadMinKbps, source.downloadMaxKbps),
    uploadKbps: randomInt(source.uploadMinKbps, source.uploadMaxKbps),
    packetLossPercent: Number(randomFloat(source.packetLossMinPercent, source.packetLossMaxPercent).toFixed(2)),
    pipeDelayMs: randomInt(source.delayMinMs, source.delayMaxMs),
    networkWave: { enabled: true, mode: NETWORK_WAVE_CONFIG.mode },
  };
}

function getPipeDelay(profile) {
  const pipeDelay = Number(profile && profile.pipeDelayMs);
  if (Number.isFinite(pipeDelay)) return pipeDelay;
  return getDynamicDelay(profile);
}

function buildPipeArgs(pipeId, bandwidthKbps, delayMs, plr) {
  const args = ["pipe", String(pipeId), "config"];
  if (bandwidthKbps !== null && bandwidthKbps !== undefined) {
    args.push("bw", `${Math.round(bandwidthKbps)}Kbit/s`);
  }
  if (delayMs !== null && delayMs !== undefined) {
    args.push("delay", `${Math.round(delayMs)}ms`);
  }
  args.push("plr", plr.toFixed(3));
  return args;
}

function normalizeBandwidthUnit(value, unit) {
  if (unit === "Kbit/s") return { value, unit: "Kbps", kbps: value };
  if (unit === "Mbit/s") return { value, unit: "Mbps", kbps: value * 1000 };
  if (unit === "Gbit/s") return { value: value * 1000, unit: "Mbps", kbps: value * 1000000 };
  return { value, unit: "Kbps", kbps: value };
}

function bandwidthFromKbps(kbps) {
  if (kbps === null || kbps === undefined) return null;
  const value = Number(kbps);
  if (!Number.isFinite(value)) return null;
  if (value >= 1000) return { value: Number((value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)), unit: "Mbps", kbps: value };
  return { value: Math.round(value), unit: "Kbps", kbps: value };
}

function extractPipeBandwidth(pipeOutput) {
  const match = String(pipeOutput || "").match(/([\d.]+)\s*(Kbit\/s|Mbit\/s|Gbit\/s)/);
  if (!match) return null;
  return normalizeBandwidthUnit(Number(match[1]), match[2]);
}

async function readPipeBandwidth(pipeId) {
  const result = await run(DNCTL, ["pipe", String(pipeId), "show"], 4000);
  const bandwidth = extractPipeBandwidth(`${result.stdout}\n${result.stderr}`);
  return {
    ok: result.ok,
    pipeId,
    bandwidth,
    error: result.ok ? "" : result.error || result.stderr,
  };
}

async function getNetworkCurveStatus() {
  if (IS_WIN32) {
    return getWin32NetworkCurveStatus();
  }

  const [downPipe, upPipe] = await Promise.all([readPipeBandwidth(PIPE_DOWN), readPipeBandwidth(PIPE_UP)]);
  const permissionDenied = /Operation not permitted|permission/i.test(`${downPipe.error}\n${upPipe.error}`);
  const profile = weaknetRuntime.activeProfile || {};
  const statusProfile = weaknetRuntime.currentPipeProfile || profile;
  const profileDown = weaknetRuntime.active ? bandwidthFromKbps(statusProfile.downloadKbps) : null;
  const profileUp = weaknetRuntime.active ? bandwidthFromKbps(statusProfile.uploadKbps) : null;
  const downBandwidth = profileDown || downPipe.bandwidth;
  const upBandwidth = profileUp || upPipe.bandwidth;
  const active = weaknetRuntime.active || Boolean(downBandwidth || upBandwidth);
  const blocked = active && weaknetRuntime.blocked;
  const downKbps = blocked ? 0 : downBandwidth ? downBandwidth.kbps : 0;
  const upKbps = blocked ? 0 : upBandwidth ? upBandwidth.kbps : 0;
  const pipeDelayMs = Number(statusProfile.pipeDelayMs);
  const packetLossPercent = Number(statusProfile.packetLossPercent);
  const networkWave = isNetworkWaveEnabled(profile);

  return {
    ok: !permissionDenied,
    active,
    blocked,
    permissionDenied,
    jitter: Boolean(weaknetRuntime.jitterInterval) || networkWave,
    networkWave: networkWave ? { enabled: true, mode: profile.networkWave.mode || NETWORK_WAVE_CONFIG.mode } : { enabled: false },
    pipeDelayMs: active && Number.isFinite(pipeDelayMs) ? pipeDelayMs : null,
    packetLossPercent: active && Number.isFinite(packetLossPercent) ? packetLossPercent : null,
    mode: weaknetRuntime.activeMode,
    timestamp: Date.now(),
    download: active && downBandwidth && !blocked ? { value: downBandwidth.value, unit: downBandwidth.unit } : null,
    upload: active && upBandwidth && !blocked ? { value: upBandwidth.value, unit: upBandwidth.unit } : null,
    downKbps,
    upKbps,
    pipes: {
      down: { pipeId: PIPE_DOWN, ok: downPipe.ok, source: profileDown ? "profile" : downPipe.bandwidth ? "pipe" : "none", error: downPipe.error },
      up: { pipeId: PIPE_UP, ok: upPipe.ok, source: profileUp ? "profile" : upPipe.bandwidth ? "pipe" : "none", error: upPipe.error },
    },
  };
}

function buildShapeRules(deviceIp) {
  return [
    `dummynet out quick from any to ${deviceIp} pipe ${PIPE_DOWN}`,
    `dummynet in quick from ${deviceIp} to any pipe ${PIPE_UP}`,
    "",
  ].join("\n");
}

function buildBlockRules(deviceIp) {
  return [`block drop quick from ${deviceIp} to any`, `block drop quick from any to ${deviceIp}`, ""].join("\n");
}

function formatPfAddressList(addresses) {
  const unique = [...new Set(addresses.filter(Boolean))];
  return unique.length === 1 ? unique[0] : `{ ${unique.join(" ")} }`;
}

function parseMacUnityTargetEndpoint(input) {
  const raw = String(input || "").trim();
  if (!raw) {
    throw makeHttpError("Mac Unity 本机弱网需要填写目标服务器，例如 1.2.3.4、1.2.3.4:443 或 example.com", 400);
  }

  let host = raw;
  let port = "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    const url = new URL(raw);
    host = url.hostname;
    port = url.port;
  } else if (raw.includes("/")) {
    const url = new URL(`https://${raw}`);
    host = url.hostname;
    port = url.port;
  } else {
    const hostPort = raw.match(/^([^:\s]+):([0-9]{1,5})$/);
    if (hostPort) {
      host = hostPort[1];
      port = hostPort[2];
    }
  }

  host = String(host || "").trim().replace(/^\[(.*)\]$/, "$1");
  if (!host || host.includes(":")) {
    throw makeHttpError("Mac Unity 本机弱网当前只支持 IPv4 或可解析到 IPv4 的域名", 400);
  }
  if (!isValidIpv4(host) && !/^[A-Za-z0-9.-]+$/.test(host)) {
    throw makeHttpError("目标服务器格式不合法，请填写 IPv4、域名或 host:port", 400);
  }

  const portNumber = port ? Number(port) : null;
  if (portNumber !== null && (!Number.isInteger(portNumber) || portNumber <= 0 || portNumber > 65535)) {
    throw makeHttpError("目标端口不合法，应为 1-65535", 400);
  }

  return { input: raw, host, port: portNumber };
}

function splitMacUnityTargetInput(input) {
  return String(input || "")
    .split(/[\n,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readMacUnityBuiltinTargets() {
  if (process.env.MAC_UNITY_TARGETS && process.env.MAC_UNITY_TARGETS.trim()) {
    return {
      source: "env",
      targets: splitMacUnityTargetInput(process.env.MAC_UNITY_TARGETS),
    };
  }

  try {
    const raw = fs.readFileSync(MAC_UNITY_TARGETS_FILE, "utf8");
    const json = JSON.parse(raw);
    const targets = Array.isArray(json.targets) ? json.targets.map(String).map((item) => item.trim()).filter(Boolean) : [];
    return {
      source: "file",
      file: MAC_UNITY_TARGETS_FILE,
      targets,
    };
  } catch (error) {
    return {
      source: "missing",
      file: MAC_UNITY_TARGETS_FILE,
      targets: [],
      error: error.code === "ENOENT" ? "" : error.message,
    };
  }
}

function getMacUnityBuiltinTargetInput() {
  const builtin = readMacUnityBuiltinTargets();
  return Array.isArray(builtin.targets) ? builtin.targets.join(", ") : "";
}

function getUnsafeMacUnityAddressReason(address, gatewayIp) {
  const parts = getIpv4Parts(address);
  if (!parts) return "目标服务器不是有效 IPv4 地址";
  if (parts[0] === 0) return "0.0.0.0/8 是保留地址";
  if (parts[0] === 127) return "127.0.0.0/8 是本机回环地址";
  if (parts[0] === 169 && parts[1] === 254) return "169.254.0.0/16 是链路本地地址";
  if (parts[0] >= 224 && parts[0] <= 239) return "224.0.0.0/4 是组播地址";
  if (parts[0] >= 240) return "240.0.0.0/4 是保留地址";
  if (parts[3] === 0 || parts[3] === 255) return "目标地址看起来像网段或广播地址";
  if (gatewayIp && address === gatewayIp) return "目标地址是 Mac 当前默认网关";
  if (getMacIpv4Records().some((item) => item.address === address)) return "目标地址是 Mac 本机地址";
  return "";
}

async function resolveMacUnityTarget(endpoint) {
  const parsed = parseMacUnityTargetEndpoint(endpoint);
  let addresses = [];
  if (isValidIpv4(parsed.host)) {
    addresses = [parsed.host];
  } else {
    try {
      addresses = (await dns.lookup(parsed.host, { family: 4, all: true })).map((item) => item.address);
    } catch (error) {
      throw makeHttpError(`目标服务器解析失败：${error.message}`, 400, { targetEndpoint: parsed.input });
    }
  }

  addresses = [...new Set(addresses)].filter(isValidIpv4);
  if (!addresses.length) {
    throw makeHttpError("目标服务器没有可用 IPv4 地址", 400, { targetEndpoint: parsed.input });
  }

  const gatewayIp = await getDefaultGatewayIp();
  const unsafe = addresses
    .map((address) => ({ address, reason: getUnsafeMacUnityAddressReason(address, gatewayIp) }))
    .find((item) => item.reason);
  if (unsafe) {
    throw makeHttpError(`Mac Unity 目标防护：${unsafe.address} ${unsafe.reason}`, 400, {
      targetEndpoint: parsed.input,
      address: unsafe.address,
      gatewayIp,
    });
  }

  return {
    ...parsed,
    addresses,
    addressList: formatPfAddressList(addresses),
  };
}

async function resolveMacUnityTargets(endpoint) {
  const items = splitMacUnityTargetInput(endpoint);
  if (!items.length) {
    throw makeHttpError("Mac Unity 本机弱网需要填写目标服务器，例如 1.2.3.4:443, 1.2.3.4:9000", 400);
  }
  const targets = [];
  const seen = new Set();
  for (const item of items) {
    const target = await resolveMacUnityTarget(item);
    const key = `${target.addresses.join(",")}:${target.port || "*"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push(target);
  }
  return targets;
}

function buildMacUnityShapeRules(targets) {
  return targets.map((target) => buildMacUnityShapeRule(target)).join("");
}

function buildMacUnityShapeRule(target) {
  const outboundTarget = `${target.addressList}${target.port ? ` port ${target.port}` : ""}`;
  const inboundSource = `${target.addressList}${target.port ? ` port ${target.port}` : ""}`;
  return [
    `dummynet out quick proto { tcp udp } from any to ${outboundTarget} pipe ${PIPE_UP}`,
    `dummynet in quick proto { tcp udp } from ${inboundSource} to any pipe ${PIPE_DOWN}`,
    "",
  ].join("\n");
}

function buildMacUnityBlockRules(targets) {
  return targets.map((target) => buildMacUnityBlockRule(target)).join("");
}

function buildMacUnityBlockRule(target) {
  const outboundTarget = `${target.addressList}${target.port ? ` port ${target.port}` : ""}`;
  const inboundSource = `${target.addressList}${target.port ? ` port ${target.port}` : ""}`;
  return [
    `block drop quick proto { tcp udp } from any to ${outboundTarget}`,
    `block drop quick proto { tcp udp } from ${inboundSource} to any`,
    "",
  ].join("\n");
}

function getMacUnityTargetAddresses(targets) {
  return [...new Set(targets.flatMap((target) => target.addresses || []))].filter(isValidIpv4);
}

async function killMacUnityTargetStates(targets) {
  const steps = [];
  for (const address of getMacUnityTargetAddresses(targets)) {
    steps.push(
      await runPrivileged(`清理 Mac Unity 目标旧连接状态 ${address}`, PFCTL, ["-k", "0.0.0.0/0", "-k", address], {
        timeoutMs: 8000,
      }),
    );
    steps.push(
      await runPrivileged(`清理 Mac Unity 目标回程旧连接状态 ${address}`, PFCTL, ["-k", address, "-k", "0.0.0.0/0"], {
        timeoutMs: 8000,
      }),
    );
  }
  return steps;
}

function buildMacGlobalShapeRules() {
  return [
    `dummynet in quick on ! lo0 proto tcp all pipe ${PIPE_DOWN}`,
    `dummynet in quick on ! lo0 proto udp all pipe ${PIPE_DOWN}`,
    `dummynet out quick on ! lo0 proto tcp all pipe ${PIPE_UP}`,
    `dummynet out quick on ! lo0 proto udp all pipe ${PIPE_UP}`,
    "",
  ].join("\n");
}

function buildMacGlobalBlockRules() {
  return [
    "block drop in quick on ! lo0 proto tcp all",
    "block drop in quick on ! lo0 proto udp all",
    "block drop out quick on ! lo0 proto tcp all",
    "block drop out quick on ! lo0 proto udp all",
    "",
  ].join("\n");
}

async function flushMacGlobalStates() {
  return [
    await runPrivileged("清理 Mac 全局旧连接状态", PFCTL, ["-F", "states"], {
      timeoutMs: 8000,
    }),
  ];
}

function buildSocksShapeRules(deviceIp, macIp, socksPort) {
  return [
    `dummynet out quick proto tcp from ${macIp} port ${socksPort} to ${deviceIp} pipe ${PIPE_DOWN}`,
    `dummynet out quick proto udp from ${macIp} port ${socksPort} to ${deviceIp} pipe ${PIPE_DOWN}`,
    `dummynet in quick proto tcp from ${deviceIp} to ${macIp} port ${socksPort} pipe ${PIPE_UP}`,
    `dummynet in quick proto udp from ${deviceIp} to ${macIp} port ${socksPort} pipe ${PIPE_UP}`,
    "",
  ].join("\n");
}

function buildSocksBlockRules(deviceIp, macIp, socksPort) {
  return [
    `block drop quick proto tcp from ${deviceIp} to ${macIp} port ${socksPort}`,
    `block drop quick proto udp from ${deviceIp} to ${macIp} port ${socksPort}`,
    `block drop quick proto tcp from ${macIp} port ${socksPort} to ${deviceIp}`,
    `block drop quick proto udp from ${macIp} port ${socksPort} to ${deviceIp}`,
    "",
  ].join("\n");
}

async function killSocksTunnelStates(deviceIp, macIp) {
  return [
    await runPrivileged("清理 Android SOCKS 上行旧连接状态", PFCTL, ["-k", deviceIp, "-k", macIp], {
      timeoutMs: 8000,
    }),
    await runPrivileged("清理 Android SOCKS 下行旧连接状态", PFCTL, ["-k", macIp, "-k", deviceIp], {
      timeoutMs: 8000,
    }),
  ];
}

function buildRootRulesWithAnchor() {
  const pfConf = fs.readFileSync("/etc/pf.conf", "utf8");
  const anchorLines = [`dummynet-anchor "${WEAKNET_ANCHOR}"`, `anchor "${WEAKNET_ANCHOR}"`].filter((line) => {
    return !new RegExp(`^\\s*${escapeRegExp(line)}\\s*$`, "m").test(pfConf);
  });

  if (!anchorLines.length) return pfConf;
  return [
    pfConf.trimEnd(),
    "",
    "# weaknet-console temporary runtime anchor",
    ...anchorLines,
    "",
  ].join("\n");
}

function toPublicStep(step) {
  return {
    label: step.label,
    ok: step.ok,
    command: [step.command, ...step.args].join(" "),
    stdout: step.stdout.trim(),
    stderr: step.stderr.trim(),
    error: step.error.trim(),
  };
}

function publicizeSteps(steps = []) {
  return steps.map((step) => (Array.isArray(step.args) ? toPublicStep(step) : step));
}

function formatStepError(step) {
  const detail = (step.error || step.stderr || step.stdout || "unknown error").trim();
  if (/sudo|password is required|a terminal is required/i.test(detail)) {
    return `${step.label}: 需要管理员权限。请停止当前服务，并用 start-admin.command 或 sudo node server.js 重新启动。`;
  }
  return `${step.label}: ${detail}`;
}

function buildWeaknetResponse(mode, message, steps, extra = {}) {
  const failed = steps.filter((step) => !step.ok);
  return {
    ok: failed.length === 0,
    mode,
    message,
    error: failed.map(formatStepError).join("；"),
    steps: steps.map(toPublicStep),
    ...extra,
  };
}

function rememberWeaknetProfile(profile, mode) {
  weaknetRuntime.active = true;
  weaknetRuntime.activeProfile = profile ? { ...profile } : null;
  if (!isNetworkWaveEnabled(profile)) {
    weaknetRuntime.currentPipeProfile = null;
  }
  weaknetRuntime.activeMode = mode || "weaknet";
}

function stopWeaknetTimers() {
  weaknetRuntime.generation += 1;
  weaknetRuntime.blocked = false;
  clearInterval(weaknetRuntime.periodicInterval);
  clearInterval(weaknetRuntime.jitterInterval);
  clearTimeout(weaknetRuntime.jitterInterval);
  clearTimeout(weaknetRuntime.periodicTimeout);
  weaknetRuntime.periodicInterval = null;
  weaknetRuntime.jitterInterval = null;
  weaknetRuntime.periodicTimeout = null;
  weaknetRuntime.currentPipeProfile = null;
}

async function runClearWeaknetSteps() {
  stopWeaknetTimers();
  weaknetRuntime.active = false;
  weaknetRuntime.activeProfile = null;
  weaknetRuntime.currentPipeProfile = null;
  weaknetRuntime.activeMode = "normal";
  return [
    await runPrivileged("清理 pf anchor", PFCTL, ["-a", WEAKNET_ANCHOR, "-F", "all"], { timeoutMs: 8000 }),
    await runPrivileged("清理 dummynet pipe", DNCTL, ["-q", "flush"], { timeoutMs: 8000 }),
  ];
}

function getWin32DriverOptions() {
  const options = { runtimeDir: WIN32_RUNTIME_DIR };
  if (process.env.WEAKNET_WIN32_SHAPER) {
    options.executable = process.env.WEAKNET_WIN32_SHAPER;
  }
  return options;
}

function mapWin32TargetScope(targetScope) {
  if (targetScope === "mac-global" || targetScope === "win-global") return "win-global";
  if (targetScope === "mac-unity" || targetScope === "win-target") return "win-target";
  if (targetScope === "macos" || targetScope === "device" || targetScope === "win-gateway") return "win-gateway";
  return targetScope;
}

function getWin32TargetLabel(scope) {
  if (scope === "win-global") return "Windows 全局流量";
  if (scope === "win-target") return "Windows 目标流量";
  if (scope === "android-socks") return "Android SOCKS 隧道";
  return "Windows 网关流量";
}

function makeWin32Step(label, ok, payload) {
  const message =
    typeof payload === "string"
      ? payload
      : payload && payload.message
        ? payload.message
        : payload && payload.error
          ? payload.error
          : ok
            ? "ok"
            : "failed";
  return makeInternalStep(label, ok, message);
}

function resetWeaknetRuntimeState() {
  stopWeaknetTimers();
  weaknetRuntime.active = false;
  weaknetRuntime.activeProfile = null;
  weaknetRuntime.currentPipeProfile = null;
  weaknetRuntime.startedAt = null;
  weaknetRuntime.activeMode = "normal";
}

function rememberWin32WeaknetProfile(profile, mode) {
  rememberWeaknetProfile(profile, mode);
  weaknetRuntime.blocked = profile && profile.disconnectMode === "always";
  weaknetRuntime.startedAt = Date.now();
}

function isWin32PeriodicBlocked(profile, snapshot) {
  if (!profile || profile.disconnectMode !== "periodic") return false;
  if (!(profile.disconnectDurationSec > 0) || !(profile.disconnectIntervalSec > 0)) return false;

  const startedAtRaw = (snapshot && snapshot.startedAt) || weaknetRuntime.startedAt;
  const startedAtMs = new Date(startedAtRaw).getTime();
  if (!Number.isFinite(startedAtMs)) return false;

  const elapsedSec = Math.max(0, (Date.now() - startedAtMs) / 1000);
  const position = elapsedSec % profile.disconnectIntervalSec;
  return position < profile.disconnectDurationSec;
}

function getWin32ProfileDelayMs(profile) {
  const explicitDelay = Number(profile && profile.pipeDelayMs);
  if (Number.isFinite(explicitDelay)) return explicitDelay;
  const latency = Number(profile && profile.latencyRttMs);
  return Number.isFinite(latency) ? Math.round(latency / 2) : null;
}

async function clearWin32WeaknetRules(extra = {}) {
  resetWeaknetRuntimeState();
  const steps = [];
  try {
    const result = win32Weaknet.clearWin32Weaknet(getWin32DriverOptions());
    steps.push(makeWin32Step("停止 Windows WinDivert 后端", true, result));
    return buildWeaknetResponse("normal", "Windows 弱网规则已清理", steps, extra);
  } catch (error) {
    steps.push(makeWin32Step("停止 Windows WinDivert 后端", false, error.message));
    return buildWeaknetResponse("normal", "Windows 弱网规则清理失败", steps, extra);
  }
}

function getWin32NetworkCurveStatus() {
  const runtimeStatus = win32Weaknet.readWin32WeaknetStatus(getWin32DriverOptions());
  const snapshot = runtimeStatus.status || null;
  const profile = (snapshot && snapshot.profile) || weaknetRuntime.activeProfile || {};
  const active = Boolean(weaknetRuntime.active || (runtimeStatus.running && snapshot && snapshot.ok !== false));
  const blocked = Boolean(
    active &&
      (weaknetRuntime.blocked || profile.disconnectMode === "always" || isWin32PeriodicBlocked(profile, snapshot)),
  );
  const downBandwidth = active ? bandwidthFromKbps(profile.downloadKbps) : null;
  const upBandwidth = active ? bandwidthFromKbps(profile.uploadKbps) : null;
  const downKbps = blocked ? 0 : downBandwidth ? downBandwidth.kbps : 0;
  const upKbps = blocked ? 0 : upBandwidth ? upBandwidth.kbps : 0;
  const pipeDelayMs = getWin32ProfileDelayMs(profile);
  const packetLossPercent = Number(profile.packetLossPercent);
  const networkWave = isNetworkWaveEnabled(profile);

  return {
    ok: true,
    active,
    blocked,
    permissionDenied: false,
    jitter: Boolean(active && ((profile.jitterMs || 0) > 0 || networkWave)),
    networkWave: networkWave ? { enabled: true, mode: profile.networkWave.mode || NETWORK_WAVE_CONFIG.mode } : { enabled: false },
    pipeDelayMs: active && Number.isFinite(pipeDelayMs) ? pipeDelayMs : null,
    packetLossPercent: active && Number.isFinite(packetLossPercent) ? packetLossPercent : null,
    mode: (snapshot && snapshot.mode) || weaknetRuntime.activeMode,
    timestamp: Date.now(),
    download: active && downBandwidth && !blocked ? { value: downBandwidth.value, unit: downBandwidth.unit } : null,
    upload: active && upBandwidth && !blocked ? { value: upBandwidth.value, unit: upBandwidth.unit } : null,
    downKbps,
    upKbps,
    pipes: {
      down: { pipeId: "win32-download", ok: true, source: "win32", error: "" },
      up: { pipeId: "win32-upload", ok: true, source: "win32", error: "" },
    },
    win32: runtimeStatus,
  };
}

async function applyWin32Weaknet(body) {
  const privilege = await requireWeaknetPrivilege();
  const request = normalizeWeaknetRequest(body);
  const { profile } = request;
  const win32Scope = mapWin32TargetScope(request.targetScope);
  let effectiveRequest = request;
  let resolvedMacUnityTargets = [];

  if (profile.presetKey === "normal") {
    return clearWin32WeaknetRules({ ...request, privilege, win32Scope });
  }

  if (request.targetScope === "mac-unity") {
    const fallbackTargetEndpoint = request.targetEndpoint || getMacUnityBuiltinTargetInput();
    effectiveRequest = {
      ...request,
      targetEndpoint: fallbackTargetEndpoint,
      targetApp: request.targetApp || fallbackTargetEndpoint,
    };
    try {
      resolvedMacUnityTargets = await resolveMacUnityTargets(fallbackTargetEndpoint);
    } catch (error) {
      const steps = [makeWin32Step("解析 Windows 目标弱网内置目标", false, error.message)];
      return buildWeaknetResponse("win32-config", "Windows 目标弱网目标解析失败", steps, {
        ...effectiveRequest,
        privilege,
        win32Scope,
      });
    }
  }

  const steps = [];
  let config = null;
  try {
    config = win32Weaknet.buildWin32WeaknetConfig({
      ...effectiveRequest,
      targetScope: win32Scope,
      resolvedTargets: resolvedMacUnityTargets,
    });
    steps.push(makeWin32Step("生成 Windows WinDivert 配置", true, `mode=${config.mode}, rules=${config.rules.length}`));
  } catch (error) {
    steps.push(makeWin32Step("生成 Windows WinDivert 配置", false, error.message));
    return buildWeaknetResponse("win32-config", "Windows WinDivert 配置生成失败", steps, {
      ...effectiveRequest,
      privilege,
      win32Scope,
    });
  }

  try {
    const stopResult = win32Weaknet.clearWin32Weaknet(getWin32DriverOptions());
    steps.push(makeWin32Step("清理上一次 Windows WinDivert 后端", true, stopResult));
  } catch (error) {
    steps.push(makeWin32Step("清理上一次 Windows WinDivert 后端", false, error.message));
    return buildWeaknetResponse("win32-preflight", "Windows WinDivert 下发前清理失败", steps, {
      ...effectiveRequest,
      privilege,
      win32Scope,
    });
  }

  let startResult = null;
  try {
    startResult = win32Weaknet.startWin32Weaknet(
      { ...effectiveRequest, targetScope: win32Scope, resolvedTargets: resolvedMacUnityTargets },
      { ...getWin32DriverOptions(), config },
    );
    steps.push(makeWin32Step("启动 Windows WinDivert 后端", true, `pid=${startResult.pid}, exe=${startResult.executable}`));
  } catch (error) {
    steps.push(makeWin32Step("启动 Windows WinDivert 后端", false, error.message));
    return buildWeaknetResponse("win32-start", "Windows WinDivert 后端启动失败", steps, {
      ...effectiveRequest,
      privilege,
      win32Scope,
    });
  }

  const response = buildWeaknetResponse(win32Scope, `${profile.displayNameZh} 已下发到 ${getWin32TargetLabel(win32Scope)}`, steps, {
    ...effectiveRequest,
    privilege,
    win32Scope,
    macUnityTargets: resolvedMacUnityTargets,
    win32: {
      pid: startResult.pid,
      executable: startResult.executable,
      configFile: startResult.configFile,
      statusFile: startResult.statusFile,
      pidFile: startResult.pidFile,
      logFile: startResult.logFile,
    },
  });
  if (response.ok) rememberWin32WeaknetProfile(profile, win32Scope);
  return response;
}

async function installWeaknetRootAnchor() {
  try {
    return await runPrivileged("安装 pf root anchor", PFCTL, ["-f", "-"], {
      input: buildRootRulesWithAnchor(),
      timeoutMs: 10000,
    });
  } catch (error) {
    return {
      label: "安装 pf root anchor",
      command: PFCTL,
      args: ["-f", "-"],
      ok: false,
      stdout: "",
      stderr: "",
      error: error.message,
    };
  }
}

async function enablePf() {
  const step = await runPrivileged("启用 pf", PFCTL, ["-E"], { timeoutMs: 8000 });
  if (!step.ok && /already enabled|pf is enabled/i.test(`${step.stderr}\n${step.stdout}\n${step.error}`)) {
    step.ok = true;
    step.error = "";
  }
  return step;
}

async function loadAnchorRules(label, rules) {
  return runPrivileged(label, PFCTL, ["-a", WEAKNET_ANCHOR, "-f", "-"], {
    input: rules,
    timeoutMs: 8000,
  });
}

async function configureWeaknetPipes(profile, options = {}) {
  const effectiveProfile = isNetworkWaveEnabled(profile)
    ? buildNetworkWavePipeProfile(profile, options.initial || !weaknetRuntime.currentPipeProfile)
    : profile;
  if (isNetworkWaveEnabled(profile)) {
    weaknetRuntime.currentPipeProfile = { ...effectiveProfile };
  }
  const plr = Math.min(1, Math.max(0, Number(effectiveProfile.packetLossPercent || 0) / 100));
  const delayMs = getPipeDelay(effectiveProfile);
  return [
    await runPrivileged("配置下行 pipe", DNCTL, buildPipeArgs(PIPE_DOWN, effectiveProfile.downloadKbps, delayMs, plr), {
      timeoutMs: 8000,
    }),
    await runPrivileged("配置上行 pipe", DNCTL, buildPipeArgs(PIPE_UP, effectiveProfile.uploadKbps, delayMs, plr), {
      timeoutMs: 8000,
    }),
  ];
}

function logTimerFailure(context, steps) {
  const failed = steps.filter((step) => !step.ok);
  if (failed.length) {
    console.warn(`[weaknet] ${context}: ${failed.map(formatStepError).join("; ")}`);
  }
}

function startWeaknetTimers(profile, deviceIp, rules = {}) {
  const generation = weaknetRuntime.generation;
  const usesShaping = profile.disconnectMode !== "always";
  const shapeRules = rules.shape || (() => buildShapeRules(deviceIp));
  const blockRules = rules.block || (() => buildBlockRules(deviceIp));
  const killStates = rules.killStates || (async () => []);

  if (usesShaping && isNetworkWaveEnabled(profile)) {
    const scheduleNetworkWaveTick = () => {
      const waitMs = randomInt(NETWORK_WAVE_CONFIG.intervalMinMs, NETWORK_WAVE_CONFIG.intervalMaxMs);
      weaknetRuntime.jitterInterval = setTimeout(async () => {
        if (weaknetRuntime.generation !== generation || weaknetRuntime.blocked) return;
        logTimerFailure("网络波动重配", await configureWeaknetPipes(profile, { initial: false }));
        if (weaknetRuntime.generation === generation) scheduleNetworkWaveTick();
      }, waitMs);
    };
    scheduleNetworkWaveTick();
  } else if (usesShaping && profile.jitterMs > 0 && getOneWayDelay(profile) !== null) {
    weaknetRuntime.jitterInterval = setInterval(async () => {
      if (weaknetRuntime.generation !== generation || weaknetRuntime.blocked) return;
      logTimerFailure("动态抖动重配", await configureWeaknetPipes(profile));
    }, 2000);
  }

  if (profile.disconnectMode !== "periodic") return;

  const intervalMs = Math.max(1000, profile.disconnectIntervalSec * 1000);
  const durationMs = Math.min(intervalMs, Math.max(1000, profile.disconnectDurationSec * 1000));

  weaknetRuntime.periodicInterval = setInterval(async () => {
    if (weaknetRuntime.generation !== generation) return;
    weaknetRuntime.blocked = true;
    const blockStep = await loadAnchorRules("切换为周期阻断规则", blockRules());
    const blockKillSteps = await killStates();
    logTimerFailure("周期阻断", [blockStep, ...blockKillSteps]);

    clearTimeout(weaknetRuntime.periodicTimeout);
    weaknetRuntime.periodicTimeout = setTimeout(async () => {
      if (weaknetRuntime.generation !== generation) return;
      weaknetRuntime.blocked = false;
      const shapeStep = await loadAnchorRules("恢复弱网整形规则", shapeRules());
      const shapeKillSteps = await killStates();
      logTimerFailure("周期恢复", [shapeStep, ...shapeKillSteps]);
    }, durationMs);
  }, intervalMs);
}

async function clearWeaknetRules() {
  if (IS_WIN32) {
    return clearWin32WeaknetRules();
  }

  const privilege = await requireWeaknetPrivilege();
  const steps = await runClearWeaknetSteps();
  return buildWeaknetResponse("normal", "弱网规则已清理", steps, { privilege });
}

async function stopService(body = {}) {
  const serial = String(body.serial || "").trim();
  let androidVpn = null;
  if (serial) {
    try {
      androidVpn = await clearAndroidVpn({ serial });
    } catch (error) {
      androidVpn = {
        ok: false,
        mode: "android-vpn-clear",
        message: "Android VPN 清除失败",
        error: error.message,
        steps: publicizeSteps(error.steps || []),
      };
    }
  }

  let weaknet = null;
  try {
    weaknet = await clearWeaknetRules();
  } catch (error) {
    weaknet = {
      ok: false,
      mode: "normal",
      message: IS_WIN32 ? "Windows 弱网规则清理失败" : "Mac 弱网规则清理失败",
      error: error.message,
      steps: publicizeSteps(error.steps || []),
    };
  }

  const ok = Boolean(weaknet && weaknet.ok && (!androidVpn || androidVpn.ok));
  return {
    ok,
    stopping: ok,
    mode: "service-stop",
    message: ok ? "本机弱网服务正在停止" : "停止服务前清理失败",
    weaknet,
    androidVpn,
  };
}

async function applyMacUnityWeaknet(request, privilege) {
  const { profile } = request;
  const targets = profile.presetKey === "normal" ? [] : await resolveMacUnityTargets(request.targetEndpoint);
  const steps = await runClearWeaknetSteps();

  if (profile.presetKey === "normal") {
    return buildWeaknetResponse("normal", "Mac Unity 本机弱网已清理", steps, { ...request, privilege });
  }

  let response = buildWeaknetResponse("mac-unity-preflight", "Mac Unity 弱网下发前清理失败", steps, {
    ...request,
    privilege,
    macUnityTargets: targets,
  });
  if (!response.ok) return response;

  steps.push(await installWeaknetRootAnchor());
  steps.push(await enablePf());
  response = buildWeaknetResponse("mac-unity-preflight", "pf 初始化失败", steps, {
    ...request,
    privilege,
    macUnityTargets: targets,
  });
  if (!response.ok) return response;

  if (profile.disconnectMode === "always") {
    steps.push(await loadAnchorRules("加载 Mac Unity 阻断规则", buildMacUnityBlockRules(targets)));
    steps.push(...(await killMacUnityTargetStates(targets)));
    response = buildWeaknetResponse("mac-unity-always", `${profile.displayNameZh} 已下发到 Mac Unity 目标`, steps, {
      ...request,
      privilege,
      macUnityTargets: targets,
    });
    if (response.ok) rememberWeaknetProfile(profile, "mac-unity-always");
    return response;
  }

  steps.push(...(await configureWeaknetPipes(profile)));
  response = buildWeaknetResponse("mac-unity-shaped", "dummynet pipe 配置失败", steps, {
    ...request,
    privilege,
    macUnityTargets: targets,
  });
  if (!response.ok) return response;

  steps.push(await loadAnchorRules("加载 Mac Unity 弱网整形规则", buildMacUnityShapeRules(targets)));
  steps.push(...(await killMacUnityTargetStates(targets)));
  const mode = profile.disconnectMode === "periodic" ? "mac-unity-periodic" : "mac-unity-shaped";
  response = buildWeaknetResponse(mode, `${profile.displayNameZh} 已下发到 Mac Unity 目标`, steps, {
    ...request,
    privilege,
    macUnityTargets: targets,
  });
  if (response.ok) {
    rememberWeaknetProfile(profile, mode);
    startWeaknetTimers(profile, targets.map((target) => target.input).join(","), {
      shape: () => buildMacUnityShapeRules(targets),
      block: () => buildMacUnityBlockRules(targets),
    });
  }
  return response;
}

async function applyMacGlobalWeaknet(request, privilege) {
  const { profile } = request;
  const steps = await runClearWeaknetSteps();

  if (profile.presetKey === "normal") {
    return buildWeaknetResponse("normal", "Mac 全局弱网已清理", steps, { ...request, privilege });
  }

  let response = buildWeaknetResponse("mac-global-preflight", "Mac 全局弱网下发前清理失败", steps, {
    ...request,
    privilege,
  });
  if (!response.ok) return response;

  steps.push(await installWeaknetRootAnchor());
  steps.push(await enablePf());
  response = buildWeaknetResponse("mac-global-preflight", "pf 初始化失败", steps, {
    ...request,
    privilege,
  });
  if (!response.ok) return response;

  if (profile.disconnectMode === "always") {
    steps.push(await loadAnchorRules("加载 Mac 全局阻断规则", buildMacGlobalBlockRules()));
    steps.push(...(await flushMacGlobalStates()));
    response = buildWeaknetResponse("mac-global-always", `${profile.displayNameZh} 已下发到 Mac 全局流量`, steps, {
      ...request,
      privilege,
    });
    if (response.ok) rememberWeaknetProfile(profile, "mac-global-always");
    return response;
  }

  steps.push(...(await configureWeaknetPipes(profile)));
  response = buildWeaknetResponse("mac-global-shaped", "dummynet pipe 配置失败", steps, {
    ...request,
    privilege,
  });
  if (!response.ok) return response;

  steps.push(await loadAnchorRules("加载 Mac 全局弱网整形规则", buildMacGlobalShapeRules()));
  steps.push(...(await flushMacGlobalStates()));
  const mode = profile.disconnectMode === "periodic" ? "mac-global-periodic" : "mac-global-shaped";
  response = buildWeaknetResponse(mode, `${profile.displayNameZh} 已下发到 Mac 全局流量`, steps, {
    ...request,
    privilege,
  });
  if (response.ok) {
    rememberWeaknetProfile(profile, mode);
    startWeaknetTimers(profile, "Mac 全局流量", {
      shape: buildMacGlobalShapeRules,
      block: buildMacGlobalBlockRules,
    });
  }
  return response;
}

async function applyWeaknet(body) {
  if (IS_WIN32) {
    return applyWin32Weaknet(body);
  }

  const privilege = await requireWeaknetPrivilege();
  const request = normalizeWeaknetRequest(body);
  if (request.targetScope === "mac-unity") {
    return applyMacUnityWeaknet(request, privilege);
  }
  if (request.targetScope === "mac-global") {
    return applyMacGlobalWeaknet(request, privilege);
  }

  const { deviceIp, profile } = request;

  if (profile.presetKey !== "normal") {
    const safety = await inspectWeaknetTargetIp(deviceIp);
    if (!safety.safe) {
      throw makeHttpError(`危险 IP 防护：${safety.reason}`, 400, { safety });
    }
  }

  const steps = await runClearWeaknetSteps();

  if (profile.presetKey === "normal") {
    return buildWeaknetResponse("normal", "正常网络：已清理弱网规则", steps, { ...request, privilege });
  }

  let response = buildWeaknetResponse("preflight", "弱网下发前清理失败", steps, { ...request, privilege });
  if (!response.ok) return response;

  steps.push(await installWeaknetRootAnchor());
  steps.push(await enablePf());
  response = buildWeaknetResponse("preflight", "pf 初始化失败", steps, { ...request, privilege });
  if (!response.ok) return response;

  if (profile.disconnectMode === "always") {
    steps.push(await loadAnchorRules("加载阻断规则", buildBlockRules(deviceIp)));
    response = buildWeaknetResponse("always", `${profile.displayNameZh} 已下发`, steps, { ...request, privilege });
    if (response.ok) rememberWeaknetProfile(profile, "always");
    return response;
  }

  steps.push(...(await configureWeaknetPipes(profile)));
  response = buildWeaknetResponse("shaped", "dummynet pipe 配置失败", steps, { ...request, privilege });
  if (!response.ok) return response;

  steps.push(await loadAnchorRules("加载弱网整形规则", buildShapeRules(deviceIp)));
  const mode = profile.disconnectMode === "periodic" ? "periodic" : "shaped";
  response = buildWeaknetResponse(mode, `${profile.displayNameZh} 已下发`, steps, { ...request, privilege });
  if (response.ok) {
    rememberWeaknetProfile(profile, mode);
    startWeaknetTimers(profile, deviceIp);
  }
  return response;
}

function serveStatic(req, res, pathname) {
  const filePath = pathname === "/" ? path.join(ROOT, "index.html") : path.join(ROOT, pathname);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    setCommonHeaders(res, mimeTypes[path.extname(filePath)] || "application/octet-stream");
    res.writeHead(200);
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    setCommonHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (requestUrl.pathname === "/api/health") {
    sendJson(res, {
      ok: true,
      adb: ADB,
      adbPolicy: ADB_POLICY,
      host: HOST,
      port: PORT,
      pid: process.pid,
      platform: HOST_PLATFORM,
      weaknetBackend: IS_WIN32 ? "win32-windivert" : "darwin-pf-dnctl",
      runtimeRoot: process.env.WEAKNET_RUNTIME_ROOT || ROOT,
      win32RuntimeDir: IS_WIN32 ? WIN32_RUNTIME_DIR : "",
      sourceSignature: getSourceSignature(),
    });
    return;
  }

  if (requestUrl.pathname === "/api/theme") {
    if (req.method === "GET") {
      sendJson(res, { ok: true, theme: readThemePreference() });
      return;
    }
    if (req.method !== "POST") {
      sendJson(res, { ok: false, error: "method not allowed" }, 405);
      return;
    }
    try {
      const theme = writeThemePreference((await readJsonBody(req)).theme);
      if (!theme) {
        sendJson(res, { ok: false, error: "invalid theme" }, 400);
        return;
      }
      sendJson(res, { ok: true, theme });
    } catch (error) {
      sendJson(res, { ok: false, error: error.message }, 500);
    }
    return;
  }

  if (requestUrl.pathname === "/api/admin/status") {
    sendJson(res, await getPrivilegeStatus());
    return;
  }

  if (requestUrl.pathname === "/api/mac-unity/targets") {
    sendJson(res, { ok: true, ...readMacUnityBuiltinTargets() });
    return;
  }

  if (requestUrl.pathname === "/api/devices") {
    sendJson(res, await listDevices());
    return;
  }

  if (requestUrl.pathname === "/api/foreground") {
    const serial = requestUrl.searchParams.get("serial");
    if (!serial) {
      sendJson(res, { ok: false, error: "missing serial" }, 400);
      return;
    }
    sendJson(res, await getForeground(serial));
    return;
  }

  if (requestUrl.pathname === "/api/weaknet/check-ip") {
    const deviceIp = requestUrl.searchParams.get("ip") || "";
    sendJson(res, await inspectWeaknetTargetIp(deviceIp.trim()));
    return;
  }

  if (requestUrl.pathname === "/api/network/path") {
    const serial = requestUrl.searchParams.get("serial") || "";
    const deviceIp = requestUrl.searchParams.get("ip") || "";
    sendJson(res, await inspectTrafficPath(serial.trim(), deviceIp.trim()));
    return;
  }

  if (requestUrl.pathname === "/api/android-vpn/status") {
    const serial = requestUrl.searchParams.get("serial") || "";
    try {
      sendJson(res, await getAndroidVpnAgentStatus(serial.trim()));
    } catch (error) {
      sendJson(res, { ok: false, error: error.message }, error.statusCode || 500);
    }
    return;
  }

  if (requestUrl.pathname === "/api/android-vpn/install") {
    if (req.method !== "POST") {
      sendJson(res, { ok: false, error: "method not allowed" }, 405);
      return;
    }
    try {
      const result = await installAndroidVpnAgent(await readJsonBody(req));
      sendJson(res, result, result.ok ? 200 : 500);
    } catch (error) {
      sendJson(
        res,
        { ok: false, error: error.message, steps: publicizeSteps(error.steps || []) },
        error.statusCode || 500,
      );
    }
    return;
  }

  if (requestUrl.pathname === "/api/android-vpn/authorize") {
    if (req.method !== "POST") {
      sendJson(res, { ok: false, error: "method not allowed" }, 405);
      return;
    }
    try {
      const result = await openAndroidVpnAuthorization(await readJsonBody(req));
      sendJson(res, result, result.ok ? 200 : 500);
    } catch (error) {
      sendJson(
        res,
        { ok: false, error: error.message, steps: publicizeSteps(error.steps || []) },
        error.statusCode || 500,
      );
    }
    return;
  }

  if (requestUrl.pathname === "/api/android-vpn/apply") {
    if (req.method !== "POST") {
      sendJson(res, { ok: false, error: "method not allowed" }, 405);
      return;
    }
    try {
      const result = await applyAndroidVpn(await readJsonBody(req));
      sendJson(res, result, result.ok ? 200 : result.requiresUserAction ? 409 : 500);
    } catch (error) {
      sendJson(
        res,
        {
          ok: false,
          error: error.message,
          support: error.support,
          request: error.request,
          steps: publicizeSteps(error.steps || []),
        },
        error.statusCode || 500,
      );
    }
    return;
  }

  if (requestUrl.pathname === "/api/android-vpn/clear") {
    if (req.method !== "POST") {
      sendJson(res, { ok: false, error: "method not allowed" }, 405);
      return;
    }
    try {
      const result = await clearAndroidVpn(await readJsonBody(req));
      sendJson(res, result, result.ok ? 200 : 500);
    } catch (error) {
      sendJson(
        res,
        { ok: false, error: error.message, steps: publicizeSteps(error.steps || []) },
        error.statusCode || 500,
      );
    }
    return;
  }

  if (requestUrl.pathname === "/api/weaknet/apply") {
    if (req.method !== "POST") {
      sendJson(res, { ok: false, error: "method not allowed" }, 405);
      return;
    }
    try {
      const result = await applyWeaknet(await readJsonBody(req));
      sendJson(res, result, result.ok ? 200 : 500);
    } catch (error) {
      sendJson(res, { ok: false, error: error.message, safety: error.safety }, error.statusCode || 500);
    }
    return;
  }

  if (requestUrl.pathname === "/api/weaknet/clear") {
    if (req.method !== "POST") {
      sendJson(res, { ok: false, error: "method not allowed" }, 405);
      return;
    }
    try {
      const result = await clearWeaknetRules();
      sendJson(res, result, result.ok ? 200 : 500);
    } catch (error) {
      sendJson(res, { ok: false, error: error.message, safety: error.safety }, error.statusCode || 500);
    }
    return;
  }

  if (requestUrl.pathname === "/api/service/stop") {
    if (req.method !== "POST") {
      sendJson(res, { ok: false, error: "method not allowed" }, 405);
      return;
    }
    const result = await stopService(await readJsonBody(req));
    sendJson(res, result, result.ok ? 200 : 500);
    if (result.ok) stopProcessAfterResponse();
    return;
  }

  if (requestUrl.pathname === "/api/network/status") {
    try {
      sendJson(res, await getNetworkCurveStatus());
    } catch (error) {
      sendJson(res, { ok: false, error: error.message }, 500);
    }
    return;
  }

  if (requestUrl.pathname === "/api/network/stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    let closed = false;
    req.on("close", () => {
      closed = true;
    });

    const loop = async () => {
      if (closed) return;
      try {
        res.write(`data: ${JSON.stringify(await getNetworkCurveStatus())}\n\n`);
      } catch (error) {
        res.write(`data: ${JSON.stringify({ ok: false, error: error.message, timestamp: Date.now() })}\n\n`);
      }
      if (!closed) setTimeout(loop, 1000);
    };
    loop();
    return;
  }

  if (requestUrl.pathname === "/api/metrics") {
    const serial = requestUrl.searchParams.get("serial");
    const packageName = requestUrl.searchParams.get("package") || "";
    if (!serial) {
      sendJson(res, { ok: false, error: "missing serial" }, 400);
      return;
    }
    const metrics = await collectMetrics(serial, packageName);
    delete metrics.state;
    sendJson(res, metrics);
    return;
  }

  if (requestUrl.pathname === "/api/metrics/stream") {
    const serial = requestUrl.searchParams.get("serial");
    const packageName = requestUrl.searchParams.get("package") || "";
    if (!serial) {
      sendJson(res, { ok: false, error: "missing serial" }, 400);
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    let previous = {};
    let closed = false;
    req.on("close", () => {
      closed = true;
    });

    const loop = async () => {
      if (closed) return;
      const metrics = await collectMetrics(serial, packageName, previous);
      previous = metrics.state || previous;
      delete metrics.state;
      res.write(`data: ${JSON.stringify(metrics)}\n\n`);
      if (!closed) setTimeout(loop, 1200);
    };
    loop();
    return;
  }

  serveStatic(req, res, decodeURIComponent(requestUrl.pathname));
});

server.listen(PORT, HOST, async () => {
  console.log(`Game network lab running at http://localhost:${PORT}`);
  console.log(`Bind address: ${HOST}`);
  try {
    const privilege = await getPrivilegeStatus();
    console.log(
      privilege.ok
        ? `Admin mode: enabled (${privilege.mode})`
        : `Admin mode: not enabled (${privilege.mode})`
    );
  } catch (error) {
    console.log(`Admin mode: unknown (${error.message || error})`);
  }
});

let shuttingDown = false;

function stopProcessAfterResponse() {
  if (shuttingDown) return;
  shuttingDown = true;
  setTimeout(() => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  }, 120).unref();
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (weaknetRuntime.active) {
    console.log(`\n${signal}: clearing weaknet rules...`);
    const result = await clearWeaknetRules();
    if (!result.ok) console.warn(result.error);
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
