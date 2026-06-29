#!/usr/bin/env node

const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");

const ROOT = __dirname;
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.LAUNCHER_PORT || process.env.PORT || 8122);
const AGENT_HOST = process.env.AGENT_HOST || "127.0.0.1";
const AGENT_PORT = Number(process.env.AGENT_PORT || 8123);
const NODE_BIN = process.env.NODE_BIN || process.execPath;
const AGENT_LOG = process.env.AGENT_LOG || "/tmp/weaknet-console-agent.log";
const SERVER_JS = path.join(ROOT, "server.js");
const RUNTIME_PREFIX = path.join(os.tmpdir(), "weaknet-console-agent-");
const THEME_PREF_FILE = process.env.WEAKNET_THEME_PREF_FILE || path.join(os.homedir(), ".weaknet-console-theme.json");
const THEME_KEYS = new Set(["terminal-aurora", "cyber", "classic"]);
const RUNTIME_ITEMS = ["index.html", "app.js", "styles.css", "server.js", "mac-unity-targets.json", "android-agent", "drivers"];
const SOURCE_SIGNATURE_ITEMS = [
  "index.html",
  "app.js",
  "styles.css",
  "server.js",
  "mac-unity-targets.json",
  "drivers/win32/win32-driver.js",
];
const SOURCE_SIGNATURE = createSourceSignature(ROOT);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

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

function readJsonBody(req, maxBytes = 1024 * 8) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        reject(new Error("request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function run(command, args, timeoutMs = 5000) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 4 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: stdout || "",
        stderr: stderr || "",
        error: error ? error.message : "",
      });
    });
  });
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function appleScriptString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
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

async function findExecutable(name) {
  const result = await run("/bin/zsh", ["-lc", `command -v ${name} || true`], 3000);
  return result.stdout.trim();
}

function prepareAgentRuntime() {
  const runtimeRoot = fs.mkdtempSync(RUNTIME_PREFIX);
  for (const item of RUNTIME_ITEMS) {
    const source = path.join(ROOT, item);
    if (!fs.existsSync(source)) continue;
    fs.cpSync(source, path.join(runtimeRoot, item), {
      recursive: true,
      dereference: true,
      filter: (entry) => !/(^|\/)(\.playwright-cli|\.playwright-mcp|output|build)(\/|$)/.test(entry),
    });
  }
  return {
    root: runtimeRoot,
    server: path.join(runtimeRoot, "server.js"),
  };
}

function requestJson(port, pathname, timeoutMs = 1600, options = {}) {
  return new Promise((resolve) => {
    const body = options.body ? JSON.stringify(options.body) : "";
    const req = http.request(
      {
        host: AGENT_HOST,
        port,
        path: pathname,
        method: options.method || "GET",
        timeout: timeoutMs,
        headers: body
          ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(body),
            }
          : undefined,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              statusCode: res.statusCode,
              data: JSON.parse(body || "{}"),
            });
          } catch (error) {
            resolve({ ok: false, statusCode: res.statusCode, data: null, error: error.message });
          }
        });
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", (error) => {
      resolve({ ok: false, statusCode: 0, data: null, error: error.message });
    });
    if (body) req.write(body);
    req.end();
  });
}

async function getAgentStatus() {
  const health = await requestJson(AGENT_PORT, "/api/health");
  if (!health.ok) {
    return {
      running: false,
      ready: false,
      admin: null,
      message: "本机弱网服务未运行",
      error: health.error || "",
    };
  }

  const admin = await requestJson(AGENT_PORT, "/api/admin/status");
  const adminData = admin.data || null;
  const isRoot = Boolean(admin.ok && adminData && adminData.ok && adminData.mode === "root");
  const agentSignature = health.data && health.data.sourceSignature ? health.data.sourceSignature : "";
  const stale = agentSignature !== SOURCE_SIGNATURE;
  return {
    running: true,
    ready: isRoot && !stale,
    stale,
    expectedSourceSignature: SOURCE_SIGNATURE,
    health: health.data,
    admin: adminData,
    message: stale ? "本机弱网服务版本已过期，需要重新授权启动" : isRoot ? "本机弱网服务已授权" : "8123 已被未授权服务占用",
  };
}

async function waitForAgentReady(timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let latest = await getAgentStatus();
  while (!latest.ready && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    latest = await getAgentStatus();
  }
  return latest;
}

async function waitForAgentStopped(timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let latest = await getAgentStatus();
  while (latest.running && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    latest = await getAgentStatus();
  }
  return latest;
}

async function buildAdminStartCommand({ stopExisting = false } = {}) {
  const adbBin = process.env.ADB || (await findExecutable("adb"));
  const runtime = prepareAgentRuntime();
  const envParts = [`HOST=${shellQuote(AGENT_HOST)}`, `PORT=${shellQuote(String(AGENT_PORT))}`];
  if (adbBin) envParts.push(`ADB=${shellQuote(adbBin)}`);
  envParts.push(`WEAKNET_STARTED_BY_LAUNCHER=1`);
  envParts.push(`WEAKNET_RUNTIME_ROOT=${shellQuote(runtime.root)}`);
  envParts.push(`WEAKNET_SOURCE_SIGNATURE=${shellQuote(SOURCE_SIGNATURE)}`);

  const commands = [
    `cd ${shellQuote(runtime.root)}`,
    `umask 022`,
    `: > ${shellQuote(AGENT_LOG)}`,
    `echo ${shellQuote(`runtime=${runtime.root}`)} >> ${shellQuote(AGENT_LOG)}`,
    `(/usr/bin/env ${envParts.join(" ")} ${shellQuote(NODE_BIN)} ${shellQuote(runtime.server)} >> ${shellQuote(AGENT_LOG)} 2>&1 < /dev/null & echo $! > /tmp/weaknet-console-agent.pid)`,
  ];
  if (stopExisting) {
    commands.unshift(
      `old_pids="$(/usr/sbin/lsof -nP -tiTCP:${shellQuote(String(AGENT_PORT))} -sTCP:LISTEN 2>/dev/null || true)"; if [ -n "$old_pids" ]; then /bin/kill -TERM $old_pids || true; for i in {1..30}; do /usr/sbin/lsof -nP -iTCP:${shellQuote(String(AGENT_PORT))} -sTCP:LISTEN >/dev/null 2>&1 || break; /bin/sleep 0.2; done; fi`,
    );
  }
  return commands.join(" && ");
}

async function startAgentWithAuthorization() {
  const before = await getAgentStatus();
  if (before.ready) {
    return { ok: true, alreadyRunning: true, agent: before };
  }
  if (before.running && !before.ready && !before.stale) {
    return {
      ok: false,
      error: "端口 8123 已被未授权服务占用。请先停止旧服务，再通过启动页重新授权。",
      agent: before,
    };
  }

  const shellCommand = await buildAdminStartCommand({ stopExisting: Boolean(before.running && before.stale) });
  const appleScript = `do shell script ${appleScriptString(shellCommand)} with administrator privileges`;
  const result = await run("osascript", ["-e", appleScript], 5 * 60 * 1000);
  if (!result.ok) {
    const canceled = /User canceled|用户已取消|-128/.test(result.stderr || result.error || result.stdout);
    return {
      ok: false,
      canceled,
      error: canceled ? "已取消管理员授权" : result.stderr.trim() || result.error || "管理员授权失败",
    };
  }

  const agent = await waitForAgentReady();
  if (!agent.ready) {
    return {
      ok: false,
      error: "授权已完成，但本机弱网服务尚未就绪。请稍后重试，或查看 /tmp/weaknet-console-agent.log。",
      agent,
    };
  }
  return { ok: true, agent };
}

function buildAdminStopCommand() {
  return [
    `old_pids="$(/usr/sbin/lsof -nP -tiTCP:${shellQuote(String(AGENT_PORT))} -sTCP:LISTEN 2>/dev/null || true)"`,
    `if [ -n "$old_pids" ]; then /bin/kill -TERM $old_pids || true; fi`,
    `for i in {1..30}; do /usr/sbin/lsof -nP -iTCP:${shellQuote(String(AGENT_PORT))} -sTCP:LISTEN >/dev/null 2>&1 || exit 0; /bin/sleep 0.2; done`,
  ].join(" && ");
}

async function stopAgentWithAuthorization() {
  const before = await getAgentStatus();
  if (!before.running) {
    return { ok: true, alreadyStopped: true, agent: before, message: "本机弱网服务未运行" };
  }

  const stopResult = await requestJson(AGENT_PORT, "/api/service/stop", 15000, { method: "POST", body: {} });
  if (stopResult.ok && stopResult.data && stopResult.data.ok !== false) {
    const agent = await waitForAgentStopped();
    return {
      ok: !agent.running,
      agent,
      stop: stopResult.data,
      message: agent.running ? "已请求停止服务，但 Agent 尚未退出" : "本机弱网服务已停止",
    };
  }

  const appleScript = `do shell script ${appleScriptString(buildAdminStopCommand())} with administrator privileges`;
  const result = await run("osascript", ["-e", appleScript], 5 * 60 * 1000);
  if (!result.ok) {
    const canceled = /User canceled|用户已取消|-128/.test(result.stderr || result.error || result.stdout);
    return {
      ok: false,
      canceled,
      error: canceled ? "已取消管理员授权" : result.stderr.trim() || result.error || "停止服务失败",
      agent: before,
    };
  }

  const agent = await waitForAgentStopped();
  return {
    ok: !agent.running,
    agent,
    message: agent.running ? "停止命令已执行，但 Agent 尚未退出" : "本机弱网服务已停止",
  };
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(ROOT, safePath));
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

  if (requestUrl.pathname === "/api/launcher/status") {
    const agent = await getAgentStatus();
    sendJson(res, {
      ok: true,
      launcher: true,
      host: HOST,
      port: PORT,
      agentHost: AGENT_HOST,
      agentPort: AGENT_PORT,
      agentUrl: `http://${AGENT_HOST}:${AGENT_PORT}/`,
      agent,
    });
    return;
  }

  if (requestUrl.pathname === "/api/launcher/start") {
    if (req.method !== "POST") {
      sendJson(res, { ok: false, error: "method not allowed" }, 405);
      return;
    }
    const result = await startAgentWithAuthorization();
    sendJson(
      res,
      {
        ...result,
        agentUrl: `http://${AGENT_HOST}:${AGENT_PORT}/`,
      },
      result.ok ? 200 : result.canceled ? 409 : 500,
    );
    return;
  }

  if (requestUrl.pathname === "/api/launcher/stop") {
    if (req.method !== "POST") {
      sendJson(res, { ok: false, error: "method not allowed" }, 405);
      return;
    }
    const result = await stopAgentWithAuthorization();
    sendJson(res, result, result.ok ? 200 : result.canceled ? 409 : 500);
    return;
  }

  serveStatic(req, res, decodeURIComponent(requestUrl.pathname));
});

server.listen(PORT, HOST, () => {
  console.log(`Weaknet launcher running at http://${HOST}:${PORT}`);
  console.log(`Admin Agent target: http://${AGENT_HOST}:${AGENT_PORT}`);
});
