const presets = [
  {
    presetKey: "normal",
    displayNameZh: "正常网络",
    category: "common",
    scene: "不施加弱网",
    latencyRttMs: 40,
    jitterMs: 10,
    packetLossPercent: 0,
    downloadKbps: null,
    uploadKbps: null,
    disconnectMode: "none",
    disconnectDurationSec: 0,
    disconnectIntervalSec: 0,
  },
  {
    presetKey: "wifi",
    displayNameZh: "Wi-Fi 网络",
    category: "common",
    scene: "稳定无线网络",
    latencyRttMs: 40,
    jitterMs: 10,
    packetLossPercent: 0,
    downloadKbps: 50000,
    uploadKbps: 20000,
    disconnectMode: "none",
    disconnectDurationSec: 0,
    disconnectIntervalSec: 0,
  },
  {
    presetKey: "lte_4g",
    displayNameZh: "4G/LTE 网络",
    category: "common",
    scene: "常规移动网络",
    latencyRttMs: 80,
    jitterMs: 20,
    packetLossPercent: 0.1,
    downloadKbps: 20000,
    uploadKbps: 5000,
    disconnectMode: "none",
    disconnectDurationSec: 0,
    disconnectIntervalSec: 0,
  },
  {
    presetKey: "three_g",
    displayNameZh: "3G 网络",
    category: "common",
    scene: "较慢移动网络",
    latencyRttMs: 180,
    jitterMs: 60,
    packetLossPercent: 0.5,
    downloadKbps: 1500,
    uploadKbps: 750,
    disconnectMode: "none",
    disconnectDurationSec: 0,
    disconnectIntervalSec: 0,
  },
  {
    presetKey: "dsl",
    displayNameZh: "DSL 宽带",
    category: "extreme",
    scene: "低速家宽/老式宽带",
    latencyRttMs: 120,
    jitterMs: 30,
    packetLossPercent: 0.2,
    downloadKbps: 2000,
    uploadKbps: 256,
    disconnectMode: "none",
    disconnectDurationSec: 0,
    disconnectIntervalSec: 0,
  },
  {
    presetKey: "edge",
    displayNameZh: "EDGE 网络",
    category: "extreme",
    scene: "极慢移动网络",
    latencyRttMs: 400,
    jitterMs: 120,
    packetLossPercent: 2,
    downloadKbps: 240,
    uploadKbps: 120,
    disconnectMode: "none",
    disconnectDurationSec: 0,
    disconnectIntervalSec: 0,
  },
  {
    presetKey: "high_latency",
    displayNameZh: "高延迟网络",
    category: "extreme",
    scene: "延迟高但带宽尚可",
    latencyRttMs: 800,
    jitterMs: 200,
    packetLossPercent: 1,
    downloadKbps: 5000,
    uploadKbps: 1000,
    disconnectMode: "none",
    disconnectDurationSec: 0,
    disconnectIntervalSec: 0,
  },
  {
    presetKey: "high_loss",
    displayNameZh: "高丢包网络",
    category: "extreme",
    scene: "主要模拟频繁丢包",
    latencyRttMs: 200,
    jitterMs: 80,
    packetLossPercent: 10,
    downloadKbps: 3000,
    uploadKbps: 800,
    disconnectMode: "none",
    disconnectDurationSec: 0,
    disconnectIntervalSec: 0,
  },
  {
    presetKey: "intermittent",
    displayNameZh: "断续网络",
    category: "extreme",
    scene: "周期性断开后恢复",
    latencyRttMs: 300,
    jitterMs: 100,
    packetLossPercent: 5,
    downloadKbps: 1000,
    uploadKbps: 300,
    disconnectMode: "periodic",
    disconnectDurationSec: 5,
    disconnectIntervalSec: 30,
  },
  {
    presetKey: "loss_100",
    displayNameZh: "100% 丢包",
    category: "extreme",
    scene: "完全不可达/断网",
    latencyRttMs: null,
    jitterMs: null,
    packetLossPercent: 100,
    downloadKbps: 0,
    uploadKbps: 0,
    disconnectMode: "always",
    disconnectDurationSec: 0,
    disconnectIntervalSec: 0,
  },
];

const weaknetCommand = {
  anchor: "weaknet_lab",
  pipeDown: 61001,
  pipeUp: 61002,
};

const launcherConfig = {
  port: "8122",
  agentPort: "8123",
};

const state = {
  category: "common",
  selectedKey: "normal",
  networkMode: "mac-global",
  monitorTab: "network",
  activeProfile: cloneProfile(presets[0]),
  history: loadHistory(),
  agent: {
    available: false,
    admin: null,
    devices: [],
    selectedSerial: "",
    metricsSource: "simulated",
    androidVpn: null,
    macUnityTargets: [],
  },
  performance: {
    running: false,
    samples: [],
    timerId: null,
    eventSource: null,
    lastRealSample: null,
    streamError: false,
    paused: false,
    chartDomains: {},
  },
  networkCurve: {
    samples: [],
    eventSource: null,
    timerId: null,
    limitProfile: null,
    limitMode: "normal",
  },
  gateway: {
    expanded: false,
    filter: "",
  },
  launcher: {
    status: null,
    starting: false,
  },
};

const elements = {
  monitorTitle: document.getElementById("monitor-title"),
  networkCurveTab: document.getElementById("networkCurveTab"),
  performanceTab: document.getElementById("performanceTab"),
  networkCurvePanel: document.getElementById("networkCurvePanel"),
  performancePanel: document.getElementById("performancePanel"),
  networkCurveStatus: document.getElementById("networkCurveStatus"),
  networkCurveChart: document.getElementById("networkCurveChart"),
  networkDownLegend: document.getElementById("networkDownLegend"),
  networkUpLegend: document.getElementById("networkUpLegend"),
  performanceGrid: document.getElementById("performanceGrid"),
  performanceChart: document.getElementById("performanceChart"),
  monitorStatus: document.getElementById("monitorStatus"),
  performanceStatusDetail: document.getElementById("performanceStatusDetail"),
  performanceStatusTitle: document.getElementById("performanceStatusTitle"),
  performanceStatusMessage: document.getElementById("performanceStatusMessage"),
  startMonitorButton: document.getElementById("startMonitorButton"),
  stopMonitorButton: document.getElementById("stopMonitorButton"),
  deviceTitle: document.getElementById("device-title"),
  networkModeField: document.getElementById("networkModeField"),
  deviceSerialField: document.getElementById("deviceSerialField"),
  deviceIpField: document.getElementById("deviceIpField"),
  platformField: document.getElementById("platformField"),
  targetAppField: document.getElementById("targetAppField"),
  deviceActions: document.getElementById("deviceActions"),
  deviceSerial: document.getElementById("deviceSerial"),
  deviceStatus: document.getElementById("deviceStatus"),
  deviceNote: document.getElementById("deviceNote"),
  gatewayScope: document.getElementById("gatewayScope"),
  gatewaySummary: document.getElementById("gatewaySummary"),
  gatewayState: document.getElementById("gatewayState"),
  gatewayChipRow: document.getElementById("gatewayChipRow"),
  gatewayInlineList: document.getElementById("gatewayInlineList"),
  gatewayMoreButton: document.getElementById("gatewayMoreButton"),
  gatewayToggleButton: document.getElementById("gatewayToggleButton"),
  gatewayViewAllButton: document.getElementById("gatewayViewAllButton"),
  gatewayCopyButton: document.getElementById("gatewayCopyButton"),
  gatewayDialog: document.getElementById("gatewayDialog"),
  gatewayDialogSummary: document.getElementById("gatewayDialogSummary"),
  gatewayDialogCloseButton: document.getElementById("gatewayDialogCloseButton"),
  gatewaySearchInput: document.getElementById("gatewaySearchInput"),
  gatewayTableRows: document.getElementById("gatewayTableRows"),
  gatewayCopyAllButton: document.getElementById("gatewayCopyAllButton"),
  gatewayExportButton: document.getElementById("gatewayExportButton"),
  refreshDevicesButton: document.getElementById("refreshDevicesButton"),
  foregroundButton: document.getElementById("foregroundButton"),
  installVpnButton: document.getElementById("installVpnButton"),
  authorizeVpnButton: document.getElementById("authorizeVpnButton"),
  presetGrid: document.getElementById("presetGrid"),
  selectedName: document.getElementById("selectedName"),
  selectedScene: document.getElementById("selectedScene"),
  metricsGrid: document.getElementById("metricsGrid"),
  advancedToggle: document.getElementById("advancedToggle"),
  advancedEditor: document.getElementById("advancedEditor"),
  commandPreview: document.getElementById("commandPreview"),
  historyList: document.getElementById("historyList"),
  applyButton: document.getElementById("applyButton"),
  clearButton: document.getElementById("clearButton"),
  resetButton: document.getElementById("resetButton"),
  copyButton: document.getElementById("copyButton"),
  clearHistoryButton: document.getElementById("clearHistoryButton"),
  deviceIp: document.getElementById("deviceIp"),
  platform: document.getElementById("platform"),
  networkMode: document.getElementById("networkMode"),
  targetApp: document.getElementById("targetApp"),
  targetAppLabel: document.getElementById("targetAppLabel"),
  modeSelect: document.getElementById("modeSelect"),
  modeTrigger: document.getElementById("modeTrigger"),
  modeTriggerLabel: document.getElementById("modeTriggerLabel"),
  modeTriggerTip: document.getElementById("modeTriggerTip"),
  modeTriggerTipBubble: document.getElementById("modeTriggerTipBubble"),
  modeList: document.getElementById("modeList"),
  runtimeMode: document.getElementById("runtimeMode"),
  commandEyebrow: document.getElementById("commandEyebrow"),
  launcherGate: document.getElementById("launcherGate"),
  launcherMessage: document.getElementById("launcherMessage"),
  launcherStatusText: document.getElementById("launcherStatusText"),
  launcherStartButton: document.getElementById("launcherStartButton"),
  launcherRetryButton: document.getElementById("launcherRetryButton"),
};

const editorFields = [
  "latencyRttMs",
  "jitterMs",
  "packetLossPercent",
  "downloadKbps",
  "uploadKbps",
  "disconnectDurationSec",
  "disconnectIntervalSec",
];

function cloneProfile(profile) {
  return { ...profile };
}

function loadHistory() {
  try {
    const value = localStorage.getItem("weaknet-history");
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem("weaknet-history", JSON.stringify(state.history.slice(0, 20)));
}

function isLikelyLocalAgent() {
  return location.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
}

function isLauncherPage() {
  return isLikelyLocalAgent() && location.port === launcherConfig.port;
}

function getAgentUrl(path = "/") {
  const host = location.hostname || "127.0.0.1";
  return `${location.protocol}//${host}:${launcherConfig.agentPort}${path}`;
}

function redirectToAgent(status = state.launcher.status) {
  const target = status && status.agentUrl ? status.agentUrl : getAgentUrl("/");
  window.location.replace(target);
}

function setLauncherGate(open) {
  if (!elements.launcherGate) return;
  elements.launcherGate.hidden = !open;
}

function setLauncherStatus(text, tone = "info") {
  if (!elements.launcherStatusText) return;
  elements.launcherStatusText.textContent = text;
  elements.launcherStatusText.classList.toggle("ok", tone === "ok");
  elements.launcherStatusText.classList.toggle("error", tone === "error");
}

function setLauncherBusy(busy) {
  state.launcher.starting = busy;
  if (elements.launcherStartButton) elements.launcherStartButton.disabled = busy;
  if (elements.launcherRetryButton) elements.launcherRetryButton.disabled = busy;
}

async function fetchLauncherJson(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      cache: "no-store",
      ...options,
    });
  } catch (error) {
    throw new Error(`Launcher 未连接：${error.message}`);
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok || (data && data.ok === false)) {
    throw new Error((data && data.error) || `Launcher HTTP ${response.status}`);
  }
  return data;
}

async function getLauncherStatus() {
  const status = await fetchLauncherJson("/api/launcher/status");
  state.launcher.status = status;
  if (status.agentPort) launcherConfig.agentPort = String(status.agentPort);
  return status;
}

function renderLauncherStatus(status) {
  const agent = status && status.agent;
  if (agent && agent.ready) {
    if (elements.launcherMessage) elements.launcherMessage.textContent = "弱网服务已授权，正在进入正式控制台。";
    setLauncherStatus("弱网服务已授权", "ok");
    return;
  }
  if (agent && agent.running && !agent.ready) {
    if (elements.launcherMessage) {
      elements.launcherMessage.textContent = "检测到本机弱网服务已运行但未获得管理员权限，需要先停止旧服务后再重新授权。";
    }
    setLauncherStatus(agent.message || "端口被未授权服务占用", "error");
    return;
  }
  if (elements.launcherMessage) {
    elements.launcherMessage.textContent =
      "为模拟真实弱网环境，本工具需要临时调整本机网络规则，用于实现延迟、丢包、限速和断网等效果。点击继续后，macOS 将弹出系统授权框。";
  }
  setLauncherStatus("弱网服务未授权", "info");
}

async function refreshLauncherGate() {
  if (!isLauncherPage()) return false;
  setLauncherGate(true);
  elements.runtimeMode.textContent = "启动页";
  if (elements.launcherMessage) elements.launcherMessage.textContent = "正在检测本机弱网服务...";
  setLauncherStatus("检测中", "info");

  try {
    const status = await getLauncherStatus();
    renderLauncherStatus(status);
    if (status.agent && status.agent.ready) {
      setTimeout(() => redirectToAgent(status), 450);
    }
  } catch (error) {
    if (elements.launcherMessage) elements.launcherMessage.textContent = "启动页服务异常，请重新打开 open-weaknet.command。";
    setLauncherStatus(error.message, "error");
  }
  return true;
}

async function waitForLauncherAgentReady() {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const status = await getLauncherStatus();
    renderLauncherStatus(status);
    if (status.agent && status.agent.ready) return status;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("弱网服务启动超时，请重新检测或查看 /tmp/weaknet-console-agent.log。");
}

async function startLauncherAgent() {
  if (!isLauncherPage() || state.launcher.starting) return;
  setLauncherBusy(true);
  if (elements.launcherMessage) elements.launcherMessage.textContent = "等待 macOS 系统授权框，请输入本机登录密码。";
  setLauncherStatus("正在请求管理员授权", "info");
  try {
    const result = await fetchLauncherJson("/api/launcher/start", { method: "POST" });
    state.launcher.status = result;
    if (result.agentPort) launcherConfig.agentPort = String(result.agentPort);
    if (result.agent && result.agent.ready) {
      renderLauncherStatus(result);
      setTimeout(() => redirectToAgent(result), 450);
      return;
    }
    const status = await waitForLauncherAgentReady();
    setTimeout(() => redirectToAgent(status), 450);
  } catch (error) {
    if (elements.launcherMessage) elements.launcherMessage.textContent = "弱网服务未启动，可以重新尝试授权。";
    setLauncherStatus(error.message, "error");
    showToast(error.message, "error", { duration: 6200 });
  } finally {
    setLauncherBusy(false);
  }
}

function getToastLayer() {
  let layer = document.getElementById("toastLayer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "toastLayer";
    layer.className = "toast-layer";
    layer.setAttribute("aria-live", "polite");
    layer.setAttribute("aria-atomic", "false");
    document.body.appendChild(layer);
  }
  return layer;
}

function showToast(message, type = "info", options = {}) {
  const layer = getToastLayer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  layer.appendChild(toast);

  const duration = options.duration || (type === "error" ? 5200 : 3600);
  window.setTimeout(() => {
    toast.classList.add("leaving");
    window.setTimeout(() => toast.remove(), 300);
  }, duration);
}

function showWeaknetStepToasts(steps = []) {
  steps.forEach((step, index) => {
    window.setTimeout(() => {
      const detail = step.ok ? "成功" : step.error || step.stderr || "失败";
      showToast(`${step.label}：${detail}`, step.ok ? "success" : "error");
    }, index * 140);
  });
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

function isPrivateIpv4Parts(parts) {
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function getClientUnsafeDeviceIpReason(deviceIp, profile) {
  if (profile.presetKey === "normal") return "";

  const parts = getIpv4Parts(deviceIp);
  if (!parts) return "设备 IP 不是有效 IPv4 地址";
  if (parts[0] === 0) return "0.0.0.0/8 是保留地址，不能作为设备 IP";
  if (parts[0] === 127) return "127.0.0.0/8 是本机回环地址，不能作为设备 IP";
  if (parts[0] === 169 && parts[1] === 254) return "169.254.0.0/16 是链路本地地址，不适合作为弱网目标";
  if (parts[0] >= 224 && parts[0] <= 239) return "224.0.0.0/4 是组播地址，不能作为设备 IP";
  if (parts[0] >= 240) return "240.0.0.0/4 是保留地址，不能作为设备 IP";
  if (parts[3] === 0) return "这个地址看起来是网段地址，不能作为设备 IP";
  if (parts[3] === 255) return "这个地址看起来是广播地址，不能作为设备 IP";
  if (!isPrivateIpv4Parts(parts)) return "设备 IP 必须是内网私有地址，避免误伤公网、DNS 或服务器流量";
  return "";
}

async function fetchAgentJson(path) {
  let response;
  try {
    response = await fetch(path, { cache: "no-store" });
  } catch (error) {
    if (/failed to fetch|load failed|networkerror/i.test(error.message || "")) {
      throw new Error("本地 Agent 未启动或页面连接已断开，请运行 open-weaknet.command 授权启动后刷新页面");
    }
    throw error;
  }
  if (!response.ok) throw new Error(`Agent HTTP ${response.status}`);
  return response.json();
}

async function refreshAdminStatus() {
  if (!isLikelyLocalAgent()) return null;
  try {
    const status = await fetchAgentJson("/api/admin/status");
    state.agent.admin = status;
    if (status.ok && status.mode === "root") {
      elements.runtimeMode.textContent = "管理员模式";
    } else if (status.ok) {
      elements.runtimeMode.textContent = "sudo 已授权";
    } else {
      elements.runtimeMode.textContent = "仅监控模式";
    }
    return status;
  } catch {
    state.agent.admin = null;
    return null;
  }
}

async function assertWeaknetTargetIpSafe(deviceIp, profile) {
  if (isMacLocalMode()) return;
  const localReason = getClientUnsafeDeviceIpReason(deviceIp, profile);
  if (localReason) throw new Error(`危险 IP 防护：${localReason}`);
  if (profile.presetKey === "normal" || !isLikelyLocalAgent()) return;

  const params = new URLSearchParams({ ip: deviceIp });
  const data = await fetchAgentJson(`/api/weaknet/check-ip?${params.toString()}`);
  if (!data.safe) throw new Error(`危险 IP 防护：${data.reason}`);
}

async function ensureWeaknetDeviceReady(profile) {
  if (isMacLocalMode()) return null;
  if (profile.presetKey === "normal" || !isLikelyLocalAgent()) return null;

  if (!state.agent.available || !state.agent.selectedSerial) {
    showToast("扫描 Android 设备", "info");
    await refreshDevices();
  }

  const device = getSelectedDevice();
  if (!device) {
    throw new Error("未发现已授权的 Android 设备，请确认 USB 调试已允许");
  }
  if (device.state !== "device") {
    throw new Error(`Android 设备状态不是在线：${device.state}`);
  }
  if (device.ip) {
    elements.deviceIp.value = device.ip;
    renderCommandPreview();
  }
  return device;
}

async function assertTrafficPathReady(record, profile) {
  if (isMacLocalMode()) return null;
  if (profile.presetKey === "normal" || !isLikelyLocalAgent()) return null;
  if (!state.agent.selectedSerial) {
    throw new Error("缺少 Android 设备序列号，无法检查流量路径");
  }

  showToast("检查 Android 流量路径", "info");
  const params = new URLSearchParams({
    serial: state.agent.selectedSerial,
    ip: record.deviceIp,
  });
  const data = await fetchAgentJson(`/api/network/path?${params.toString()}`);
  if (!data.throughMac) {
    const detail = data.autoPrepareReason ? `；${data.autoPrepareReason}` : "";
    throw new Error(`Android 流量未经过 Mac：${data.reason}${detail}`);
  }
  const macIp = data.androidRoute && data.androidRoute.gatewayIp ? data.androidRoute.gatewayIp : "Mac";
  showToast(`流量路径通过：Android -> ${macIp}`, "success");
  return data;
}

async function postAgentJson(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.message || data.error || `Agent HTTP ${response.status}`);
    error.data = data;
    throw error;
  }
  return data;
}

function getNetworkMode() {
  return elements.networkMode ? elements.networkMode.value : state.networkMode;
}

function isAndroidVpnMode() {
  return getNetworkMode() === "android-vpn";
}

function isMacUnityMode() {
  return getNetworkMode() === "mac-unity";
}

function isMacGlobalMode() {
  return getNetworkMode() === "mac-global";
}

function isMacLocalMode() {
  return isMacUnityMode() || isMacGlobalMode();
}

function getNetworkModeLabel() {
  if (isAndroidVpnMode()) return "Android VPN Agent";
  if (isMacGlobalMode()) return "Mac 全局弱网";
  if (isMacUnityMode()) return "Mac Unity 真实断网仿真";
  return "macOS 网关";
}

function setHidden(element, hidden) {
  if (element) element.hidden = hidden;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitTargetList(value) {
  return String(value || "")
    .split(",")
    .map((target) => target.trim())
    .filter(Boolean);
}

function parseGatewayTarget(rawTarget) {
  const raw = String(rawTarget || "").trim();
  const separatorIndex = raw.lastIndexOf(":");
  const port = separatorIndex > 0 ? raw.slice(separatorIndex + 1).trim() : "";
  if (port && /^\d+$/.test(port)) {
    return {
      raw,
      host: raw.slice(0, separatorIndex).trim(),
      port,
    };
  }
  return {
    raw,
    host: raw,
    port: "all",
  };
}

function getMacUnityGatewayRows() {
  const stateTargets = Array.isArray(state.agent.macUnityTargets) ? state.agent.macUnityTargets : [];
  const inputTargets = elements.targetApp ? splitTargetList(elements.targetApp.value) : [];
  const sourceTargets = stateTargets.length ? stateTargets : inputTargets;
  const seen = new Set();
  return sourceTargets
    .map(parseGatewayTarget)
    .filter((target) => {
      if (!target.host) return false;
      const key = `${target.host}:${target.port}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getGatewaySummary(rows = getMacUnityGatewayRows()) {
  const hosts = new Set(rows.map((row) => row.host));
  const ports = new Set(rows.map((row) => row.port).filter(Boolean));
  return `Mac Unity · ${hosts.size} hosts · ${ports.size} ports`;
}

function getGatewayStateMeta(rows = getMacUnityGatewayRows()) {
  if (!rows.length) {
    return { label: "未配置", className: "empty" };
  }
  const active = Boolean(state.networkCurve.limitProfile && state.networkCurve.limitMode !== "normal");
  return active ? { label: "已生效", className: "active" } : { label: "待下发", className: "pending" };
}

function formatCompactGateway(row) {
  if (row.host.length <= 24) return `${row.host}:${row.port}`;
  return `${row.host.slice(0, 11)}...${row.host.slice(-8)}:${row.port}`;
}

function getGroupedGatewayRows(rows = getMacUnityGatewayRows()) {
  const groups = new Map();
  rows.forEach((row) => {
    if (!groups.has(row.host)) {
      groups.set(row.host, { host: row.host, ports: [], raws: [] });
    }
    const group = groups.get(row.host);
    if (!group.ports.includes(row.port)) group.ports.push(row.port);
    group.raws.push(row.raw);
  });
  return Array.from(groups.values());
}

function renderGatewayTable() {
  if (!elements.gatewayTableRows) return;
  const query = state.gateway.filter.trim().toLowerCase();
  const groups = getGroupedGatewayRows().filter((group) => {
    if (!query) return true;
    return group.host.toLowerCase().includes(query) || group.ports.some((port) => port.includes(query));
  });

  if (!groups.length) {
    elements.gatewayTableRows.innerHTML = '<p class="gateway-empty">没有匹配的网关</p>';
    return;
  }

  elements.gatewayTableRows.innerHTML = groups
    .map(
      (group) => `
        <div class="gateway-table-row" role="row">
          <span role="cell" title="${escapeHtml(group.host)}">${escapeHtml(group.host)}</span>
          <span role="cell">${escapeHtml(group.ports.join(", "))}</span>
        </div>
      `,
    )
    .join("");
}

function renderGatewayScope() {
  if (!elements.gatewayScope) return;
  const shouldShow = isMacUnityMode();
  setHidden(elements.gatewayScope, !shouldShow);
  if (!shouldShow) return;

  const rows = getMacUnityGatewayRows();
  const summary = getGatewaySummary(rows);
  const stateMeta = getGatewayStateMeta(rows);
  const collapsedRows = rows.slice(0, 3);
  const expandedRows = rows.slice(0, 5);

  elements.gatewaySummary.textContent = summary;
  if (elements.gatewayDialogSummary) elements.gatewayDialogSummary.textContent = summary;
  if (elements.gatewayState) {
    elements.gatewayState.className = `gateway-state ${stateMeta.className}`;
    elements.gatewayState.innerHTML = `<i aria-hidden="true"></i>${escapeHtml(stateMeta.label)}`;
  }

  elements.gatewayChipRow.innerHTML = collapsedRows
    .map(
      (row) => `
        <span class="gateway-chip" title="${escapeHtml(row.raw)}">${escapeHtml(formatCompactGateway(row))}</span>
      `,
    )
    .concat(
      rows.length > collapsedRows.length
        ? [`<button class="gateway-chip gateway-chip-more" type="button" data-gateway-view-all>+${rows.length - collapsedRows.length}</button>`]
        : [],
    )
    .join("");

  elements.gatewayInlineList.innerHTML = expandedRows
    .map(
      (row) => `
        <div class="gateway-inline-row">
          <span title="${escapeHtml(row.host)}">${escapeHtml(row.host)}</span>
          <b>${escapeHtml(row.port)}</b>
        </div>
      `,
    )
    .join("");
  elements.gatewayInlineList.hidden = !state.gateway.expanded || !rows.length;

  const hiddenCount = Math.max(0, rows.length - expandedRows.length);
  elements.gatewayMoreButton.hidden = !state.gateway.expanded || hiddenCount === 0;
  elements.gatewayMoreButton.textContent = `+${hiddenCount} more`;
  elements.gatewayToggleButton.hidden = rows.length <= collapsedRows.length;
  elements.gatewayToggleButton.textContent = state.gateway.expanded ? "收起" : "查看前 5 条";
  elements.gatewayCopyButton.disabled = !rows.length;
  elements.gatewayViewAllButton.disabled = !rows.length;

  renderGatewayTable();
}

function setGatewayDialogOpen(open) {
  if (!elements.gatewayDialog) return;
  elements.gatewayDialog.hidden = !open;
  document.body.classList.toggle("gateway-dialog-open", open);
  if (open) {
    state.gateway.filter = "";
    if (elements.gatewaySearchInput) elements.gatewaySearchInput.value = "";
    renderGatewayTable();
    window.setTimeout(() => elements.gatewaySearchInput?.focus(), 0);
  }
}

async function copyGatewayTargets(message = "受限网关已复制") {
  const rows = getMacUnityGatewayRows();
  if (!rows.length) return;
  await navigator.clipboard.writeText(rows.map((row) => row.raw).join("\n"));
  showToast(message, "success");
}

function exportGatewayTargets() {
  const rows = getMacUnityGatewayRows();
  if (!rows.length) return;
  const blob = new Blob([`${rows.map((row) => row.raw).join("\n")}\n`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mac-unity-gateways.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function updateDeviceActionLayout() {
  const buttons = [
    elements.refreshDevicesButton,
    elements.foregroundButton,
    elements.installVpnButton,
    elements.authorizeVpnButton,
  ];
  const visibleCount = buttons.filter((button) => button && !button.hidden).length;
  setHidden(elements.deviceActions, visibleCount === 0);
  if (elements.deviceActions) {
    elements.deviceActions.classList.toggle("single-action", visibleCount === 1);
  }
}

function updateModeListUi() {
  if (!elements.modeList) return;
  const mode = getNetworkMode();
  let activeOption = null;
  elements.modeList.querySelectorAll("[data-mode]").forEach((button) => {
    const active = button.dataset.mode === mode;
    if (active) activeOption = button;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", active ? "true" : "false");
  });
  if (activeOption && elements.modeTriggerLabel) {
    elements.modeTriggerLabel.textContent = activeOption.querySelector(".mode-name")?.textContent || getNetworkModeLabel();
  }
  if (activeOption && elements.modeTriggerTip && elements.modeTriggerTipBubble) {
    const tipText = activeOption.querySelector(".mode-tip-bubble")?.textContent || "";
    const tipLabel = activeOption.querySelector(".mode-tip")?.getAttribute("aria-label") || `${getNetworkModeLabel()} 说明`;
    elements.modeTriggerTip.setAttribute("aria-label", tipLabel);
    elements.modeTriggerTipBubble.textContent = tipText;
  }
}

function setModeListOpen(open) {
  if (!elements.modeList || !elements.modeTrigger) return;
  elements.modeList.hidden = !open;
  elements.modeTrigger.setAttribute("aria-expanded", open ? "true" : "false");
}

function toggleModeList() {
  if (!elements.modeList) return;
  setModeListOpen(elements.modeList.hidden);
}

function setNetworkMode(mode) {
  if (!elements.networkMode || elements.networkMode.value === mode) return;
  elements.networkMode.value = mode;
  elements.networkMode.dispatchEvent(new Event("change", { bubbles: true }));
}

function updateDeviceModeLayout() {
  const androidVpn = isAndroidVpnMode();
  const macGateway = getNetworkMode() === "macos";
  const macLocal = isMacLocalMode();

  if (elements.deviceTitle) {
    elements.deviceTitle.textContent = macLocal ? "本机弱网" : "测试设备";
  }
  if (elements.deviceStatus && macLocal) {
    elements.deviceStatus.textContent = "本机模式";
  } else if (elements.deviceStatus) {
    const device = getSelectedDevice();
    elements.deviceStatus.textContent = device ? (device.state === "device" ? "在线" : device.state) : state.agent.available ? "未连接" : "模拟";
  }

  setHidden(elements.deviceSerialField, !(androidVpn || macGateway));
  setHidden(elements.deviceIpField, !macGateway);
  setHidden(elements.platformField, !macGateway);
  setHidden(elements.targetAppField, !androidVpn);

  setHidden(elements.refreshDevicesButton, !(androidVpn || macGateway));
  setHidden(elements.foregroundButton, !androidVpn);
  setHidden(elements.installVpnButton, !androidVpn);
  setHidden(elements.authorizeVpnButton, !androidVpn);
  updateDeviceActionLayout();
}

function updateNetworkModeUi() {
  updateModeListUi();
  updateDeviceModeLayout();
  if (elements.targetAppLabel) {
    elements.targetAppLabel.textContent = isMacGlobalMode()
      ? "影响范围"
      : isMacUnityMode()
        ? "Unity 相关目标"
        : "目标游戏";
  }
  if (isMacGlobalMode()) {
    elements.targetApp.value = "整台 Mac 外网流量（localhost 不受影响）";
    elements.targetApp.placeholder = "整台 Mac 外网流量";
    elements.targetApp.disabled = true;
    elements.installVpnButton.disabled = true;
    elements.authorizeVpnButton.disabled = true;
    elements.foregroundButton.disabled = true;
    elements.deviceNote.textContent = "Mac 全局弱网会影响整台 Mac 的非 localhost 网络，效果最接近真实断网/弱网。";
  } else if (isMacUnityMode()) {
    if (elements.targetApp.value.trim() === "com.example.game" || elements.targetApp.value.startsWith("整台 Mac 外网")) {
      elements.targetApp.value = "";
    }
    elements.targetApp.disabled = false;
    elements.targetApp.placeholder = "例如 1.2.3.4:443 或 api.example.com";
    elements.installVpnButton.disabled = true;
    elements.authorizeVpnButton.disabled = true;
    elements.foregroundButton.disabled = true;
    elements.deviceNote.textContent = "Mac Unity 真实断网仿真会限制 Unity 业务/CDN/SDK 相关目标；完整目标见受限网关。";
  } else {
    const targetValue = elements.targetApp.value.trim();
    if (isAndroidVpnMode() && (targetValue.startsWith("整台 Mac 外网") || targetValue.includes(":") || targetValue.includes(","))) {
      elements.targetApp.value = "com.example.game";
    } else if (elements.targetApp.value.startsWith("整台 Mac 外网")) {
      elements.targetApp.value = isAndroidVpnMode() ? "com.example.game" : "";
    }
    elements.targetApp.disabled = false;
    elements.targetApp.placeholder = isAndroidVpnMode() ? "例如 com.ffm.global" : "例如 com.example.game";
    elements.installVpnButton.disabled = false;
    elements.authorizeVpnButton.disabled = false;
    elements.foregroundButton.disabled = false;
    if (isAndroidVpnMode()) {
      elements.deviceNote.textContent = "Android VPN Agent 模式会在手机端按目标包名接管流量；先选择设备和包名，再应用预设。";
    } else if (getNetworkMode() === "macos") {
      elements.deviceNote.textContent = "macOS 网关模式按设备 IP 控制经过 Mac 的测试机流量。";
    }
  }
  renderGatewayScope();
}

function getMacUnityTargetEndpoint() {
  return elements.targetApp.value.trim();
}

function getMacUnityTargetsForRequest() {
  const manualTarget = getMacUnityTargetEndpoint();
  if (manualTarget) return manualTarget;
  return state.agent.macUnityTargets.join(", ");
}

function assertMacUnityTargetReady(profile) {
  if (!isMacUnityMode() || profile.presetKey === "normal") return;
  const target = getMacUnityTargetsForRequest();
  if (!target) {
    throw new Error("Mac Unity 真实断网仿真需要内置目标；请确认 mac-unity-targets.json 已配置 host:port");
  }
}

async function loadMacUnityBuiltinTargets(fillInput = false) {
  if (!isLikelyLocalAgent()) return [];
  try {
    const data = await fetchAgentJson("/api/mac-unity/targets");
    const targets = Array.isArray(data.targets) ? data.targets.filter(Boolean) : [];
    state.agent.macUnityTargets = targets;
    if (fillInput && targets.length) {
      const current = getMacUnityTargetEndpoint();
      if (!current || current === "com.example.game" || current.startsWith("整台 Mac 外网")) {
        elements.targetApp.value = targets.join(", ");
      }
      elements.deviceNote.textContent = "已使用内置 Mac Unity 目标；完整目标见受限网关。";
    } else if (fillInput) {
      elements.deviceNote.textContent = "Mac Unity 内置目标尚未配置；请在 mac-unity-targets.json 填写三个 host:port。";
    }
    renderGatewayScope();
    renderCommandPreview();
    return targets;
  } catch (error) {
    if (fillInput) {
      elements.deviceNote.textContent = `读取 Mac Unity 内置目标失败：${error.message}`;
    }
    renderGatewayScope();
    return [];
  }
}

function isValidAndroidPackageName(value) {
  return /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(String(value || "").trim());
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
      message: "Android VPN Agent 将对目标包名执行 100% 丢包",
    };
  }

  return {
    supported: true,
    mode: "socks",
    message: "Android VPN Agent 将通过 Mac SOCKS 出口和 pf/dnctl 执行该弱网预设",
  };
}

function describeAndroidVpnStatus(data) {
  if (!data) return "Android VPN Agent 状态未知";
  if (!data.installed) return "Android VPN Agent 尚未安装";
  const status = data.status || {};
  if (status.mode === "blackhole" && status.running) {
    return `Android VPN 100% 丢包生效：${status.targetPackage || "目标应用"}`;
  }
  if (status.mode === "socks" && status.running) {
    if (data.macSocks && !data.macSocks.active) {
      return "Android VPN 已运行，但 Mac SOCKS 出口未运行；请重新点击应用预设";
    }
    return `Android VPN 弱网生效：${status.targetPackage || "目标应用"}`;
  }
  if (status.mode === "needs_permission") {
    return "Android VPN Agent 等待手机端 VPN 授权";
  }
  if (status.mode === "unsupported") {
    return status.message || "当前预设暂不支持 Android VPN Agent";
  }
  if (status.message) return `Android VPN Agent：${status.message}`;
  return data.running ? "Android VPN Agent 运行中" : "Android VPN Agent 已安装";
}

async function ensureAndroidDeviceSelected() {
  if (!state.agent.available || !state.agent.selectedSerial) {
    showToast("扫描 Android 设备", "info");
    await refreshDevices();
  }

  const device = getSelectedDevice();
  if (!device) {
    throw new Error("未发现已授权的 Android 设备，请确认 USB 调试已允许");
  }
  if (device.state !== "device") {
    throw new Error(`Android 设备状态不是在线：${device.state}`);
  }
  return device;
}

async function ensureAndroidVpnReady(profile) {
  const device = await ensureAndroidDeviceSelected();
  const support = getAndroidVpnProfileSupport(profile);
  if (!support.supported) {
    throw new Error(support.message);
  }
  const targetPackage = elements.targetApp.value.trim();
  if (profile.presetKey !== "normal" && !isValidAndroidPackageName(targetPackage)) {
    throw new Error("Android VPN 模式需要填写有效的目标应用包名，例如 com.example.game");
  }
  return device;
}

function findPreset(key) {
  return presets.find((preset) => preset.presetKey === key) || presets[0];
}

function formatBandwidth(kbps) {
  if (kbps === null || kbps === undefined) return "不限制";
  if (kbps === 0) return "0 Kbps";
  if (kbps >= 1000) {
    const mbps = kbps / 1000;
    return `${Number.isInteger(mbps) ? mbps : mbps.toFixed(1)} Mbps`;
  }
  return `${kbps} Kbps`;
}

function formatMs(value) {
  if (value === null || value === undefined) return "不适用";
  return `${value} ms`;
}

function formatLoss(value) {
  return `${Number(value).toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "不可用";
  return `${Math.round(value)}%`;
}

function formatMemory(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "不可用";
  return `${Math.round(value)} MB`;
}

function formatRate(kbps) {
  if (kbps === null || kbps === undefined || Number.isNaN(kbps)) return "采集中";
  if (kbps >= 1000) {
    const mbps = kbps / 1000;
    return `${mbps >= 10 ? Math.round(mbps) : mbps.toFixed(1)} Mbps`;
  }
  return `${Math.round(kbps)} Kbps`;
}

function getSingleWayDelay(profile) {
  if (profile.latencyRttMs === null || profile.latencyRttMs === undefined) return null;
  return Math.round(profile.latencyRttMs / 2);
}

function getSingleWayJitter(profile) {
  if (profile.jitterMs === null || profile.jitterMs === undefined) return null;
  return Math.round(profile.jitterMs / 2);
}

function renderDeviceOptions() {
  if (!state.agent.devices.length) {
    elements.deviceSerial.innerHTML = '<option value="">未发现 Android 设备</option>';
    elements.deviceStatus.textContent = state.agent.available ? "未连接" : "模拟";
    return;
  }

  elements.deviceSerial.innerHTML = state.agent.devices
    .map((device) => {
      const name = [device.manufacturer, device.model].filter(Boolean).join(" ") || device.serial;
      return `<option value="${device.serial}">${name} / ${device.serial}</option>`;
    })
    .join("");

  if (!state.agent.selectedSerial || !state.agent.devices.some((device) => device.serial === state.agent.selectedSerial)) {
    state.agent.selectedSerial = state.agent.devices[0].serial;
  }
  elements.deviceSerial.value = state.agent.selectedSerial;
  applySelectedDeviceToForm();
}

function getSelectedDevice() {
  return state.agent.devices.find((device) => device.serial === state.agent.selectedSerial) || null;
}

function applySelectedDeviceToForm() {
  const device = getSelectedDevice();
  if (!device) return;
  elements.deviceIp.value = device.ip || elements.deviceIp.value;
  elements.platform.value = "android";
  elements.deviceStatus.textContent = device.state === "device" ? "在线" : device.state;
  elements.deviceNote.textContent = `${device.manufacturer || "Android"} ${device.model || ""}，Android ${device.androidVersion || "-"}，IP ${device.ip || "未获取"}`;
  if (!state.agent.admin) elements.runtimeMode.textContent = "Agent 在线";
  renderCommandPreview();
}

async function refreshDevices() {
  if (!isLikelyLocalAgent()) {
    elements.deviceNote.textContent = "当前通过 file:// 打开，只能使用模拟模式。请运行 node server.js 后访问 http://localhost:8123。";
    elements.monitorStatus.textContent = "模拟数据";
    renderPerformanceStatus();
    return;
  }

  elements.deviceStatus.textContent = "扫描中";
  elements.deviceNote.textContent = "正在通过 adb 扫描设备...";
  try {
    const data = await fetchAgentJson("/api/devices");
    state.agent.available = Boolean(data.adbOk);
    state.agent.devices = (data.devices || []).filter((device) => device.state === "device");
    await refreshAdminStatus();
    renderDeviceOptions();
    elements.monitorStatus.textContent = state.agent.devices.length ? "真机就绪" : "未发现设备";
    if (!state.agent.devices.length) {
      elements.deviceNote.textContent = data.error || "未发现已授权的 Android 设备。";
    } else if (isAndroidVpnMode()) {
      await refreshAndroidVpnStatus(false);
    }
  } catch (error) {
    state.agent.available = false;
    elements.deviceStatus.textContent = "模拟";
    elements.deviceNote.textContent = `Agent 未连接：${error.message}`;
    elements.monitorStatus.textContent = "模拟数据";
  } finally {
    renderPerformanceStatus();
    if (isMacLocalMode()) {
      updateNetworkModeUi();
      if (isMacUnityMode()) {
        await loadMacUnityBuiltinTargets(true);
      }
    }
  }
}

async function refreshAndroidVpnStatus(announce = false) {
  if (!isLikelyLocalAgent() || !state.agent.selectedSerial) return null;
  const params = new URLSearchParams({ serial: state.agent.selectedSerial });
  try {
    const data = await fetchAgentJson(`/api/android-vpn/status?${params.toString()}`);
    state.agent.androidVpn = data;
    const message = describeAndroidVpnStatus(data);
    if (isAndroidVpnMode()) {
      elements.deviceNote.textContent = message;
    }
    if (announce) showToast(message, data.installed ? "success" : "info");
    return data;
  } catch (error) {
    if (announce) showToast(`读取 Android VPN 状态失败：${error.message}`, "error");
    return null;
  }
}

async function installAndroidVpnAgentFromUi() {
  if (!isLikelyLocalAgent()) {
    showToast("请通过本地 Agent 页面使用 Android VPN 功能", "error");
    return;
  }
  try {
    const device = await ensureAndroidDeviceSelected();
    elements.runtimeMode.textContent = "安装 Agent";
    showToast("开始安装 Android VPN Agent", "info");
    const data = await postAgentJson("/api/android-vpn/install", { serial: device.serial });
    showWeaknetStepToasts(data.steps);
    showToast(data.message || "Android VPN Agent 已安装", "success");
    await refreshAndroidVpnStatus(true);
  } catch (error) {
    showWeaknetStepToasts(error.data && error.data.steps);
    showToast(`安装 Android VPN Agent 失败：${error.message}`, "error", { duration: 6200 });
  }
}

async function authorizeAndroidVpnFromUi() {
  if (!isLikelyLocalAgent()) {
    showToast("请通过本地 Agent 页面使用 Android VPN 功能", "error");
    return;
  }
  try {
    const device = await ensureAndroidDeviceSelected();
    elements.runtimeMode.textContent = "等待 VPN 授权";
    showToast("打开 Android VPN 授权页", "info");
    const data = await postAgentJson("/api/android-vpn/authorize", { serial: device.serial });
    showWeaknetStepToasts(data.steps);
    elements.deviceNote.textContent = data.message || "已打开手机端授权页";
    showToast(data.message || "已打开手机端授权页", "success", { duration: 7000 });
    await refreshAndroidVpnStatus(false);
  } catch (error) {
    showWeaknetStepToasts(error.data && error.data.steps);
    showToast(`打开 VPN 授权失败：${error.message}`, "error", { duration: 6200 });
  }
}

async function readForegroundApp() {
  if (!state.agent.available || !state.agent.selectedSerial) {
    elements.deviceNote.textContent = "请先刷新设备，确认 Agent 已连接。";
    return;
  }

  elements.deviceNote.textContent = "正在读取前台应用...";
  try {
    const data = await fetchAgentJson(`/api/foreground?serial=${encodeURIComponent(state.agent.selectedSerial)}`);
    if (data.packageName) {
      elements.targetApp.value = data.packageName;
      elements.deviceNote.textContent = `已读取前台应用：${data.packageName}`;
      renderCommandPreview();
      restartRealMonitoringIfRunning();
    } else {
      elements.deviceNote.textContent = "没有读到前台应用，请先在手机上打开游戏。";
    }
  } catch (error) {
    elements.deviceNote.textContent = `读取前台应用失败：${error.message}`;
  }
}

function seedPerformanceSamples() {
  state.performance.samples = [];
  resetPerformanceChartDomains();
  for (let index = 0; index < 36; index += 1) {
    state.performance.samples.push(createPerformanceSample(index));
  }
}

function resetPerformanceChartDomains() {
  state.performance.chartDomains = {};
}

function getNetworkSeverity(profile) {
  if (profile.disconnectMode === "always" || profile.packetLossPercent >= 100) return 1;
  const latency = profile.latencyRttMs || 40;
  const loss = profile.packetLossPercent || 0;
  const bandwidth = Math.min(profile.downloadKbps ?? 50000, profile.uploadKbps ?? 20000);
  const latencyScore = Math.min(0.35, latency / 2200);
  const lossScore = Math.min(0.4, loss / 25);
  const bandwidthScore = bandwidth <= 0 ? 0.35 : Math.min(0.25, 600 / Math.max(bandwidth, 1));
  return Math.min(1, latencyScore + lossScore + bandwidthScore);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createPerformanceSample(index = state.performance.samples.length) {
  const profile = state.activeProfile;
  const severity = getNetworkSeverity(profile);
  const wave = Math.sin(index / 3) * 0.5 + Math.cos(index / 7) * 0.35;
  const fps = clamp(59 - severity * 22 + wave * 4 + randomBetween(-2, 2), 8, 60);
  const jank = Math.max(0, Math.round(severity * 9 + randomBetween(-1, 2)));
  const cpu = clamp(36 + severity * 24 + wave * 5 + randomBetween(-4, 5), 18, 92);
  const memory = clamp(980 + severity * 260 + wave * 45 + randomBetween(-35, 35), 680, 1800);
  const baseDown = profile.downloadKbps ?? 3600;
  const baseUp = profile.uploadKbps ?? 900;
  const downKbps = profile.disconnectMode === "always" ? 0 : clamp(baseDown * randomBetween(0.18, 0.72), 0, baseDown);
  const upKbps = profile.disconnectMode === "always" ? 0 : clamp(baseUp * randomBetween(0.12, 0.55), 0, baseUp);
  const rtt = profile.latencyRttMs === null ? 0 : clamp(profile.latencyRttMs + randomBetween(-profile.jitterMs, profile.jitterMs), 0, 2000);

  return {
    time: Date.now(),
    fps,
    jank,
    cpu,
    memory,
    downKbps,
    upKbps,
    rtt,
  };
}

function normalizeRealMetric(metric) {
  const fallback = state.performance.lastRealSample;
  const sample = {
    time: metric.timestamp || Date.now(),
    fps: metric.fps ?? null,
    jank: metric.jank ?? null,
    cpu: metric.cpu ?? null,
    memory: metric.memoryMb ?? null,
    downKbps: metric.downKbps ?? null,
    upKbps: metric.upKbps ?? null,
    rtt: metric.rttMs ?? null,
    networkInterface: metric.networkInterface || (fallback && fallback.networkInterface) || "",
    source: "adb",
    errors: metric.errors || [],
    packageName: metric.packageName,
  };
  state.performance.lastRealSample = sample;
  return sample;
}

function createEmptyRealPerformanceSample() {
  return {
    time: Date.now(),
    fps: null,
    jank: null,
    cpu: null,
    memory: null,
    downKbps: null,
    upKbps: null,
    rtt: null,
    networkInterface: "",
    source: "adb",
    errors: [],
  };
}

function getLatestPerformanceSample() {
  const latest = state.performance.samples[state.performance.samples.length - 1];
  if (latest) return latest;
  if (state.performance.running && state.agent.metricsSource === "adb") {
    return createEmptyRealPerformanceSample();
  }
  return createPerformanceSample();
}

function getLatestRealPerformanceSample() {
  const latest = state.performance.samples[state.performance.samples.length - 1];
  return latest && latest.source === "adb" ? latest : null;
}

function formatPerformanceErrorList(errors = []) {
  return errors.filter(Boolean).join("；");
}

function getPerformanceStatusMeta() {
  const packageName = (elements.targetApp && elements.targetApp.value.trim()) || "目标应用";
  const latestReal = getLatestRealPerformanceSample();
  const errors = latestReal && Array.isArray(latestReal.errors) ? latestReal.errors : [];
  const hasAppMissing = errors.some((item) => /应用未运行|No process|Unable to find/i.test(item));
  const hasSurfaceMissing = errors.some((item) => /Surface|画面层/.test(item));

  if (state.performance.streamError) {
    return {
      label: "采集异常",
      title: "指标流断开",
      message: "请刷新设备或重启本地 Agent。",
      tone: "error",
    };
  }

  if (state.performance.running && state.agent.metricsSource === "adb") {
    if (!packageName || packageName === "目标应用") {
      return {
        label: "缺少包名",
        title: "缺少目标游戏包名",
        message: "请填写包名，或点击读取前台应用。",
        tone: "warn",
      };
    }
    if (!latestReal) {
      return {
        label: "真机监控中",
        title: "正在建立真机指标流",
        message: `正在采集 ${packageName}，请确认游戏已在手机上运行。`,
        tone: "info",
      };
    }
    if (hasAppMissing) {
      return {
        label: "应用未运行",
        title: "目标应用未运行，曲线暂不更新",
        message: `${packageName} 没有进程或画面层；FPS、卡顿、CPU、内存暂不可用。`,
        tone: "warn",
      };
    }
    if (hasSurfaceMissing) {
      return {
        label: "画面层缺失",
        title: "未找到游戏画面层，FPS 暂不可用",
        message: "请确认游戏在前台运行，或点击读取前台应用校准包名。",
        tone: "warn",
      };
    }
    if (errors.length) {
      return {
        label: "部分不可用",
        title: "部分指标暂不可用",
        message: `${formatPerformanceErrorList(errors)}；其余指标继续更新。`,
        tone: "warn",
      };
    }
    if (latestReal.downKbps === null || latestReal.downKbps === undefined || latestReal.upKbps === null || latestReal.upKbps === undefined) {
      return {
        label: "网络采集中",
        title: "网络速率采集中",
        message: "首次采样需要等待下一次数据对比。",
        tone: "info",
      };
    }
    return {
      label: "真机监控中",
      title: "真机指标采集中",
      message: "FPS、CPU、内存、网络、RTT 正在更新。",
      tone: "ok",
    };
  }

  if (state.performance.running && state.agent.metricsSource === "simulated") {
    return {
      label: "模拟数据",
      title: "当前为模拟监控数据",
      message: "连接本地 Agent 和 Android 设备后可采集真机指标。",
      tone: "info",
    };
  }

  if (state.performance.paused) {
    return {
      label: "已暂停",
      title: "性能监控已暂停",
      message: "点击开始后继续采集。",
      tone: "info",
    };
  }

  if (!isLikelyLocalAgent() || !state.agent.available) {
    return {
      label: "模拟数据",
      title: "当前为模拟监控数据",
      message: "启动本地 Agent 后可读取真机指标。",
      tone: "info",
    };
  }

  if (!state.agent.devices.length) {
    return {
      label: "未发现设备",
      title: "未发现已授权 Android 设备",
      message: "请确认 USB 调试授权后刷新设备。",
      tone: "warn",
    };
  }

  return {
    label: "真机就绪",
    title: "真机已连接，等待开始采集",
    message: "请选择目标游戏包名后点击开始。",
    tone: "ok",
  };
}

function renderPerformanceStatus() {
  const meta = getPerformanceStatusMeta();
  const toneClasses = ["status-ok", "status-warn", "status-error", "status-info"];
  if (elements.monitorStatus) {
    elements.monitorStatus.textContent = meta.label;
    elements.monitorStatus.classList.remove(...toneClasses);
    elements.monitorStatus.classList.add(`status-${meta.tone}`);
  }
  if (elements.performanceStatusDetail) {
    elements.performanceStatusDetail.classList.remove(...toneClasses);
    elements.performanceStatusDetail.classList.add(`status-${meta.tone}`);
  }
  if (elements.performanceStatusTitle) elements.performanceStatusTitle.textContent = meta.title;
  if (elements.performanceStatusMessage) elements.performanceStatusMessage.textContent = meta.message;
}

function renderPerformance() {
  const latest = getLatestPerformanceSample();
  const isReal = latest.source === "adb";
  const errors = isReal && Array.isArray(latest.errors) ? latest.errors : [];
  const isAppWaiting = errors.some((item) => /应用未运行|No process|Unable to find/i.test(item));
  const appPendingText = isAppWaiting ? "等待应用" : "采集中";
  const fpsValue = latest.fps === null || latest.fps === undefined ? appPendingText : Math.round(latest.fps);
  const jankValue = latest.jank === null || latest.jank === undefined ? appPendingText : `${latest.jank} 次`;
  const rttValue = latest.rtt === null || latest.rtt === undefined ? "不可用" : formatMs(Math.round(latest.rtt));
  const networkHint = latest.networkInterface ? `下行 / 上行 ${latest.networkInterface}` : "下行 / 上行";
  const metrics = [
    ["FPS", fpsValue, isReal ? "adb gfxinfo" : "frames/s", isReal && (latest.fps === null || latest.fps === undefined)],
    ["卡顿", jankValue, "当前采样", isReal && (latest.jank === null || latest.jank === undefined)],
    [
      "CPU",
      isReal && (latest.cpu === null || latest.cpu === undefined) && isAppWaiting ? "等待应用" : formatPercent(latest.cpu),
      "进程估算",
      isReal && (latest.cpu === null || latest.cpu === undefined),
    ],
    [
      "内存",
      isReal && (latest.memory === null || latest.memory === undefined) && isAppWaiting ? "等待应用" : formatMemory(latest.memory),
      "常驻内存",
      isReal && (latest.memory === null || latest.memory === undefined),
    ],
    ["网络", `${formatRate(latest.downKbps)} / ${formatRate(latest.upKbps)}`, networkHint, isReal && latest.downKbps === null && latest.upKbps === null],
    ["RTT", rttValue, "网络往返", isReal && (latest.rtt === null || latest.rtt === undefined)],
  ];

  elements.performanceGrid.innerHTML = metrics
    .map(
      ([label, value, hint, muted]) => `
        <div class="metric perf-metric${label === "网络" ? " network-metric" : ""}${muted ? " is-muted" : ""}">
          <span>${label}</span>
          <strong>${value}</strong>
          <small>${hint}</small>
        </div>
      `,
    )
    .join("");

  renderPerformanceStatus();
  drawPerformanceChart();
}

function drawPerformanceChart() {
  const canvas = elements.performanceChart;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(190, Math.floor(rect.height || 238));
  const dpr = window.devicePixelRatio || 1;
  const backingWidth = Math.round(width * dpr);
  const backingHeight = Math.round(height * dpr);
  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, "#132229");
  background.addColorStop(1, "#0b1519");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const padX = width < 440 ? 24 : 40;
  const plot = {
    left: padX,
    right: width - (width < 440 ? 16 : 24),
    top: 48,
    bottom: height - 28,
  };
  plot.width = plot.right - plot.left;
  plot.height = plot.bottom - plot.top;

  ctx.strokeStyle = "rgba(221, 236, 240, 0.10)";
  ctx.lineWidth = 1;
  for (let row = 0; row <= 4; row += 1) {
    const y = plot.top + (plot.height / 4) * row;
    ctx.beginPath();
    ctx.moveTo(plot.left, y);
    ctx.lineTo(plot.right, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(221, 236, 240, 0.045)";
  for (let col = 1; col <= 4; col += 1) {
    const x = plot.left + (plot.width / 5) * col;
    ctx.beginPath();
    ctx.moveTo(x, plot.top);
    ctx.lineTo(x, plot.bottom);
    ctx.stroke();
  }

  const samples = state.performance.samples.slice(-56);
  const isRealRunning = state.performance.running && state.agent.metricsSource === "adb";
  const latestReal = getLatestRealPerformanceSample();
  const errors = latestReal && Array.isArray(latestReal.errors) ? latestReal.errors : [];
  const hasAppMissing = errors.some((item) => /应用未运行|No process|Unable to find/i.test(item));
  const series = [
    {
      key: "fps",
      label: "FPS",
      max: 60,
      minRange: 12,
      color: "#49d3e2",
      area: "rgba(73, 211, 226, 0.055)",
      glow: "rgba(73, 211, 226, 0.22)",
    },
    {
      key: "cpu",
      label: "CPU",
      max: 100,
      minRange: 18,
      color: "#9bdc7a",
      area: "rgba(155, 220, 122, 0.045)",
      glow: "rgba(155, 220, 122, 0.18)",
    },
    {
      key: "rtt",
      label: "RTT",
      max: 1000,
      minRange: 80,
      color: "#eab75b",
      area: "rgba(234, 183, 91, 0.025)",
      glow: "rgba(234, 183, 91, 0.14)",
    },
  ].map((item) => ({
    ...item,
    ...getPerformanceSeriesGeometry(samples, item, plot),
  }));

  drawPerformanceLegend(ctx, series, plot.left, 22, width, isRealRunning);
  series.forEach((item) => drawPerformanceSeries(ctx, item, plot));

  const hasAnySeries = series.some((item) => item.points.length > 0);
  const hasAppSeries = series.some((item) => (item.key === "fps" || item.key === "cpu") && item.points.length > 0);
  if (isRealRunning && (!latestReal || hasAppMissing || !hasAppSeries)) {
    const title = !latestReal ? "正在建立真机指标流" : "等待目标应用启动后绘制 FPS / CPU 曲线";
    const message = !latestReal
      ? "收到第一组真实采样后开始绘制。"
      : "当前仅保留网络与 RTT 采样，不展示虚假的应用性能曲线。";
    drawPerformanceEmptyMessage(ctx, width, height, title, message);
  } else if (!hasAnySeries) {
    drawPerformanceEmptyMessage(ctx, width, height, "等待性能采样", "曲线会在收到有效数据后开始绘制。");
  }
}

function getFinitePerformanceValue(sample, key) {
  const rawValue = sample && sample[key];
  if (rawValue === null || rawValue === undefined || rawValue === "") return null;
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
}

function getPerformanceTargetDomain(samples, item) {
  const values = samples
    .map((sample) => getFinitePerformanceValue(sample, item.key))
    .filter((value) => value !== null)
    .map((value) => clamp(value, 0, item.max));
  if (!values.length) return null;

  let min = Math.min(...values);
  let max = Math.max(...values);
  const minRange = item.minRange || item.max * 0.12;
  if (max - min < minRange) {
    const midpoint = (min + max) / 2;
    min = midpoint - minRange / 2;
    max = midpoint + minRange / 2;
  }

  min = Math.max(0, min);
  max = Math.min(item.max, max);
  if (max - min < 1) {
    if (max >= item.max) min = Math.max(0, item.max - 1);
    else max = Math.min(item.max, min + 1);
  }

  return { min, max };
}

function resolvePerformanceDomain(item, target) {
  if (!target) return null;
  const previous = state.performance.chartDomains[item.key];
  if (!previous) {
    state.performance.chartDomains[item.key] = target;
    return target;
  }

  const ease = 0.16;
  let min = target.min < previous.min ? target.min : previous.min + (target.min - previous.min) * ease;
  let max = target.max > previous.max ? target.max : previous.max + (target.max - previous.max) * ease;
  const minRange = item.minRange || item.max * 0.12;
  if (max - min < minRange) {
    const midpoint = (min + max) / 2;
    min = midpoint - minRange / 2;
    max = midpoint + minRange / 2;
  }

  min = Math.max(0, min);
  max = Math.min(item.max, max);
  if (max - min < 1) {
    max = Math.min(item.max, min + 1);
  }
  const domain = { min, max };
  state.performance.chartDomains[item.key] = domain;
  return domain;
}

function getPerformanceSeriesGeometry(samples, item, plot) {
  const targetDomain = getPerformanceTargetDomain(samples, item);
  const domain = resolvePerformanceDomain(item, targetDomain);
  if (!domain) return { points: [], segments: [] };

  const visualTop = plot.top + 4;
  const visualBottom = plot.bottom - 6;
  const visualHeight = visualBottom - visualTop;
  const denominator = Math.max(1, domain.max - domain.min);
  const segments = [];
  let currentSegment = [];

  samples.forEach((sample, index) => {
    const rawValue = getFinitePerformanceValue(sample, item.key);
    if (rawValue === null) {
      if (currentSegment.length) {
        segments.push(currentSegment);
        currentSegment = [];
      }
      return;
    }
    const x = samples.length === 1 ? plot.left : plot.left + (index / (samples.length - 1)) * plot.width;
    const value = clamp(rawValue, domain.min, domain.max);
    const ratio = (value - domain.min) / denominator;
    const y = visualBottom - ratio * visualHeight;
    currentSegment.push({ x, y });
  });

  if (currentSegment.length) segments.push(currentSegment);
  return {
    points: segments.flat(),
    segments,
  };
}

function appendSmoothPath(ctx, points, shouldMove) {
  if (!points.length) return;
  if (shouldMove) ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 1) return;
  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    return;
  }
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    ctx.quadraticCurveTo(current.x, current.y, midX, midY);
  }
  const beforeLast = points[points.length - 2];
  const last = points[points.length - 1];
  ctx.quadraticCurveTo(beforeLast.x, beforeLast.y, last.x, last.y);
}

function drawPerformanceSeries(ctx, item, plot) {
  const points = item.points;
  if (!points.length) return;
  ctx.save();
  ctx.strokeStyle = item.color;
  ctx.lineWidth = item.key === "rtt" ? 1.8 : 2.1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = item.glow;
  ctx.shadowBlur = 4;
  item.segments.forEach((segment) => {
    if (segment.length < 2) return;
    ctx.beginPath();
    appendSmoothPath(ctx, segment, true);
    ctx.stroke();
  });
  ctx.restore();

  const last = points[points.length - 1];
  ctx.fillStyle = item.color;
  ctx.strokeStyle = "#0b1418";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(last.x, last.y, item.key === "rtt" ? 3 : 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawPerformanceLegend(ctx, series, startX, y, width, isRealRunning) {
  ctx.font = "700 11px Inter, sans-serif";
  let x = startX;
  const waitHint = width < 440 ? "等待" : "等待应用";
  series.forEach((item) => {
    const active = item.points.length > 0;
    const label = !active && isRealRunning && (item.key === "fps" || item.key === "cpu") ? `${item.label} ${waitHint}` : item.label;
    ctx.strokeStyle = active ? item.color : "rgba(210, 224, 232, 0.28)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 14, y);
    ctx.stroke();
    ctx.fillStyle = active ? "rgba(224, 240, 244, 0.9)" : "rgba(184, 202, 212, 0.55)";
    ctx.fillText(label, x + 20, y + 4);
    x += ctx.measureText(label).width + 42;
  });
}

function drawPerformanceEmptyMessage(ctx, width, height, title, message) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 13px Inter, sans-serif";
  ctx.fillStyle = "rgba(229, 241, 245, 0.88)";
  ctx.fillText(title, width / 2, height * 0.52 - 8);
  ctx.font = "700 11px Inter, sans-serif";
  ctx.fillStyle = "rgba(174, 195, 205, 0.72)";
  ctx.fillText(message, width / 2, height * 0.52 + 12);
  ctx.restore();
}

function formatNetworkCurveSpeed(kbps) {
  if (!kbps) return "--";
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mbps`;
  return `${Math.round(kbps)} Kbps`;
}

function getNetworkCurveTimestamp(timestamp = Date.now()) {
  return new Date(timestamp).toLocaleTimeString("zh-CN", { hour12: false });
}

function getProfileLimitKbps(profile, field) {
  const value = Number(profile && profile[field]);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function isNetworkCurveProfileBlocked(profile) {
  if (!profile) return false;
  return (
    profile.disconnectMode === "always" ||
    profile.packetLossPercent >= 100 ||
    profile.downloadKbps === 0 ||
    profile.uploadKbps === 0
  );
}

function buildNetworkCurveStatusFromProfile(profile, mode = "local") {
  if (!profile || profile.presetKey === "normal") {
    return {
      ok: true,
      active: false,
      blocked: false,
      timestamp: Date.now(),
      downKbps: 0,
      upKbps: 0,
      mode: "normal",
      source: "profile",
    };
  }
  const blocked = isNetworkCurveProfileBlocked(profile);
  return {
    ok: true,
    active: true,
    blocked,
    timestamp: Date.now(),
    downKbps: blocked ? 0 : getProfileLimitKbps(profile, "downloadKbps"),
    upKbps: blocked ? 0 : getProfileLimitKbps(profile, "uploadKbps"),
    mode,
    source: "profile",
  };
}

function rememberNetworkCurveLimit(profile, mode = "local") {
  if (!profile || profile.presetKey === "normal") {
    state.networkCurve.limitProfile = null;
    state.networkCurve.limitMode = "normal";
  } else {
    state.networkCurve.limitProfile = { ...profile };
    state.networkCurve.limitMode = mode;
  }
  pushNetworkCurvePoint(buildNetworkCurveStatusFromProfile(state.networkCurve.limitProfile, state.networkCurve.limitMode));
}

function pushNetworkCurvePoint(status) {
  const localProfile = state.networkCurve.limitProfile;
  const localBlocked = localProfile && isNetworkCurveProfileBlocked(localProfile);
  const blocked = Boolean(status.blocked || localBlocked);
  const downKbps = blocked
    ? 0
    : localProfile
      ? getProfileLimitKbps(localProfile, "downloadKbps")
      : Math.max(0, Number(status.downKbps || 0));
  const upKbps = blocked
    ? 0
    : localProfile
      ? getProfileLimitKbps(localProfile, "uploadKbps")
      : Math.max(0, Number(status.upKbps || 0));
  const active = Boolean(localProfile || status.active);
  state.networkCurve.samples.push({
    time: status.timestamp || Date.now(),
    label: getNetworkCurveTimestamp(status.timestamp),
    downKbps,
    upKbps,
  });
  state.networkCurve.samples = state.networkCurve.samples.slice(-90);

  elements.networkDownLegend.textContent = formatNetworkCurveSpeed(downKbps);
  elements.networkUpLegend.textContent = formatNetworkCurveSpeed(upKbps);
  if (status.permissionDenied && !localProfile) {
    elements.networkCurveStatus.textContent = "需要管理员";
  } else if (!status.ok && !localProfile) {
    elements.networkCurveStatus.textContent = "采集异常";
  } else if (blocked) {
    elements.networkCurveStatus.textContent = "阻断中";
  } else if (active) {
    elements.networkCurveStatus.textContent = status.jitter ? "波动中" : "限制生效";
  } else {
    elements.networkCurveStatus.textContent = "未启用";
  }
  drawNetworkCurveChart();
}

function drawNetworkCurveChart() {
  const canvas = elements.networkCurveChart;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(160, Math.floor(rect.height || 180));
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#10181c";
  ctx.fillRect(0, 0, width, height);

  const samples = state.networkCurve.samples;
  const pad = { top: 12, right: 12, bottom: 28, left: 58 };
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  let yMax = 10;
  samples.forEach((sample) => {
    yMax = Math.max(yMax, sample.downKbps, sample.upKbps);
  });
  yMax = Math.max(yMax * 1.15, 10);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  ctx.font = "11px Inter, sans-serif";
  ctx.fillStyle = "#6b7280";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let index = 0; index <= 4; index += 1) {
    const y = pad.top + chartHeight - (chartHeight * index) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    ctx.fillText(formatNetworkCurveSpeed((yMax * index) / 4).replace("--", "0 Kbps"), pad.left - 6, y);
  }

  if (samples.length < 2) {
    ctx.fillStyle = "rgba(220, 236, 240, 0.58)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "13px Inter, sans-serif";
    ctx.fillText("等待网络曲线数据", width / 2, height / 2);
    return;
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const labelStep = Math.max(1, Math.floor(samples.length / 6));
  samples.forEach((sample, index) => {
    if (index % labelStep !== 0 && index !== samples.length - 1) return;
    const x = pad.left + (index / (samples.length - 1)) * chartWidth;
    ctx.fillStyle = "#6b7280";
    ctx.fillText(sample.label, x, height - pad.bottom + 8);
  });

  const drawCurveLine = (key, color) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    samples.forEach((sample, index) => {
      const x = pad.left + (index / (samples.length - 1)) * chartWidth;
      const y = pad.top + chartHeight - (sample[key] / yMax) * chartHeight;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.lineTo(pad.left + chartWidth, pad.top + chartHeight);
    ctx.lineTo(pad.left, pad.top + chartHeight);
    ctx.closePath();
    ctx.fillStyle = color.replace("1)", "0.06)");
    ctx.fill();

    const last = samples[samples.length - 1];
    const dotX = pad.left + chartWidth;
    const dotY = pad.top + chartHeight - (last[key] / yMax) * chartHeight;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };

  drawCurveLine("upKbps", "rgba(34,197,94,1)");
  drawCurveLine("downKbps", "rgba(99,102,241,1)");
}

function startNetworkCurve() {
  if (state.networkCurve.eventSource || state.networkCurve.timerId) return;
  if (!isLikelyLocalAgent()) {
    elements.networkCurveStatus.textContent = "模拟模式";
    drawNetworkCurveChart();
    return;
  }

  const eventSource = new EventSource("/api/network/stream");
  state.networkCurve.eventSource = eventSource;
  eventSource.onmessage = (event) => {
    pushNetworkCurvePoint(JSON.parse(event.data));
  };
  eventSource.onerror = () => {
    elements.networkCurveStatus.textContent = "采集异常";
  };
}

function setMonitorTab(tab) {
  state.monitorTab = tab;
  const isNetwork = tab === "network";
  elements.monitorTitle.textContent = isNetwork ? "实时网络曲线" : "性能监控";
  elements.networkCurveTab.classList.toggle("active", isNetwork);
  elements.performanceTab.classList.toggle("active", !isNetwork);
  elements.networkCurveTab.setAttribute("aria-selected", isNetwork ? "true" : "false");
  elements.performanceTab.setAttribute("aria-selected", isNetwork ? "false" : "true");
  elements.networkCurvePanel.hidden = !isNetwork;
  elements.performancePanel.hidden = isNetwork;
  elements.networkCurveStatus.hidden = !isNetwork;
  elements.monitorStatus.hidden = isNetwork;
  if (isNetwork) drawNetworkCurveChart();
  else {
    renderPerformanceStatus();
    renderPerformance();
  }
}

function tickPerformance() {
  state.performance.samples.push(createPerformanceSample());
  state.performance.samples = state.performance.samples.slice(-72);
  renderPerformance();
}

function startMonitoring() {
  if (state.performance.running) return;
  state.performance.paused = false;
  state.performance.streamError = false;
  resetPerformanceChartDomains();
  if (state.agent.available && state.agent.selectedSerial && isLikelyLocalAgent()) {
    startRealMonitoring();
    return;
  }

  state.performance.running = true;
  state.agent.metricsSource = "simulated";
  elements.monitorStatus.textContent = "模拟监控中";
  tickPerformance();
  state.performance.timerId = window.setInterval(tickPerformance, 1000);
}

function startRealMonitoring() {
  const serial = state.agent.selectedSerial;
  const packageName = elements.targetApp.value.trim();
  if (!packageName) {
    elements.monitorStatus.textContent = "缺少包名";
    elements.deviceNote.textContent = "请填写目标游戏包名，或先点击“读取前台应用”。";
    renderPerformanceStatus();
    return;
  }

  stopMonitoring();
  state.performance.running = true;
  state.performance.paused = false;
  state.performance.streamError = false;
  state.agent.metricsSource = "adb";
  state.performance.samples = [];
  resetPerformanceChartDomains();
  state.performance.lastRealSample = null;
  elements.monitorStatus.textContent = "真机监控中";
  elements.deviceNote.textContent = `正在采集 ${packageName}，请确认游戏已在手机上运行。`;
  renderPerformanceStatus();

  const params = new URLSearchParams({ serial, package: packageName });
  const eventSource = new EventSource(`/api/metrics/stream?${params.toString()}`);
  state.performance.eventSource = eventSource;

  eventSource.onmessage = (event) => {
    const metric = JSON.parse(event.data);
    if (metric.packageName !== elements.targetApp.value.trim()) {
      return;
    }
    const sample = normalizeRealMetric(metric);
    state.performance.streamError = false;
    state.performance.samples.push(sample);
    state.performance.samples = state.performance.samples.slice(-72);
    renderPerformance();

    if (sample.errors && sample.errors.length) {
      elements.deviceNote.textContent = `${packageName}：${sample.errors.join("；")}`;
    } else {
      elements.deviceNote.textContent = `${packageName}：真机指标采集中`;
    }
  };

  eventSource.onerror = () => {
    state.performance.streamError = true;
    elements.monitorStatus.textContent = "采集异常";
    elements.deviceNote.textContent = "真机指标流断开，请刷新设备或重启 Agent。";
    renderPerformanceStatus();
  };
}

function restartRealMonitoringIfRunning() {
  if (!state.performance.running || state.agent.metricsSource !== "adb") return;
  startRealMonitoring();
}

function stopMonitoring() {
  state.performance.running = false;
  state.performance.paused = true;
  elements.monitorStatus.textContent = "已暂停";
  window.clearInterval(state.performance.timerId);
  state.performance.timerId = null;
  if (state.performance.eventSource) {
    state.performance.eventSource.close();
    state.performance.eventSource = null;
  }
  renderPerformanceStatus();
}

function renderPresets() {
  const visible = presets.filter((preset) => preset.category === state.category);
  elements.presetGrid.innerHTML = visible
    .map((preset) => {
      const isActive = preset.presetKey === state.selectedKey;
      const isDanger = preset.packetLossPercent >= 50 || preset.disconnectMode === "always";
      return `
        <button class="preset-card ${isActive ? "active" : ""} ${isDanger ? "danger" : ""}" data-preset-key="${preset.presetKey}" type="button">
          <h3>${preset.displayNameZh}</h3>
          <p>${preset.scene}</p>
          <div class="chips">
            <span class="chip">RTT ${formatMs(preset.latencyRttMs)}</span>
            <span class="chip">丢包 ${formatLoss(preset.packetLossPercent)}</span>
            <span class="chip">下行 ${formatBandwidth(preset.downloadKbps)}</span>
          </div>
        </button>
      `;
    })
    .join("");
}

function renderSummary() {
  const profile = state.activeProfile;
  elements.selectedName.textContent = profile.displayNameZh;
  elements.selectedScene.textContent = profile.scene;

  const metrics = [
    ["应用模式", getNetworkModeLabel()],
    ["RTT 延迟", formatMs(profile.latencyRttMs)],
    ["单向延迟", formatMs(getSingleWayDelay(profile))],
    ["抖动", formatMs(profile.jitterMs)],
    ["丢包率", formatLoss(profile.packetLossPercent)],
    ["下行带宽", formatBandwidth(profile.downloadKbps)],
    ["上行带宽", formatBandwidth(profile.uploadKbps)],
    ["断连模式", getDisconnectLabel(profile)],
    ["内部 Key", profile.presetKey],
  ];

  elements.metricsGrid.innerHTML = metrics
    .map(
      ([label, value]) => `
        <div class="metric">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `,
    )
    .join("");
}

function getDisconnectLabel(profile) {
  if (profile.disconnectMode === "always") return "持续断网";
  if (profile.disconnectMode === "periodic") {
    return `${profile.disconnectDurationSec}s / ${profile.disconnectIntervalSec}s`;
  }
  return "无";
}

function syncEditorFromProfile() {
  editorFields.forEach((field) => {
    const input = document.getElementById(field);
    input.value = state.activeProfile[field] ?? "";
    input.disabled = !elements.advancedToggle.checked;
  });
}

function syncProfileFromEditor() {
  if (!elements.advancedToggle.checked) return;

  editorFields.forEach((field) => {
    const input = document.getElementById(field);
    const value = input.value.trim();
    if (value === "") {
      state.activeProfile[field] = null;
      return;
    }
    state.activeProfile[field] = Number(value);
  });

  state.activeProfile.packetLossPercent = Math.min(
    100,
    Math.max(0, state.activeProfile.packetLossPercent || 0),
  );
  state.activeProfile.disconnectMode = inferDisconnectMode(state.activeProfile);
}

function inferDisconnectMode(profile) {
  if (profile.packetLossPercent >= 100 || profile.downloadKbps === 0 || profile.uploadKbps === 0) {
    return "always";
  }
  if (profile.disconnectDurationSec > 0 && profile.disconnectIntervalSec > 0) {
    return "periodic";
  }
  return "none";
}

function renderCommandPreview() {
  const profile = state.activeProfile;
  const deviceIp = elements.deviceIp.value.trim() || "192.168.2.12";
  const targetPackage = elements.targetApp.value.trim() || "com.example.game";
  const serial = state.agent.selectedSerial || "<device_serial>";

  if (elements.commandEyebrow) {
    elements.commandEyebrow.textContent = isAndroidVpnMode()
      ? "Android VPN Agent"
      : isMacGlobalMode()
        ? "Mac Global"
        : isMacUnityMode()
          ? "Mac Unity"
        : "macOS Gateway";
  }

  if (isAndroidVpnMode()) {
    const support = getAndroidVpnProfileSupport(profile);
    if (profile.presetKey === "normal") {
      elements.commandPreview.textContent = [
        "# Android VPN Agent：清除手机端弱网",
        `# serial=${serial}`,
        `adb -s ${serial} shell am broadcast -n com.weaknet.agent/.CommandReceiver -a com.weaknet.agent.STOP`,
      ].join("\n");
      return;
    }

    if (!support.supported) {
    elements.commandPreview.textContent = [
      `# ${profile.displayNameZh}`,
      "# Android VPN Agent 暂不支持该预设",
      `# ${support.message}`,
      "# 可切换到 macOS 网关，或选择“100% 丢包”验证目标包断网行为",
      ].join("\n");
      return;
    }

    if (support.mode === "socks") {
      elements.commandPreview.textContent = [
        `# ${profile.displayNameZh}：Android VPN Agent + Mac SOCKS 弱网`,
        `# serial=${serial}`,
        `# target_package=${targetPackage}`,
        "# Mac 控制台会启动 SOCKS5 出口 0.0.0.0:8124，仅允许当前 Android IP 连接",
        "# Mac 控制台会用 pf/dnctl 对 Android<->Mac SOCKS 隧道施加延迟/丢包/带宽/断续",
        `adb -s ${serial} shell am broadcast -n com.weaknet.agent/.CommandReceiver -a com.weaknet.agent.APPLY --es profileBase64 '<profile-json-with-socks-endpoint>' --es targetPackage ${targetPackage}`,
      ].join("\n");
      return;
    }

    elements.commandPreview.textContent = [
      `# ${profile.displayNameZh}：Android VPN Agent 100% 丢包`,
      `# serial=${serial}`,
      `# target_package=${targetPackage}`,
      "adb install -r -d android-agent/dist/weaknet-agent-debug.apk",
      "adb shell am start -n com.weaknet.agent/.MainActivity",
      "# 首次使用需要在手机上同意 VPN 权限",
      `adb -s ${serial} shell am broadcast -n com.weaknet.agent/.CommandReceiver -a com.weaknet.agent.APPLY --es profileBase64 '<profile-json-base64>' --es targetPackage ${targetPackage}`,
    ].join("\n");
    return;
  }

  if (isMacGlobalMode()) {
    const oneWayDelay = getSingleWayDelay(profile);
    const plr = Math.min(1, Math.max(0, Number(profile.packetLossPercent || 0) / 100));
    const down = profile.downloadKbps === null || profile.downloadKbps === undefined ? "noerror" : `${profile.downloadKbps}Kbit/s`;
    const up = profile.uploadKbps === null || profile.uploadKbps === undefined ? "noerror" : `${profile.uploadKbps}Kbit/s`;

    if (profile.presetKey === "normal") {
      elements.commandPreview.textContent = [
        "# Mac 全局弱网：清理本机全局弱网规则",
        `sudo pfctl -a ${weaknetCommand.anchor} -F all`,
        "sudo dnctl -q flush",
      ].join("\n");
      return;
    }

    if (profile.disconnectMode === "always") {
      elements.commandPreview.textContent = [
        `# ${profile.displayNameZh}：Mac 全局断网仿真`,
        "# 会影响整台 Mac 的非 lo0 TCP/UDP 流量；localhost/127.0.0.1 不受影响",
        `sudo pfctl -a ${weaknetCommand.anchor} -F all`,
        "sudo dnctl -q flush",
        `{ cat /etc/pf.conf; printf '\\n# weaknet-console\\ndummynet-anchor "${weaknetCommand.anchor}"\\nanchor "${weaknetCommand.anchor}"\\n'; } | sudo pfctl -f -`,
        `printf '%s\\n' 'block drop in quick on ! lo0 proto tcp all' 'block drop in quick on ! lo0 proto udp all' 'block drop out quick on ! lo0 proto tcp all' 'block drop out quick on ! lo0 proto udp all' | sudo pfctl -a ${weaknetCommand.anchor} -f -`,
        "sudo pfctl -F states",
        "sudo pfctl -E",
      ].join("\n");
      return;
    }

    const pipeDown = [
      `sudo dnctl pipe ${weaknetCommand.pipeDown} config`,
      profile.downloadKbps === null || profile.downloadKbps === undefined ? "" : `bw ${down}`,
      oneWayDelay === null ? "" : `delay ${oneWayDelay}ms`,
      `plr ${plr.toFixed(3)}`,
    ]
      .filter(Boolean)
      .join(" ");
    const pipeUp = [
      `sudo dnctl pipe ${weaknetCommand.pipeUp} config`,
      profile.uploadKbps === null || profile.uploadKbps === undefined ? "" : `bw ${up}`,
      oneWayDelay === null ? "" : `delay ${oneWayDelay}ms`,
      `plr ${plr.toFixed(3)}`,
    ]
      .filter(Boolean)
      .join(" ");

    const lines = [
      `# ${profile.displayNameZh}：Mac 全局弱网`,
      "# 来源：弱网工具.app 的全局 dummynet + pf 逻辑，接入到本控制台",
      "# 规则作用于整台 Mac 的非 lo0 TCP/UDP 流量",
      `sudo pfctl -a ${weaknetCommand.anchor} -F all`,
      "sudo dnctl -q flush",
      `{ cat /etc/pf.conf; printf '\\n# weaknet-console\\ndummynet-anchor "${weaknetCommand.anchor}"\\nanchor "${weaknetCommand.anchor}"\\n'; } | sudo pfctl -f -`,
      pipeDown,
      pipeUp,
      `printf '%s\\n' 'dummynet in quick on ! lo0 proto tcp all pipe ${weaknetCommand.pipeDown}' 'dummynet in quick on ! lo0 proto udp all pipe ${weaknetCommand.pipeDown}' 'dummynet out quick on ! lo0 proto tcp all pipe ${weaknetCommand.pipeUp}' 'dummynet out quick on ! lo0 proto udp all pipe ${weaknetCommand.pipeUp}' | sudo pfctl -a ${weaknetCommand.anchor} -f -`,
      "sudo pfctl -F states",
      "sudo pfctl -E",
    ];

    if (profile.jitterMs > 0) {
      lines.push("", `# 抖动=${formatMs(profile.jitterMs)}：Agent 会每 2s 动态重配 pipe`);
    }
    if (profile.disconnectMode === "periodic") {
      lines.push("", `# 断续网络：每 ${profile.disconnectIntervalSec}s 阻断 ${profile.disconnectDurationSec}s`);
    }
    elements.commandPreview.textContent = lines.join("\n");
    return;
  }

  if (isMacUnityMode()) {
    const targetEndpoint = getMacUnityTargetEndpoint() || "<unity_server[:port]>";
    const oneWayDelay = getSingleWayDelay(profile);
    const plr = Math.min(1, Math.max(0, Number(profile.packetLossPercent || 0) / 100));
    const down = profile.downloadKbps === null || profile.downloadKbps === undefined ? "noerror" : `${profile.downloadKbps}Kbit/s`;
    const up = profile.uploadKbps === null || profile.uploadKbps === undefined ? "noerror" : `${profile.uploadKbps}Kbit/s`;

    if (profile.presetKey === "normal") {
      elements.commandPreview.textContent = [
        "# Mac Unity 真实断网仿真：清理 Unity 相关目标弱网规则",
        `sudo pfctl -a ${weaknetCommand.anchor} -F all`,
        "sudo dnctl -q flush",
      ].join("\n");
      return;
    }

    if (profile.disconnectMode === "always") {
      elements.commandPreview.textContent = [
        `# ${profile.displayNameZh}：Mac Unity 真实断网仿真`,
        `# target=${targetEndpoint}`,
        "# 只限制 Unity 业务/CDN/SDK 相关目标，不做整台 Mac 全局断网",
        `sudo pfctl -a ${weaknetCommand.anchor} -F all`,
        "sudo dnctl -q flush",
        `{ cat /etc/pf.conf; printf '\\n# weaknet-console\\ndummynet-anchor "${weaknetCommand.anchor}"\\nanchor "${weaknetCommand.anchor}"\\n'; } | sudo pfctl -f -`,
        `printf '%s\\n' 'block drop quick proto { tcp udp } from any to ${targetEndpoint}' 'block drop quick proto { tcp udp } from ${targetEndpoint} to any' | sudo pfctl -a ${weaknetCommand.anchor} -f -`,
        "# 下发后会清理目标服务器旧 pf state，让 Unity 已建立连接重新命中新规则",
        "sudo pfctl -E",
      ].join("\n");
      return;
    }

    const pipeDown = [
      `sudo dnctl pipe ${weaknetCommand.pipeDown} config`,
      profile.downloadKbps === null || profile.downloadKbps === undefined ? "" : `bw ${down}`,
      oneWayDelay === null ? "" : `delay ${oneWayDelay}ms`,
      `plr ${plr.toFixed(3)}`,
    ]
      .filter(Boolean)
      .join(" ");
    const pipeUp = [
      `sudo dnctl pipe ${weaknetCommand.pipeUp} config`,
      profile.uploadKbps === null || profile.uploadKbps === undefined ? "" : `bw ${up}`,
      oneWayDelay === null ? "" : `delay ${oneWayDelay}ms`,
      `plr ${plr.toFixed(3)}`,
    ]
      .filter(Boolean)
      .join(" ");

    const lines = [
      `# ${profile.displayNameZh}：Mac Unity 真实断网仿真`,
      `# target=${targetEndpoint}`,
      "# 控制台会先把 Unity 相关域名解析成 IPv4，再匹配这些目标地址/端口",
      "# 这不是整台 Mac 全局弱网；它用于尽量复现 Unity 断网/恢复链路",
      `sudo pfctl -a ${weaknetCommand.anchor} -F all`,
      "sudo dnctl -q flush",
      `{ cat /etc/pf.conf; printf '\\n# weaknet-console\\ndummynet-anchor "${weaknetCommand.anchor}"\\nanchor "${weaknetCommand.anchor}"\\n'; } | sudo pfctl -f -`,
      pipeDown,
      pipeUp,
      `printf '%s\\n' 'dummynet out quick proto { tcp udp } from any to ${targetEndpoint} pipe ${weaknetCommand.pipeUp}' 'dummynet in quick proto { tcp udp } from ${targetEndpoint} to any pipe ${weaknetCommand.pipeDown}' | sudo pfctl -a ${weaknetCommand.anchor} -f -`,
      "# 下发后会清理目标服务器的旧 pf state，让 Unity 已建立连接重新命中新规则",
      "# sudo pfctl -k 0.0.0.0/0 -k <resolved_target_ip>",
      "# sudo pfctl -k <resolved_target_ip> -k 0.0.0.0/0",
      "sudo pfctl -E",
    ];

    if (profile.jitterMs > 0) {
      lines.push("", `# 抖动=${formatMs(profile.jitterMs)}：Agent 会每 2s 动态重配 pipe`);
    }
    if (profile.disconnectMode === "periodic") {
      lines.push("", `# 断续网络：每 ${profile.disconnectIntervalSec}s 阻断 ${profile.disconnectDurationSec}s`);
    }
    elements.commandPreview.textContent = lines.join("\n");
    return;
  }

  const oneWayDelay = getSingleWayDelay(profile);
  const plr = Math.min(1, Math.max(0, Number(profile.packetLossPercent || 0) / 100));
  const down = profile.downloadKbps === null || profile.downloadKbps === undefined ? "noerror" : `${profile.downloadKbps}Kbit/s`;
  const up = profile.uploadKbps === null || profile.uploadKbps === undefined ? "noerror" : `${profile.uploadKbps}Kbit/s`;

  if (profile.presetKey === "normal") {
    elements.commandPreview.textContent = [
      "# 正常网络：清理测试机弱网规则",
      `# device_ip=${deviceIp}`,
      `sudo pfctl -a ${weaknetCommand.anchor} -F all`,
      "sudo dnctl -q flush",
    ].join("\n");
    return;
  }

  if (profile.disconnectMode === "always") {
    elements.commandPreview.textContent = [
      `# ${profile.displayNameZh}：阻断测试机全部转发流量`,
      `# device_ip=${deviceIp}`,
      `sudo pfctl -a ${weaknetCommand.anchor} -F all`,
      "sudo dnctl -q flush",
      `{ cat /etc/pf.conf; printf '\\n# weaknet-console\\ndummynet-anchor "${weaknetCommand.anchor}"\\nanchor "${weaknetCommand.anchor}"\\n'; } | sudo pfctl -f -`,
      `printf '%s\\n' 'block drop quick from ${deviceIp} to any' 'block drop quick from any to ${deviceIp}' | sudo pfctl -a ${weaknetCommand.anchor} -f -`,
      "sudo pfctl -E",
    ].join("\n");
    return;
  }

  const pipe1 = [
    `sudo dnctl pipe ${weaknetCommand.pipeDown} config`,
    profile.downloadKbps === null || profile.downloadKbps === undefined ? "" : `bw ${down}`,
    oneWayDelay === null ? "" : `delay ${oneWayDelay}ms`,
    `plr ${plr.toFixed(3)}`,
  ]
    .filter(Boolean)
    .join(" ");
  const pipe2 = [
    `sudo dnctl pipe ${weaknetCommand.pipeUp} config`,
    profile.uploadKbps === null || profile.uploadKbps === undefined ? "" : `bw ${up}`,
    oneWayDelay === null ? "" : `delay ${oneWayDelay}ms`,
    `plr ${plr.toFixed(3)}`,
  ]
    .filter(Boolean)
    .join(" ");

  const lines = [
    `# ${profile.displayNameZh}`,
    `# RTT=${formatMs(profile.latencyRttMs)}，单向延迟≈${formatMs(oneWayDelay)}，丢包=${formatLoss(profile.packetLossPercent)}`,
    `# device_ip=${deviceIp}`,
    `sudo pfctl -a ${weaknetCommand.anchor} -F all`,
    "sudo dnctl -q flush",
    `{ cat /etc/pf.conf; printf '\\n# weaknet-console\\ndummynet-anchor "${weaknetCommand.anchor}"\\nanchor "${weaknetCommand.anchor}"\\n'; } | sudo pfctl -f -`,
    pipe1,
    pipe2,
    `printf '%s\\n' 'dummynet out quick from any to ${deviceIp} pipe ${weaknetCommand.pipeDown}' 'dummynet in quick from ${deviceIp} to any pipe ${weaknetCommand.pipeUp}' | sudo pfctl -a ${weaknetCommand.anchor} -f -`,
    "sudo pfctl -E",
  ];

  if (profile.jitterMs > 0) {
    lines.push(
      "",
      `# 抖动=${formatMs(profile.jitterMs)}：macOS dnctl 无原生 jitter 参数`,
      "# Agent 会每 2s 在延迟范围内动态重配 pipe",
    );
  }

  if (profile.disconnectMode === "periodic") {
    lines.push(
      "",
      `# 断续网络：每 ${profile.disconnectIntervalSec}s 阻断 ${profile.disconnectDurationSec}s`,
      "# Agent 会由后台定时器切换 block / dummynet 规则",
    );
  }

  elements.commandPreview.textContent = lines.join("\n");
}

function renderHistory() {
  if (!state.history.length) {
    elements.historyList.innerHTML = '<p class="history-empty">暂无历史记录</p>';
    return;
  }

  elements.historyList.innerHTML = state.history
    .map(
      (item) => `
        <article class="history-item">
          <div class="history-item-header">
            <strong>${item.displayNameZh}</strong>
            <time>${item.createdAt}</time>
          </div>
          <dl>
            <div>
              <dt>设备</dt>
              <dd>${item.platform} / ${item.deviceIp}</dd>
            </div>
            <div>
              <dt>模式</dt>
              <dd>${item.networkMode || "macOS 网关"}</dd>
            </div>
            <div>
              <dt>RTT</dt>
              <dd>${formatMs(item.latencyRttMs)}</dd>
            </div>
            <div>
              <dt>丢包</dt>
              <dd>${formatLoss(item.packetLossPercent)}</dd>
            </div>
            <div>
              <dt>下行</dt>
              <dd>${formatBandwidth(item.downloadKbps)}</dd>
            </div>
            <div>
              <dt>上行</dt>
              <dd>${formatBandwidth(item.uploadKbps)}</dd>
            </div>
            <div>
              <dt>目标</dt>
              <dd>${item.targetApp}</dd>
            </div>
            <div>
              <dt>FPS</dt>
              <dd>${item.performanceSnapshot ? Math.round(item.performanceSnapshot.fps) : "未记录"}</dd>
            </div>
            <div>
              <dt>CPU</dt>
              <dd>${item.performanceSnapshot ? formatPercent(item.performanceSnapshot.cpu) : "未记录"}</dd>
            </div>
          </dl>
        </article>
      `,
    )
    .join("");
}

function renderAll() {
  renderPresets();
  renderPerformance();
  renderSummary();
  syncEditorFromProfile();
  renderCommandPreview();
  renderGatewayScope();
  renderHistory();
}

function selectPreset(key) {
  state.selectedKey = key;
  state.activeProfile = cloneProfile(findPreset(key));
  renderAll();
}

function setCategory(category) {
  state.category = category;
  document.querySelectorAll(".segment").forEach((button) => {
    button.classList.toggle("active", button.dataset.category === category);
  });

  const selected = findPreset(state.selectedKey);
  if (selected.category !== category) {
    const first = presets.find((preset) => preset.category === category);
    selectPreset(first.presetKey);
    return;
  }

  renderPresets();
}

function pushHistory(record) {
  state.history.unshift(record);
  state.history = state.history.slice(0, 20);
  saveHistory();
  renderHistory();
}

async function applyAndroidVpnProfile(record, profile) {
  elements.runtimeMode.textContent = "Android VPN 下发中";
  elements.deviceNote.textContent = `正在通过 Android VPN Agent 下发 ${record.displayNameZh}...`;
  showToast(`Android VPN：开始下发 ${record.displayNameZh}`, "info");

  const data = await postAgentJson("/api/android-vpn/apply", {
    serial: state.agent.selectedSerial,
    profile,
    targetApp: record.targetApp,
    deviceIp: record.deviceIp,
  });

  record.applyMode = data.mode;
  state.agent.androidVpn = data.status || state.agent.androidVpn;
  elements.runtimeMode.textContent = `${record.displayNameZh} 已下发`;
  elements.deviceNote.textContent = data.message || describeAndroidVpnStatus(data.status);
  showWeaknetStepToasts(data.steps);
  if (data.status) {
    showToast(describeAndroidVpnStatus(data.status), data.ok ? "success" : "info", { duration: 5200 });
  }
  rememberNetworkCurveLimit(profile, data.mode || "android-vpn");
  showToast(data.message || `${record.displayNameZh} 已通过 Android VPN Agent 下发`, "success", { duration: 5200 });
  return data;
}

async function applyProfile() {
  syncProfileFromEditor();
  const profile = state.activeProfile;
  state.networkMode = getNetworkMode();

  if (isLikelyLocalAgent() && isAndroidVpnMode()) {
    elements.runtimeMode.textContent = "准备 Android VPN";
    try {
      await ensureAndroidVpnReady(profile);
    } catch (error) {
      elements.runtimeMode.textContent = "准备失败";
      elements.deviceNote.textContent = error.message;
      showToast(error.message, "error", { duration: 6800 });
      renderSummary();
      renderCommandPreview();
      return;
    }

    const now = new Date();
    const record = {
      ...profile,
      createdAt: now.toLocaleString("zh-CN", { hour12: false }),
      deviceIp: elements.deviceIp.value.trim() || "Android VPN",
      platform: "Android",
      targetApp: elements.targetApp.value.trim() || "未填写",
      networkMode: getNetworkModeLabel(),
      performanceSnapshot: getLatestPerformanceSample(),
    };

    try {
      await applyAndroidVpnProfile(record, profile);
    } catch (error) {
      showWeaknetStepToasts(error.data && error.data.steps);
      if (error.data && error.data.requiresUserAction) {
        elements.runtimeMode.textContent = "等待手机授权";
        elements.deviceNote.textContent = error.data.message || "请在手机上同意 VPN 权限后再次点击应用预设";
        showToast(elements.deviceNote.textContent, "info", { duration: 8200 });
      } else {
        elements.runtimeMode.textContent = "下发失败";
        elements.deviceNote.textContent = `Android VPN 下发失败：${error.message}`;
        showToast(`Android VPN 下发失败：${error.message}`, "error", { duration: 6800 });
      }
      renderSummary();
      renderCommandPreview();
      return;
    }

    pushHistory(record);
    renderSummary();
    renderCommandPreview();
    return;
  }

  if (isLikelyLocalAgent() && isMacLocalMode()) {
    elements.runtimeMode.textContent = isMacGlobalMode() ? "准备 Mac 全局" : "准备 Mac Unity";
    try {
      await refreshAdminStatus();
      assertMacUnityTargetReady(profile);
    } catch (error) {
      elements.runtimeMode.textContent = "准备失败";
      elements.deviceNote.textContent = error.message;
      showToast(error.message, "error", { duration: 6800 });
      renderSummary();
      renderCommandPreview();
      return;
    }
  }

  if (isLikelyLocalAgent() && profile.presetKey !== "normal" && !isMacLocalMode()) {
    elements.runtimeMode.textContent = "准备设备";
    try {
      await ensureWeaknetDeviceReady(profile);
    } catch (error) {
      elements.runtimeMode.textContent = "准备失败";
      elements.deviceNote.textContent = error.message;
      showToast(error.message, "error");
      renderSummary();
      renderCommandPreview();
      return;
    }
  }

  const now = new Date();
  const record = {
    ...profile,
    createdAt: now.toLocaleString("zh-CN", { hour12: false }),
    deviceIp: isMacLocalMode() ? "Mac 本机" : elements.deviceIp.value.trim() || "未填写",
    platform: isMacLocalMode() ? "macOS" : elements.platform.value === "ios" ? "iOS" : "Android",
    targetApp: isMacGlobalMode() ? "整台 Mac 外网流量" : elements.targetApp.value.trim() || "未填写",
    networkMode: getNetworkModeLabel(),
    performanceSnapshot: getLatestPerformanceSample(),
  };

  if (isMacGlobalMode()) {
    elements.runtimeMode.textContent = "检查全局模式";
    showToast("Mac 全局弱网会影响整台 Mac 外网流量", "info", { duration: 6200 });
  } else if (isMacUnityMode()) {
    elements.runtimeMode.textContent = "检查目标";
    showToast(`检查 Unity 目标：${record.targetApp}`, "info");
  } else {
    elements.runtimeMode.textContent = "检查 IP";
    showToast(`检查目标 IP：${record.deviceIp}`, "info");
    try {
      await assertWeaknetTargetIpSafe(record.deviceIp, profile);
      showToast("目标 IP 安全检查通过", "success");
    } catch (error) {
      elements.runtimeMode.textContent = "下发已阻止";
      elements.deviceNote.textContent = error.message;
      showToast(error.message, "error");
      renderSummary();
      renderCommandPreview();
      return;
    }
  }

  try {
    await assertTrafficPathReady(record, profile);
  } catch (error) {
    elements.runtimeMode.textContent = "下发已阻止";
    elements.deviceNote.textContent = error.message;
    showToast(error.message, "error", { duration: 7000 });
    renderSummary();
    renderCommandPreview();
    return;
  }

  if (isLikelyLocalAgent()) {
    elements.runtimeMode.textContent = "正在下发";
    elements.deviceNote.textContent = isMacGlobalMode()
      ? `正在下发 ${record.displayNameZh} 到整台 Mac 外网流量...`
      : isMacUnityMode()
        ? `正在下发 ${record.displayNameZh} 到 Mac Unity 仿真目标 ${record.targetApp}...`
      : `正在下发 ${record.displayNameZh} 到 ${record.deviceIp}...`;
    showToast(`开始下发：${record.displayNameZh}`, "info");
    try {
      const data = await postAgentJson("/api/weaknet/apply", {
        profile,
        targetScope: isMacGlobalMode() ? "mac-global" : isMacUnityMode() ? "mac-unity" : "device",
        targetEndpoint: isMacUnityMode() ? getMacUnityTargetsForRequest() : "",
        deviceIp: record.deviceIp,
        platform: record.platform,
        targetApp: record.targetApp,
      });
      record.applyMode = data.mode;
      rememberNetworkCurveLimit(profile, data.mode || "weaknet");
      elements.runtimeMode.textContent = `${record.displayNameZh} 已下发`;
      elements.deviceNote.textContent = data.message || `${record.displayNameZh} 已下发到 ${record.deviceIp}`;
      showWeaknetStepToasts(data.steps);
      showToast(data.message || `${record.displayNameZh} 已下发`, "success", { duration: 4600 });
    } catch (error) {
      elements.runtimeMode.textContent = "下发失败";
      elements.deviceNote.textContent = `弱网下发失败：${error.message}`;
      showWeaknetStepToasts(error.data && error.data.steps);
      showToast(`弱网下发失败：${error.message}`, "error", { duration: 6200 });
      renderSummary();
      renderCommandPreview();
      return;
    }
  } else {
    rememberNetworkCurveLimit(profile, "simulated");
    elements.runtimeMode.textContent = `${record.displayNameZh} 已应用`;
    showToast(`${record.displayNameZh} 已应用到模拟模式`, "success");
  }

  pushHistory(record);
  renderSummary();
  renderCommandPreview();
}

async function clearWeakNet() {
  selectPreset("normal");
  if (!isLikelyLocalAgent()) {
    rememberNetworkCurveLimit(null, "normal");
    elements.runtimeMode.textContent = "模拟模式";
    renderGatewayScope();
    showToast("已恢复模拟模式正常网络", "success");
    return;
  }

  state.networkMode = getNetworkMode();
  if (isAndroidVpnMode()) {
    try {
      const device = await ensureAndroidDeviceSelected();
      elements.runtimeMode.textContent = "清除 Android VPN";
      showToast("开始清除 Android VPN 弱网", "info");
      const data = await postAgentJson("/api/android-vpn/clear", { serial: device.serial });
      state.agent.androidVpn = data.status || state.agent.androidVpn;
      elements.runtimeMode.textContent = "正常网络";
      elements.deviceNote.textContent = data.message || describeAndroidVpnStatus(data.status);
      showWeaknetStepToasts(data.steps);
      rememberNetworkCurveLimit(null, "normal");
      renderGatewayScope();
      showToast(data.message || "Android VPN 弱网已清除", "success");
      await refreshAndroidVpnStatus(false);
    } catch (error) {
      elements.runtimeMode.textContent = "清除失败";
      elements.deviceNote.textContent = `Android VPN 清除失败：${error.message}`;
      showWeaknetStepToasts(error.data && error.data.steps);
      showToast(`Android VPN 清除失败：${error.message}`, "error", { duration: 6200 });
    }
    return;
  }

  elements.runtimeMode.textContent = "正在清除";
  showToast("开始清除弱网规则", "info");
  try {
    const data = await postAgentJson("/api/weaknet/clear", {});
    elements.runtimeMode.textContent = "正常网络";
    elements.deviceNote.textContent = data.message || "弱网规则已清理";
    showWeaknetStepToasts(data.steps);
    rememberNetworkCurveLimit(null, "normal");
    renderGatewayScope();
    showToast(data.message || "弱网规则已清理", "success");
  } catch (error) {
    elements.runtimeMode.textContent = "清除失败";
    elements.deviceNote.textContent = `清除弱网失败：${error.message}`;
    showWeaknetStepToasts(error.data && error.data.steps);
    showToast(`清除弱网失败：${error.message}`, "error", { duration: 6200 });
  }
}

function clearHistory() {
  state.history = [];
  saveHistory();
  renderHistory();
}

function bindEvents() {
  elements.presetGrid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-preset-key]");
    if (!card) return;
    selectPreset(card.dataset.presetKey);
  });

  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => setCategory(button.dataset.category));
  });

  elements.advancedToggle.addEventListener("change", () => {
    elements.advancedEditor.classList.toggle("visible", elements.advancedToggle.checked);
    syncEditorFromProfile();
  });

  editorFields.forEach((field) => {
    document.getElementById(field).addEventListener("input", () => {
      syncProfileFromEditor();
      renderSummary();
      renderCommandPreview();
    });
  });

  [elements.deviceIp, elements.platform, elements.targetApp, elements.networkMode].forEach((input) => {
    input.addEventListener("input", () => {
      renderCommandPreview();
      if (input === elements.targetApp) renderGatewayScope();
    });
    input.addEventListener("change", () => {
      renderCommandPreview();
      if (input === elements.targetApp) renderGatewayScope();
    });
  });

  elements.networkMode.addEventListener("change", async () => {
    state.networkMode = getNetworkMode();
    updateNetworkModeUi();
    if (isMacUnityMode()) {
      await loadMacUnityBuiltinTargets(true);
    }
    renderSummary();
    renderCommandPreview();
    showToast(`模式切换为：${getNetworkModeLabel()}`, "info");
    if (isAndroidVpnMode()) {
      await refreshAndroidVpnStatus(false);
    } else {
      await refreshAdminStatus();
    }
  });

  if (elements.modeTrigger && elements.modeList) {
    elements.modeTrigger.addEventListener("click", (event) => {
      if (event.target.closest(".mode-tip")) return;
      toggleModeList();
    });
    elements.modeTrigger.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setModeListOpen(false);
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleModeList();
    });
    elements.modeList.addEventListener("click", (event) => {
      if (event.target.closest(".mode-tip")) return;
      const option = event.target.closest("[data-mode]");
      if (!option) return;
      setNetworkMode(option.dataset.mode);
      setModeListOpen(false);
    });
    elements.modeList.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setModeListOpen(false);
        elements.modeTrigger.focus();
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") return;
      const option = event.target.closest("[data-mode]");
      if (!option) return;
      event.preventDefault();
      setNetworkMode(option.dataset.mode);
      setModeListOpen(false);
      elements.modeTrigger.focus();
    });
    document.addEventListener("click", (event) => {
      if (!elements.modeSelect.contains(event.target)) {
        setModeListOpen(false);
      }
    });
  }

  elements.deviceSerial.addEventListener("change", () => {
    state.agent.selectedSerial = elements.deviceSerial.value;
    applySelectedDeviceToForm();
    if (isAndroidVpnMode()) refreshAndroidVpnStatus(false);
  });

  elements.refreshDevicesButton.addEventListener("click", refreshDevices);
  if (elements.launcherStartButton) elements.launcherStartButton.addEventListener("click", startLauncherAgent);
  if (elements.launcherRetryButton) elements.launcherRetryButton.addEventListener("click", refreshLauncherGate);
  elements.foregroundButton.addEventListener("click", readForegroundApp);
  elements.installVpnButton.addEventListener("click", installAndroidVpnAgentFromUi);
  elements.authorizeVpnButton.addEventListener("click", authorizeAndroidVpnFromUi);
  elements.networkCurveTab.addEventListener("click", () => setMonitorTab("network"));
  elements.performanceTab.addEventListener("click", () => setMonitorTab("performance"));
  elements.applyButton.addEventListener("click", applyProfile);
  elements.clearButton.addEventListener("click", clearWeakNet);
  elements.resetButton.addEventListener("click", clearWeakNet);
  elements.startMonitorButton.addEventListener("click", startMonitoring);
  elements.stopMonitorButton.addEventListener("click", stopMonitoring);
  elements.clearHistoryButton.addEventListener("click", clearHistory);
  elements.copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(elements.commandPreview.textContent);
    elements.copyButton.textContent = "已复制";
    setTimeout(() => {
      elements.copyButton.textContent = "复制";
    }, 1200);
  });

  elements.gatewayToggleButton.addEventListener("click", () => {
    state.gateway.expanded = !state.gateway.expanded;
    renderGatewayScope();
  });
  elements.gatewayChipRow.addEventListener("click", (event) => {
    if (event.target.closest("[data-gateway-view-all]")) {
      setGatewayDialogOpen(true);
    }
  });
  elements.gatewayMoreButton.addEventListener("click", () => setGatewayDialogOpen(true));
  elements.gatewayViewAllButton.addEventListener("click", () => setGatewayDialogOpen(true));
  elements.gatewayCopyButton.addEventListener("click", () => copyGatewayTargets());
  elements.gatewayDialogCloseButton.addEventListener("click", () => setGatewayDialogOpen(false));
  elements.gatewayDialog.addEventListener("click", (event) => {
    if (event.target === elements.gatewayDialog) setGatewayDialogOpen(false);
  });
  elements.gatewaySearchInput.addEventListener("input", () => {
    state.gateway.filter = elements.gatewaySearchInput.value;
    renderGatewayTable();
  });
  elements.gatewayCopyAllButton.addEventListener("click", () => copyGatewayTargets("全部受限网关已复制"));
  elements.gatewayExportButton.addEventListener("click", exportGatewayTargets);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.gatewayDialog && !elements.gatewayDialog.hidden) {
      setGatewayDialogOpen(false);
    }
  });

  window.addEventListener("resize", () => {
    drawNetworkCurveChart();
    drawPerformanceChart();
  });
}

async function initApp() {
  seedPerformanceSamples();
  bindEvents();
  setMonitorTab("network");
  updateNetworkModeUi();
  renderAll();
  if (await refreshLauncherGate()) return;
  startNetworkCurve();
  refreshDevices();
}

initApp();
