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
const RUNTIME_ITEMS = ["index.html", "app.js", "styles.css", "server.js", "mac-unity-targets.json", "android-agent"];

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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, payload, statusCode = 200) {
  setCommonHeaders(res);
  res.writeHead(statusCode);
  res.end(JSON.stringify(payload));
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

function requestJson(port, pathname, timeoutMs = 1600) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: AGENT_HOST,
        port,
        path: pathname,
        method: "GET",
        timeout: timeoutMs,
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
  return {
    running: true,
    ready: isRoot,
    health: health.data,
    admin: adminData,
    message: isRoot ? "本机弱网服务已授权" : "8123 已被未授权服务占用",
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

async function buildAdminStartCommand() {
  const adbBin = process.env.ADB || (await findExecutable("adb"));
  const runtime = prepareAgentRuntime();
  const envParts = [`HOST=${shellQuote(AGENT_HOST)}`, `PORT=${shellQuote(String(AGENT_PORT))}`];
  if (adbBin) envParts.push(`ADB=${shellQuote(adbBin)}`);
  envParts.push(`WEAKNET_STARTED_BY_LAUNCHER=1`);
  envParts.push(`WEAKNET_RUNTIME_ROOT=${shellQuote(runtime.root)}`);

  return [
    `cd ${shellQuote(runtime.root)}`,
    `umask 022`,
    `: > ${shellQuote(AGENT_LOG)}`,
    `echo ${shellQuote(`runtime=${runtime.root}`)} >> ${shellQuote(AGENT_LOG)}`,
    `(/usr/bin/env ${envParts.join(" ")} ${shellQuote(NODE_BIN)} ${shellQuote(runtime.server)} >> ${shellQuote(AGENT_LOG)} 2>&1 < /dev/null & echo $! > /tmp/weaknet-console-agent.pid)`,
  ].join(" && ");
}

async function startAgentWithAuthorization() {
  const before = await getAgentStatus();
  if (before.ready) {
    return { ok: true, alreadyRunning: true, agent: before };
  }
  if (before.running && !before.ready) {
    return {
      ok: false,
      error: "端口 8123 已被未授权服务占用。请先停止旧服务，再通过启动页重新授权。",
      agent: before,
    };
  }

  const shellCommand = await buildAdminStartCommand();
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

  serveStatic(req, res, decodeURIComponent(requestUrl.pathname));
});

server.listen(PORT, HOST, () => {
  console.log(`Weaknet launcher running at http://${HOST}:${PORT}`);
  console.log(`Admin Agent target: http://${AGENT_HOST}:${AGENT_PORT}`);
});
