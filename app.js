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
    presetKey: "edge",
    displayNameZh: "EDGE 网络",
    category: "common",
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
    scene: "高频丢包场景",
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
const LAUNCHER_FETCH_TIMEOUT_MS = 12000;

const THEME_STORAGE_KEY = "weaknet-theme";
const THEMES = [
  { key: "terminal-aurora", label: "冷色终端", toastLabel: "冷色终端" },
  { key: "cyber", label: "矩阵终端", toastLabel: "矩阵终端" },
  { key: "classic", label: "经典浅色", toastLabel: "经典浅色" },
];
const DEFAULT_THEME = "terminal-aurora";
const THEME_KEYS = new Set(THEMES.map((theme) => theme.key));
const SERVICE_STOPPED_MESSAGE = "弱网服务已停止，请点击重启服务，或重新打开弱网控制台启动脚本重新启动服务。";
const SERVICE_UNAVAILABLE_EFFECT_MESSAGE = "Agent 已停止，无法采集或施加弱网。";
const NETWORK_WAVE_MODE = {
  key: "subway-elevator",
  displayNameZh: "网络波动模式",
  scene: "地铁/电梯随机波动",
  description: "模拟地铁/电梯场景，网速随机跳跃",
  rangeLabel: "下行 50K~3M · 上行 20K~1M · 延迟 30~800mS",
  chips: ["波动中", "地铁/电梯", "下行 50K~3M", "上行 20K~1M", "延迟 30~800mS"],
};

const state = {
  category: "common",
  selectedKey: "normal",
  networkMode: "mac-global",
  monitorTab: "network",
  theme: loadTheme(),
  activeProfile: cloneProfile(presets[0]),
  history: loadHistory(),
  agent: {
    available: false,
    admin: null,
    devices: [],
    selectedSerial: "",
    metricsSource: "none",
    androidVpn: null,
    macUnityTargets: [],
    platform: "",
    weaknetBackend: "",
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
  networkWave: {
    enabled: false,
  },
  currentEffect: {
    tone: "info",
    title: "正常网络",
    meta: "未施加弱网",
    profile: null,
    modeLabel: "未启用",
    target: "未选择目标",
  },
  operation: {
    tone: "info",
    title: "等待操作",
    message: "应用预设或清除弱网后展示结果。",
    steps: [],
  },
  gateway: {
    expanded: false,
    filter: "",
  },
  launcher: {
    status: null,
    starting: false,
    autoStartHandled: false,
  },
  serviceStopped: false,
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
  deviceModeSummary: document.getElementById("deviceModeSummary"),
  currentEffectStrip: document.getElementById("currentEffectStrip"),
  currentEffectLabel: document.getElementById("currentEffectLabel"),
  currentEffectTitle: document.getElementById("currentEffectTitle"),
  currentEffectMeta: document.getElementById("currentEffectMeta"),
  currentEffectChips: document.getElementById("currentEffectChips"),
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
  networkWaveRow: document.getElementById("networkWaveRow"),
  networkWaveToggle: document.getElementById("networkWaveToggle"),
  networkWaveState: document.getElementById("networkWaveState"),
  metricsGrid: document.getElementById("metricsGrid"),
  advancedToggle: document.getElementById("advancedToggle"),
  advancedEditor: document.getElementById("advancedEditor"),
  commandPreview: document.getElementById("commandPreview"),
  historyList: document.getElementById("historyList"),
  applyButton: document.getElementById("applyButton"),
  clearButton: document.getElementById("clearButton"),
  resetButton: document.getElementById("resetButton"),
  stopServiceButton: document.getElementById("stopServiceButton"),
  clearHistoryButton: document.getElementById("clearHistoryButton"),
  themePrevButton: document.getElementById("themePrevButton"),
  themeLockButton: document.getElementById("themeLockButton"),
  themeNextButton: document.getElementById("themeNextButton"),
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
  modeCardList: document.getElementById("modeCardList"),
  runtimeMode: document.getElementById("runtimeMode"),
  topCurrentSummary: document.getElementById("topCurrentSummary"),
  bottomActionMode: document.getElementById("bottomActionMode"),
  bottomActionTarget: document.getElementById("bottomActionTarget"),
  commandEyebrow: document.getElementById("commandEyebrow"),
  operationCard: document.getElementById("operationCard"),
  operationToneDot: document.getElementById("operationToneDot"),
  operationTitle: document.getElementById("operationTitle"),
  operationMessage: document.getElementById("operationMessage"),
  operationSteps: document.getElementById("operationSteps"),
  operationLog: document.getElementById("operationLog"),
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

function loadTheme() {
  let savedTheme = "";
  try {
    savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    savedTheme = "";
  }

  if (THEME_KEYS.has(savedTheme)) {
    saveThemeCookie(savedTheme);
    return savedTheme;
  }

  const cookieTheme = loadThemeCookie();
  if (cookieTheme) {
    saveThemeToLocalStorage(cookieTheme);
    return cookieTheme;
  }

  return DEFAULT_THEME;
}

function loadThemeCookie() {
  try {
    const cookie = document.cookie
      .split("; ")
      .find((item) => item.startsWith(`${THEME_STORAGE_KEY}=`));
    const value = cookie ? decodeURIComponent(cookie.slice(THEME_STORAGE_KEY.length + 1)) : "";
    return THEME_KEYS.has(value) ? value : "";
  } catch {
    return "";
  }
}

function saveThemeToLocalStorage(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Theme persistence is a convenience; the console should still run without storage.
  }
}

function saveThemeCookie(theme) {
  try {
    document.cookie = `${THEME_STORAGE_KEY}=${encodeURIComponent(theme)}; Max-Age=31536000; Path=/; SameSite=Lax`;
  } catch {
    // Cookie persistence lets the launcher page share the theme across local ports.
  }
}

function saveTheme(theme) {
  saveThemeToLocalStorage(theme);
  saveThemeCookie(theme);
  saveThemeToServer(theme);
}

async function loadThemeFromServer() {
  try {
    const response = await fetch("/api/theme", { cache: "no-store" });
    if (!response.ok) return "";
    const data = await response.json();
    return THEME_KEYS.has(data.theme) ? data.theme : "";
  } catch {
    return "";
  }
}

function saveThemeToServer(theme) {
  if (!THEME_KEYS.has(theme)) return;
  try {
    fetch("/api/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // The browser-level fallback above is still enough for static/local previews.
  }
}

async function hydrateThemePreference() {
  const serverTheme = await loadThemeFromServer();
  if (!serverTheme) return;
  state.theme = serverTheme;
  saveThemeToLocalStorage(serverTheme);
  saveThemeCookie(serverTheme);
}

function getThemeMeta(theme) {
  return THEMES.find((item) => item.key === theme) || THEMES[0];
}

function getThemeIndex(theme) {
  const index = THEMES.findIndex((item) => item.key === theme);
  return index >= 0 ? index : 0;
}

function setTheme(theme, options = {}) {
  const nextTheme = THEME_KEYS.has(theme) ? theme : DEFAULT_THEME;
  const themeMeta = getThemeMeta(nextTheme);
  state.theme = nextTheme;
  document.body.classList.toggle("theme-cyber", nextTheme === "cyber" || nextTheme === "terminal-aurora");
  document.body.classList.toggle("theme-terminal-aurora", nextTheme === "terminal-aurora");
  document.body.classList.toggle("theme-classic", nextTheme === "classic");

  if (elements.themeLockButton) {
    elements.themeLockButton.textContent = themeMeta.label;
    elements.themeLockButton.dataset.theme = nextTheme;
    elements.themeLockButton.setAttribute("aria-label", `锁定当前样式为默认：${themeMeta.label}`);
    elements.themeLockButton.title = `锁定当前样式为默认：${themeMeta.label}`;
  }

  if (options.persist) saveTheme(nextTheme);
  drawNetworkCurveChart();
  drawPerformanceChart();
  if (options.toast) {
    const prefix = options.persist ? "已锁定默认样式" : "预览样式";
    showToast(`${prefix}：${themeMeta.toastLabel}`, "info", { duration: 2400 });
  }
}

function cycleTheme(direction) {
  const nextIndex = (getThemeIndex(state.theme) + direction + THEMES.length) % THEMES.length;
  setTheme(THEMES[nextIndex].key, { toast: true });
}

function lockCurrentTheme() {
  setTheme(state.theme, { persist: true, toast: true });
}

function isLikelyLocalAgent() {
  return location.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
}

function isWindowsAgent() {
  return state.agent.platform === "win32";
}

function getHostLabel() {
  return isWindowsAgent() ? "Windows" : "Mac";
}

function getGatewayHostLabel() {
  return isWindowsAgent() ? "Windows" : "macOS";
}

function requireLocalAgent() {
  if (isLikelyLocalAgent()) return true;
  const message = "请通过本地 Agent 页面执行真实弱网操作：运行对应启动脚本后访问 http://localhost:8123。";
  elements.runtimeMode.textContent = "Agent 未连接";
  elements.deviceNote.textContent = message;
  showToast(message, "error", { duration: 7600 });
  return false;
}

function isLauncherPage() {
  return isLikelyLocalAgent() && location.port === launcherConfig.port;
}

function getAgentUrl(path = "/") {
  const host = location.hostname || "127.0.0.1";
  return `${location.protocol}//${host}:${launcherConfig.agentPort}${path}`;
}

function getLauncherUrl(path = "/") {
  const host = location.hostname || "127.0.0.1";
  return `${location.protocol}//${host}:${launcherConfig.port}${path}`;
}

function getLauncherAction() {
  try {
    return new URLSearchParams(location.search).get("action") || "";
  } catch {
    return "";
  }
}

function isAgentConnectionFailure(error) {
  return /failed to fetch|load failed|networkerror|network request failed/i.test(String((error && error.message) || error || ""));
}

function createServiceStoppedError(error) {
  const stoppedError = new Error(SERVICE_STOPPED_MESSAGE);
  stoppedError.serviceStopped = true;
  stoppedError.cause = error;
  return stoppedError;
}

function isServiceStoppedError(error) {
  const raw = String((error && (error.message || error.error)) || error || "");
  return Boolean(error && error.serviceStopped) || raw.includes(SERVICE_STOPPED_MESSAGE) || isAgentConnectionFailure(raw);
}

function showServiceStoppedNotice() {
  state.serviceStopped = true;
  state.agent.available = false;
  state.agent.admin = null;
  state.agent.metricsSource = "none";
  elements.runtimeMode.textContent = "服务已停止";
  elements.deviceNote.textContent = SERVICE_STOPPED_MESSAGE;
  setServiceUnavailableEffect();
  updateOperationFromSteps({
    tone: "warn",
    title: "服务连接中断",
    message: "请重启服务后再操作。",
    steps: [],
  });
  renderServiceActionButton();
  renderPerformanceStatus();
  renderGatewayScope();
  showToast(SERVICE_STOPPED_MESSAGE, "info", { duration: 7000 });
}

function requireServiceRunning() {
  if (!state.serviceStopped) return true;
  showServiceStoppedNotice();
  return false;
}

async function refreshAgentHealth() {
  if (!isLikelyLocalAgent()) return null;
  try {
    const health = await fetchAgentJson("/api/health");
    state.agent.platform = health.platform || state.agent.platform || "";
    state.agent.weaknetBackend = health.weaknetBackend || state.agent.weaknetBackend || "";
    return health;
  } catch {
    return null;
  }
}

function handleServiceStoppedError(error) {
  if (!isServiceStoppedError(error)) return false;
  showServiceStoppedNotice();
  return true;
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

function renderServiceActionButton() {
  if (!elements.stopServiceButton) return;
  elements.stopServiceButton.textContent = state.serviceStopped ? "重启服务" : "停止服务";
  elements.stopServiceButton.classList.toggle("restart", state.serviceStopped);
  elements.stopServiceButton.disabled = false;
}

async function fetchLauncherJson(path, options = {}) {
  let response;
  try {
    response = await fetch(getLauncherUrl(path), {
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
  const launcherPlatform =
    status.platform ||
    (status.agent && status.agent.health && status.agent.health.platform) ||
    (status.agent && status.agent.admin && status.agent.admin.platform) ||
    "";
  if (launcherPlatform) state.agent.platform = launcherPlatform;
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
      "为实现真实弱网环境，本工具需要临时调整本机网络规则，用于实现延迟、丢包、限速和断网等效果。点击继续后，macOS 将弹出系统授权框。";
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
    if (isWindowsAgent() && elements.launcherMessage && !(status.agent && status.agent.ready)) {
      elements.launcherMessage.textContent =
        "为实现真实弱网环境，本工具需要临时启动管理员权限的本机弱网服务。点击授权后，Windows 会弹出管理员权限确认框。";
    }
    if (status.agent && status.agent.ready) {
      setTimeout(() => redirectToAgent(status), 450);
      return true;
    }
    if (getLauncherAction() === "restart" && !state.launcher.autoStartHandled && !state.launcher.starting) {
      state.launcher.autoStartHandled = true;
      setTimeout(() => startLauncherAgent(), 250);
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
  if (elements.launcherMessage && isWindowsAgent()) {
    elements.launcherMessage.textContent = "等待 Windows 管理员权限确认框，请点击“是”。";
  }
  try {
    const startRequest = fetchLauncherJson("/api/launcher/start", { method: "POST" });
    if (isWindowsAgent()) {
      startRequest.catch(() => null);
      const status = await waitForLauncherAgentReady();
      setTimeout(() => redirectToAgent(status), 450);
      return;
    }
    const result = await startRequest;
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
    if (isAgentConnectionFailure(error)) throw createServiceStoppedError(error);
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
    state.agent.platform = status.platform || state.agent.platform || "";
    if (status.ok && status.mode === "windows-admin") {
      elements.runtimeMode.textContent = "Windows 管理员模式";
    } else if (status.ok && status.mode === "root") {
      elements.runtimeMode.textContent = "管理员模式";
    } else if (status.ok) {
      elements.runtimeMode.textContent = "sudo 已授权";
    } else if (status.mode === "windows-missing") {
      elements.runtimeMode.textContent = "需要管理员权限";
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
  if (isWindowsAgent()) return null;
  if (!state.agent.selectedSerial) {
    throw new Error("缺少 Android 设备序列号，无法检查流量路径");
  }

  const params = new URLSearchParams({
    serial: state.agent.selectedSerial,
    ip: record.deviceIp,
  });
  const data = await fetchAgentJson(`/api/network/path?${params.toString()}`);
  if (!data.throughMac) {
    const detail = data.autoPrepareReason ? `；${data.autoPrepareReason}` : "";
    throw new Error(`Android 流量未经过 Mac：${data.reason}${detail}`);
  }
  return data;
}

async function postAgentJson(path, payload) {
  let response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
  } catch (error) {
    if (isAgentConnectionFailure(error)) throw createServiceStoppedError(error);
    throw error;
  }
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
  if (isMacGlobalMode()) return `${getHostLabel()} 全局弱网`;
  if (isMacUnityMode()) return isWindowsAgent() ? "Windows 目标弱网" : "Mac Unity 真实断网仿真";
  return `${getGatewayHostLabel()} 网关`;
}

function getActionTargetLabel() {
  if (isMacGlobalMode()) return `整台 ${getHostLabel()} 外网流量`;
  if (isMacUnityMode()) return elements.targetApp.value.trim() || (isWindowsAgent() ? "目标 IP / 端口" : "Unity / CDN / SDK 目标");
  if (isAndroidVpnMode()) return elements.targetApp.value.trim() || "未填写目标包名";
  return elements.deviceIp.value.trim() || "未填写设备 IP";
}

function renderConsoleSummaries() {
  const profile = getProfileForApply();
  const profileName = profile.presetKey === "normal" ? "正常网络" : profile.displayNameZh;
  const summary = `${getNetworkModeLabel()} / ${profileName}`;
  if (elements.topCurrentSummary) elements.topCurrentSummary.textContent = summary;
  if (elements.bottomActionMode) elements.bottomActionMode.textContent = summary;
  if (elements.bottomActionTarget) elements.bottomActionTarget.textContent = getActionTargetLabel();
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

function getStepStats(steps = []) {
  const total = Array.isArray(steps) ? steps.length : 0;
  const passed = total ? steps.filter((step) => step && step.ok).length : 0;
  return { total, passed };
}

function formatStepDetail(step) {
  if (!step) return "";
  if (step.ok) return "成功";
  return step.error || step.stderr || step.stdout || "失败";
}

function summarizeOperation(prefix, steps = []) {
  const { total, passed } = getStepStats(steps);
  if (!total) return prefix;
  return `${prefix} · ${passed}/${total} 成功`;
}

function getReadableError(error) {
  const raw = String((error && (error.message || error.error)) || error || "操作失败");
  if (isServiceStoppedError(error)) return SERVICE_STOPPED_MESSAGE;
  if (/VPN permission|VPN 授权|needs_permission/i.test(raw)) return "手机还没有同意 VPN 授权，请在手机弹窗中点允许。";
  if (/missing Android device serial|未发现已授权|缺少 Android 设备序列号/i.test(raw)) return "没有可用 Android 设备，请先刷新设备并确认 USB 调试授权。";
  if (/invalid targetPackage|有效的目标应用包名|package/i.test(raw)) return "目标包名不正确，请先打开游戏并点击读取前台应用。";
  if (/管理员权限|sudo|password is required|a terminal is required/i.test(raw)) return "需要管理员授权，请从启动页重新授权弱网服务。";
  if (/Android 流量未经过 Mac/i.test(raw)) return raw;
  if (/危险 IP 防护/i.test(raw)) return raw;
  return raw;
}

function formatEffectSummary(profile) {
  if (!profile || profile.presetKey === "normal") return "未施加弱网";
  if (isNetworkWaveProfile(profile)) return NETWORK_WAVE_MODE.rangeLabel;
  return [
    `RTT ${formatMs(profile.latencyRttMs)}`,
    `丢包 ${formatLoss(profile.packetLossPercent)}`,
    `下行 ${formatBandwidth(profile.downloadKbps)}`,
    `上行 ${formatBandwidth(profile.uploadKbps)}`,
  ].join(" · ");
}

function getRecordTarget(record = {}) {
  if (record.networkMode === "Mac 全局弱网") return "整台 Mac 外网流量";
  if (record.networkMode === "Windows 全局弱网") return "整台 Windows 外网流量";

  const targetApp = String(record.targetApp || "").trim();
  if (targetApp && targetApp !== "未填写") {
    const rows = splitTargetList(targetApp).map(parseGatewayTarget);
    const hosts = new Set(rows.map((row) => row.host).filter(Boolean));
    const ports = new Set(rows.map((row) => row.port).filter(Boolean));
    if (rows.length > 1) return `${hosts.size} 个 host / ${ports.size} 个 port`;
    return targetApp;
  }

  if (record.deviceIp && record.deviceIp !== "未填写") return record.deviceIp;
  return "未选择目标";
}

function isNetworkWaveEnabled() {
  return Boolean(elements.networkWaveToggle && elements.networkWaveToggle.checked);
}

function isNetworkWaveProfile(profile = {}) {
  return Boolean(profile.networkWave && profile.networkWave.enabled);
}

function renderNetworkWaveControl() {
  state.networkWave.enabled = isNetworkWaveEnabled();
  if (elements.networkWaveRow) {
    elements.networkWaveRow.classList.toggle("active", state.networkWave.enabled);
  }
  if (elements.networkWaveState) {
    elements.networkWaveState.textContent = state.networkWave.enabled ? "已开启" : "已关闭";
  }
}

function setNetworkWaveEnabled(enabled) {
  if (elements.networkWaveToggle) {
    elements.networkWaveToggle.checked = Boolean(enabled);
  }
  renderNetworkWaveControl();
}

function disableNetworkWaveAfterClear() {
  setNetworkWaveEnabled(false);
  renderSummary();
  renderCommandPreview();
}

function getProfileForApply() {
  const profile = cloneProfile(state.activeProfile);
  if (!isNetworkWaveEnabled()) {
    profile.networkWave = { enabled: false, mode: NETWORK_WAVE_MODE.key };
    return profile;
  }

  return {
    ...profile,
    presetKey: profile.presetKey === "normal" ? "network_wave" : profile.presetKey,
    displayNameZh: profile.presetKey === "normal" ? NETWORK_WAVE_MODE.displayNameZh : `${profile.displayNameZh} + 网络波动`,
    scene: profile.presetKey === "normal" ? NETWORK_WAVE_MODE.scene : `${profile.scene} · ${NETWORK_WAVE_MODE.scene}`,
    latencyRttMs: 100,
    jitterMs: 0,
    packetLossPercent: 2,
    downloadKbps: 500,
    uploadKbps: 200,
    disconnectMode: "none",
    disconnectDurationSec: 0,
    disconnectIntervalSec: 0,
    networkWave: {
      enabled: true,
      mode: NETWORK_WAVE_MODE.key,
    },
  };
}

function setCurrentEffect(effect = {}) {
  const nextEffect = {
    ...state.currentEffect,
    ...effect,
  };
  if (!Object.prototype.hasOwnProperty.call(effect, "chips")) delete nextEffect.chips;
  state.currentEffect = nextEffect;
  renderCurrentEffect();
}

function setServiceUnavailableEffect() {
  setCurrentEffect({
    tone: "warn",
    title: "服务不可用",
    meta: SERVICE_UNAVAILABLE_EFFECT_MESSAGE,
    profile: null,
    modeLabel: getNetworkModeLabel(),
    target: "本机服务",
    chips: ["未采集"],
  });
}

function getApplyOperationStartTitle(profile) {
  return profile && profile.presetKey === "normal" ? "正在恢复正常网络" : "正在应用预设";
}

function getApplyOperationStartMessage(profile) {
  return profile && profile.presetKey === "normal" ? "正在清理弱网规则。" : "正在检查权限并写入弱网规则。";
}

function getApplyOperationDoneTitle(profile) {
  return profile && profile.presetKey === "normal" ? "清除完成" : "应用完成";
}

function getApplyOperationDoneMessage(profile) {
  return profile && profile.presetKey === "normal" ? "规则已清理，当前效果已更新。" : "规则已写入，当前效果已更新。";
}

function setCurrentEffectFromRecord(record, profile, tone = "ok") {
  const modeLabel = record.networkMode || getNetworkModeLabel();
  const targetLabel = getRecordTarget(record);
  const isGlobalRecord = modeLabel === "Mac 全局弱网" || modeLabel === "Windows 全局弱网";
  const targetMeta = isGlobalRecord ? targetLabel : `${modeLabel} · ${targetLabel}`;

  if (isNetworkWaveProfile(profile)) {
    setCurrentEffect({
      tone,
      title: "网络波动 已生效",
      meta: `${modeLabel} · ${NETWORK_WAVE_MODE.scene}`,
      profile: { ...profile },
      modeLabel,
      target: targetLabel,
      chips: NETWORK_WAVE_MODE.chips,
    });
    return;
  }
  if (!profile || profile.presetKey === "normal") {
    setCurrentEffect({
      tone: "ok",
      title: "正常网络",
      meta: "未施加弱网",
      profile: null,
      modeLabel,
      target: targetLabel,
    });
    return;
  }
  setCurrentEffect({
    tone,
    title: `${profile.displayNameZh} 已生效`,
    meta: targetMeta,
    profile: { ...profile },
    modeLabel,
    target: targetLabel,
  });
}

function renderCurrentEffect() {
  const effect = state.currentEffect;
  const toneClasses = ["status-ok", "status-warn", "status-error", "status-info"];
  if (elements.currentEffectStrip) {
    elements.currentEffectStrip.classList.remove(...toneClasses);
    elements.currentEffectStrip.classList.add(`status-${effect.tone || "info"}`);
  }
  if (elements.currentEffectLabel) elements.currentEffectLabel.textContent = "当前效果";
  if (elements.currentEffectTitle) elements.currentEffectTitle.textContent = effect.title;
  if (elements.currentEffectMeta) elements.currentEffectMeta.textContent = effect.meta;
  if (elements.currentEffectChips) {
    const profile = effect.profile;
    let chips = Array.isArray(effect.chips) && effect.chips.length ? effect.chips : null;
    if (!chips) {
      chips = profile
        ? [
            `RTT ${formatMs(profile.latencyRttMs)}`,
            `丢包 ${formatLoss(profile.packetLossPercent)}`,
            `下行 ${formatBandwidth(profile.downloadKbps)}`,
            `上行 ${formatBandwidth(profile.uploadKbps)}`,
          ]
        : ["未施加弱网"];
    }
    elements.currentEffectChips.innerHTML = chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("");
  }
  renderDeviceModeSummary();
}

function setOperationStatus(update = {}) {
  state.operation = {
    ...state.operation,
    ...update,
    steps: Array.isArray(update.steps) ? update.steps : state.operation.steps,
  };
  renderOperationStatus();
}

function renderOperationStatus() {
  const operation = state.operation;
  const tone = operation.tone || "info";
  const toneClasses = ["status-ok", "status-warn", "status-error", "status-info"];
  if (elements.operationCard) {
    elements.operationCard.classList.remove(...toneClasses);
    elements.operationCard.classList.add(`status-${tone}`);
  }
  if (elements.operationTitle) elements.operationTitle.textContent = operation.title;
  if (elements.operationMessage) elements.operationMessage.textContent = operation.message;
  const steps = operation.steps || [];
  if (elements.operationSteps) {
    elements.operationSteps.hidden = false;
    if (steps.length) {
      elements.operationSteps.innerHTML = steps
        .map(
          (step) => `
            <div class="operation-step ${step.ok ? "ok" : "error"}">
              <span>${escapeHtml(step.label || "操作步骤")}</span>
              <strong>${escapeHtml(formatStepDetail(step))}</strong>
            </div>
          `,
        )
        .join("");
    } else {
      elements.operationSteps.innerHTML = '<p class="operation-empty">暂无技术步骤。</p>';
    }
  }
}

function updateOperationFromSteps({ tone, title, message, steps }) {
  setOperationStatus({
    tone,
    title: summarizeOperation(title, steps),
    message,
    steps: steps || [],
  });
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
  return `${isWindowsAgent() ? "Windows Target" : "Mac Unity"} · ${hosts.size} hosts · ${ports.size} ports`;
}

function getGatewayStateMeta(rows = getMacUnityGatewayRows()) {
  if (!rows.length) {
    return { label: "未配置", className: "empty" };
  }
  const currentMode = getNetworkModeLabel();
  const effect = state.currentEffect || {};
  const active = Boolean(
    (state.networkCurve.limitProfile && state.networkCurve.limitMode !== "normal") ||
      (effect.profile && effect.modeLabel === currentMode),
  );
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
  const shouldShow = isMacUnityMode() && !isWindowsAgent();
  setHidden(elements.gatewayScope, !shouldShow);
  if (!shouldShow) return;

  const rows = getMacUnityGatewayRows();
  const summary = getGatewaySummary(rows);
  const stateMeta = getGatewayStateMeta(rows);
  const collapsedRows = rows.slice(0, 3);
  const expandedRows = rows.slice(0, 5);

  if (elements.gatewayScopeTitle) {
    elements.gatewayScopeTitle.textContent = isWindowsAgent() ? "受限目标" : "受限网关";
  }
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

function getModeUiMeta(mode) {
  const host = getHostLabel();
  const gatewayHost = getGatewayHostLabel();
  const windows = isWindowsAgent();
  const map = {
    "android-vpn": {
      icon: "AD",
      name: "Android VPN Agent",
      title: "Android VPN",
      description: "通过 ADB + SOCKS，对目标包名生效",
      tip:
        `底层逻辑：通过手机端 VPN Agent 接管 Android 指定包名流量，普通弱网经 ${host} SOCKS + ${windows ? "WinDivert" : "pf/dnctl"}，100% 丢包在手机端直接阻断。使用方法：连接 Android 设备，填写目标包名，必要时先安装 Agent 并授权 VPN，再应用预设。`,
    },
    macos: {
      icon: "GW",
      name: `${gatewayHost} 网关`,
      title: `${gatewayHost} 网关`,
      description: "对指定测试设备 IP 施加规则",
      tip: windows
        ? "底层逻辑：让测试设备流量经过 Windows，再按设备 IP 用 WinDivert network-forward 规则施加带宽、延迟、丢包或阻断。使用方法：填写设备 IP，并确保测试设备流量经过这台 Windows。"
        : "底层逻辑：让测试设备流量经过 Mac，再按设备 IP 用 pf/dnctl 对转发流量施加带宽、延迟、丢包或阻断。使用方法：填写设备 IP，确认 Android 或 iOS 流量已走 Mac 网关，然后应用预设。",
    },
    "mac-global": {
      icon: windows ? "WG" : "MG",
      name: `${host} 全局弱网`,
      title: `${host} 全局`,
      description: `对 ${host} 所有非 localhost 网络流量生效`,
      tip: windows
        ? "底层逻辑：使用 Windows WinDivert 捕获整台 Windows 的非 loopback 出入站流量，在用户态施加延迟、抖动、丢包、限速和断续。使用方法：只选择该模式并应用预设；清除弱网即可恢复。"
        : "底层逻辑：接入弱网工具.app 的全局 pf + dnctl/dummynet 方案，把整台 Mac 非 lo0 的 TCP/UDP 流量导入 pipe。使用方法：只选择该模式并应用预设；会影响浏览器、Unity、SDK、CDN 等所有外网流量，清除弱网即可恢复。",
    },
    "mac-unity": {
      icon: windows ? "WT" : "MU",
      name: windows ? "Windows 目标弱网" : "Mac Unity 真实断网仿真",
      title: windows ? "Windows 目标" : "Mac Unity",
      description: windows ? "针对指定 IPv4 或 IPv4:端口" : "针对 Unity 编辑器 / 播放器及资源请求",
      tip: windows
        ? "底层逻辑：用 WinDivert 只捕获指定 IPv4 或 IPv4:端口 的出入站流量，并施加延迟、丢包、限速和断续。使用方法：填写目标 IP 或 IP:端口 后应用预设。"
        : "底层逻辑：限制内置 Unity 业务、CDN、SDK、直连服务器目标，并清理目标旧连接 state，让 Unity 更接近真实断网/恢复表现。使用方法：选择该模式后直接应用预设；一般不用手动填写目标。",
    },
  };
  return map[mode] || map["mac-global"];
}

function updateModeTextForPlatform() {
  if (elements.networkMode) {
    [...elements.networkMode.options].forEach((option) => {
      option.textContent = getModeUiMeta(option.value).name;
    });
  }

  if (elements.modeCardList) {
    elements.modeCardList.querySelectorAll("[data-mode]").forEach((button) => {
      const meta = getModeUiMeta(button.dataset.mode);
      const icon = button.querySelector(".mode-card-icon");
      const title = button.querySelector("strong");
      const description = button.querySelector("em");
      if (icon) icon.textContent = meta.icon;
      if (title) title.textContent = meta.title;
      if (description) description.textContent = meta.description;
    });
  }

  if (elements.modeList) {
    elements.modeList.querySelectorAll("[data-mode]").forEach((option) => {
      const meta = getModeUiMeta(option.dataset.mode);
      const name = option.querySelector(".mode-name");
      const tip = option.querySelector(".mode-tip");
      const bubble = option.querySelector(".mode-tip-bubble");
      if (name) name.textContent = meta.name;
      if (tip) tip.setAttribute("aria-label", `${meta.name} 说明`);
      if (bubble) bubble.textContent = meta.tip;
    });
  }
}

function updateModeListUi() {
  updateModeTextForPlatform();
  const mode = getNetworkMode();
  let activeOption = null;
  if (elements.modeList) {
    elements.modeList.querySelectorAll("[data-mode]").forEach((button) => {
      const active = button.dataset.mode === mode;
      if (active) activeOption = button;
      button.classList.toggle("active", active);
      button.setAttribute("aria-checked", active ? "true" : "false");
    });
  }
  if (elements.modeCardList) {
    elements.modeCardList.querySelectorAll("[data-mode]").forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }
  if (activeOption && elements.modeTriggerLabel) {
    elements.modeTriggerLabel.textContent = getModeUiMeta(mode).name;
  }
  if (activeOption && elements.modeTriggerTip && elements.modeTriggerTipBubble) {
    const meta = getModeUiMeta(mode);
    elements.modeTriggerTip.setAttribute("aria-label", `${meta.name} 说明`);
    elements.modeTriggerTipBubble.textContent = meta.tip;
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
    elements.deviceStatus.textContent = device ? (device.state === "device" ? "在线" : device.state) : "未连接";
  }

  setHidden(elements.deviceSerialField, !(androidVpn || macGateway));
  setHidden(elements.deviceIpField, !macGateway);
  setHidden(elements.platformField, !macGateway);
  setHidden(elements.targetAppField, !androidVpn);
  setHidden(elements.deviceModeSummary, !macLocal);

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
        ? isWindowsAgent()
          ? "目标 IP / 端口"
          : "Unity 相关目标"
        : "目标游戏";
  }
  if (isMacGlobalMode()) {
    elements.targetApp.value = `整台 ${getHostLabel()} 外网流量（localhost 不受影响）`;
    elements.targetApp.placeholder = `整台 ${getHostLabel()} 外网流量`;
    elements.targetApp.disabled = true;
    elements.installVpnButton.disabled = true;
    elements.authorizeVpnButton.disabled = true;
    elements.foregroundButton.disabled = true;
    renderDeviceModeNote();
  } else if (isMacUnityMode()) {
    if (elements.targetApp.value.trim() === "com.example.game" || elements.targetApp.value.startsWith("整台 ")) {
      elements.targetApp.value = "";
    }
    elements.targetApp.disabled = false;
    elements.targetApp.placeholder = isWindowsAgent() ? "例如 1.2.3.4:443" : "例如 1.2.3.4:443 或 api.example.com";
    elements.installVpnButton.disabled = true;
    elements.authorizeVpnButton.disabled = true;
    elements.foregroundButton.disabled = true;
    renderDeviceModeNote();
  } else {
    const targetValue = elements.targetApp.value.trim();
    if (isAndroidVpnMode() && (targetValue.startsWith("整台 ") || targetValue.includes(":") || targetValue.includes(","))) {
      elements.targetApp.value = "com.example.game";
    } else if (elements.targetApp.value.startsWith("整台 ")) {
      elements.targetApp.value = isAndroidVpnMode() ? "com.example.game" : "";
    }
    elements.targetApp.disabled = false;
    elements.targetApp.placeholder = isAndroidVpnMode() ? "例如 com.ffm.global" : "例如 com.example.game";
    elements.installVpnButton.disabled = false;
    elements.authorizeVpnButton.disabled = false;
    elements.foregroundButton.disabled = false;
    renderDeviceModeNote();
  }
  renderDeviceModeSummary();
  renderGatewayScope();
  renderConsoleSummaries();
}

function renderDeviceModeNote() {
  if (!elements.deviceNote) return;
  if (isMacGlobalMode()) {
    elements.deviceNote.textContent = `${getHostLabel()} 全局弱网会影响整台 ${getHostLabel()} 的非 localhost 网络，效果最接近真实断网/弱网。`;
  } else if (isMacUnityMode()) {
    elements.deviceNote.textContent = isWindowsAgent()
      ? "Windows 目标弱网会限制指定 IPv4 或 IPv4:端口 的流量；域名目标会在后续接 DNS 解析。"
      : "Mac Unity 真实断网仿真会限制 Unity 业务/CDN/SDK 相关目标；完整目标见受限网关。";
  } else if (isAndroidVpnMode()) {
    elements.deviceNote.textContent = "Android VPN Agent 模式会在手机端按目标包名接管流量；先选择设备和包名，再应用预设。";
  } else if (getNetworkMode() === "macos") {
    elements.deviceNote.textContent = `${getGatewayHostLabel()} 网关模式按设备 IP 控制经过 ${getHostLabel()} 的测试机流量。`;
  }
}

function getModeRuleState(modeLabel) {
  const effect = state.currentEffect;
  if (state.serviceStopped || effect.title === "服务不可用") return "服务不可用";
  if (!effect.profile) return "未施加弱网";
  if (effect.modeLabel === modeLabel) return effect.title;
  return "其他模式生效";
}

function renderDeviceModeSummary() {
  if (!elements.deviceModeSummary) return;
  if (!isMacLocalMode()) {
    elements.deviceModeSummary.innerHTML = "";
    setHidden(elements.deviceModeSummary, true);
    return;
  }

  setHidden(elements.deviceModeSummary, false);
  const modeLabel = getNetworkModeLabel();
  const rows = isMacGlobalMode()
    ? [
        ["影响范围", `整台 ${getHostLabel()} 外网流量`],
        ["排除范围", "localhost / 127.0.0.1"],
        ["当前规则", getModeRuleState(modeLabel)],
      ]
    : [
        ["覆盖范围", isWindowsAgent() ? "内置真实业务目标" : "Unity 业务 / CDN / SDK"],
        ["目标来源", state.agent.macUnityTargets.length ? "内置目标" : getMacUnityTargetEndpoint() ? "手动输入" : "等待配置"],
        ["受限目标", state.agent.macUnityTargets.length ? `${state.agent.macUnityTargets.length} 个目标` : getMacUnityTargetEndpoint() ? "已填写" : "未配置"],
        ["当前规则", getModeRuleState(modeLabel)],
      ];

  elements.deviceModeSummary.innerHTML = rows
    .map(
      ([label, value]) => `
        <div class="device-summary-row">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `,
    )
    .join("");
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
    throw new Error(
      isWindowsAgent()
        ? "Windows 目标弱网需要内置目标，或手动填写 host:port / IPv4:port"
        : "Mac Unity 真实断网仿真需要内置目标；请确认 mac-unity-targets.json 已配置 host:port",
    );
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
      if (!current || current === "com.example.game" || current.startsWith("整台 ")) {
        elements.targetApp.value = targets.join(", ");
      }
      if (elements.deviceNote) {
        elements.deviceNote.textContent = isWindowsAgent()
          ? "已使用内置真实业务目标；Windows 目标弱网会自动解析 host:port 并复用这份列表。"
          : "已使用内置 Mac Unity 目标；完整目标见受限网关。";
      }
    } else if (fillInput) {
      if (elements.deviceNote) {
        elements.deviceNote.textContent = isWindowsAgent()
          ? "Windows 目标弱网内置目标尚未配置；请在 mac-unity-targets.json 填写 host:port。"
          : "Mac Unity 内置目标尚未配置；请在 mac-unity-targets.json 填写三个 host:port。";
      }
    }
    renderDeviceModeSummary();
    renderGatewayScope();
    renderCommandPreview();
    return targets;
  } catch (error) {
    if (fillInput && elements.deviceNote) {
      elements.deviceNote.textContent = `读取 Mac Unity 内置目标失败：${error.message}`;
    }
    state.agent.macUnityTargets = [];
    renderDeviceModeSummary();
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
    message: isWindowsAgent()
      ? "Android VPN Agent 将通过 Windows SOCKS 出口和 WinDivert 执行该弱网预设"
      : "Android VPN Agent 将通过 Mac SOCKS 出口和 pf/dnctl 执行该弱网预设",
  };
}

function describeAndroidVpnStatus(data) {
  if (!data) return "Android VPN Agent 状态未知";
  if (!data.installed) return "Android VPN Agent 尚未安装";
  const status = data.status || {};
  if (status.mode === "blackhole" && status.running) {
    const packets = Number(status.blackholePacketCount || 0);
    const bytes = Number(status.blackholeByteCount || 0);
    const hitSummary = packets > 0 ? `，已命中 ${packets} 个包 / ${bytes} bytes` : "，尚未观测到真实业务流量命中";
    return `Android VPN 100% 丢包生效：${status.targetPackage || "目标应用"}${hitSummary}`;
  }
  if (status.mode === "socks" && status.running) {
    if (data.macSocks && !data.macSocks.active) {
      return `Android VPN 已运行，但${getHostLabel()} SOCKS 出口未运行；请重新点击应用预设`;
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

function pushNetworkWaveCommandNotes(lines, profile) {
  if (!isNetworkWaveProfile(profile)) return;
  lines.push(
    "",
    "# 网络波动模式：照搬弱网工具.app 的 start_jitter() 逻辑",
    "# 初始 pipe：下行 500Kbit/s，上行 200Kbit/s，延迟 100ms，丢包 2%",
    "# 后台每 0.8-2s 随机重配 dnctl pipe",
    "# 常规波动：下行 50K~3M，上行 20K~1M，延迟 30~400ms，丢包 0~5%",
    "# 15% 信号丢失：下行 5~30K，上行 2~15K，延迟 500~1200ms，丢包 10~30%",
  );
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
    elements.deviceStatus.textContent = "未连接";
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
    elements.deviceNote.textContent = "本地 Agent 未连接。请运行对应启动脚本后访问 http://localhost:8123。";
    setMonitorStatusText("未采集");
    renderPerformanceStatus();
    return;
  }

  if (isMacLocalMode()) {
    state.agent.available = true;
    await refreshAdminStatus();
    elements.deviceStatus.textContent = "本机模式";
    renderDeviceModeNote();
    updateNetworkModeUi();
    if (isMacUnityMode()) {
      await loadMacUnityBuiltinTargets(true);
    }
    setMonitorStatusText("本机就绪");
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
    setMonitorStatusText(state.agent.devices.length ? "真机就绪" : "未发现设备");
    if (!state.agent.devices.length) {
      elements.deviceNote.textContent = data.error || "未发现已授权的 Android 设备。";
    } else if (isAndroidVpnMode()) {
      await refreshAndroidVpnStatus(false);
    }
  } catch (error) {
    state.agent.available = false;
    elements.deviceStatus.textContent = "未连接";
    elements.deviceNote.textContent = `Agent 未连接：${error.message}`;
    setMonitorStatusText("未采集");
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

function resetPerformanceChartDomains() {
  state.performance.chartDomains = {};
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
  return null;
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
      label: "未连接",
      title: "本地 Agent 未连接",
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

function setMonitorStatusText(text) {
  if (elements.monitorStatus) elements.monitorStatus.textContent = text;
}

function renderPerformance() {
  if (!elements.performanceGrid && !elements.performanceChart && !elements.performanceStatusDetail) return;
  const latest = getLatestPerformanceSample();
  const isReal = latest && latest.source === "adb";
  const errors = isReal && Array.isArray(latest.errors) ? latest.errors : [];
  const isAppWaiting = errors.some((item) => /应用未运行|No process|Unable to find/i.test(item));
  const appPendingText = !latest ? "未采集" : isAppWaiting ? "等待应用" : "采集中";
  const fpsValue = !latest || latest.fps === null || latest.fps === undefined ? appPendingText : Math.round(latest.fps);
  const jankValue = !latest || latest.jank === null || latest.jank === undefined ? appPendingText : `${latest.jank} 次`;
  const rttValue = !latest || latest.rtt === null || latest.rtt === undefined ? "不可用" : formatMs(Math.round(latest.rtt));
  const networkHint = latest && latest.networkInterface ? `下行 / 上行 ${latest.networkInterface}` : "下行 / 上行";
  const metrics = [
    ["FPS", fpsValue, isReal ? "adb gfxinfo" : "等待真机", !latest || (isReal && (latest.fps === null || latest.fps === undefined))],
    ["卡顿", jankValue, "当前采样", !latest || (isReal && (latest.jank === null || latest.jank === undefined))],
    [
      "CPU",
      !latest ? "未采集" : isReal && (latest.cpu === null || latest.cpu === undefined) && isAppWaiting ? "等待应用" : formatPercent(latest.cpu),
      "进程估算",
      !latest || (isReal && (latest.cpu === null || latest.cpu === undefined)),
    ],
    [
      "内存",
      !latest ? "未采集" : isReal && (latest.memory === null || latest.memory === undefined) && isAppWaiting ? "等待应用" : formatMemory(latest.memory),
      "常驻内存",
      !latest || (isReal && (latest.memory === null || latest.memory === undefined)),
    ],
    [
      "网络",
      latest ? `${formatRate(latest.downKbps)} / ${formatRate(latest.upKbps)}` : "未采集",
      networkHint,
      !latest || (isReal && latest.downKbps === null && latest.upKbps === null),
    ],
    ["RTT", rttValue, "网络往返", !latest || (isReal && (latest.rtt === null || latest.rtt === undefined))],
  ];

  if (elements.performanceGrid) {
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
  }

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

function getNetworkWaveRealtimeChips(status, downKbps, upKbps, profile = {}) {
  const chips = ["波动中", `下行 ${formatNetworkCurveSpeed(downKbps)}`, `上行 ${formatNetworkCurveSpeed(upKbps)}`];
  const rawDelayMs = status && status.pipeDelayMs !== null && status.pipeDelayMs !== undefined
    ? status.pipeDelayMs
    : profile.latencyRttMs;
  const rawPacketLossPercent = status && status.packetLossPercent !== null && status.packetLossPercent !== undefined
    ? status.packetLossPercent
    : profile.packetLossPercent;
  const delayMs = Number(rawDelayMs);
  const packetLossPercent = Number(rawPacketLossPercent);
  if (Number.isFinite(delayMs)) chips.push(`延迟 ${formatMs(Math.round(delayMs))}`);
  if (Number.isFinite(packetLossPercent)) chips.push(`丢包 ${formatLoss(packetLossPercent)}`);
  return chips;
}

function updateNetworkWaveCurrentEffect(status, downKbps, upKbps) {
  if (!state.currentEffect.profile || !isNetworkWaveProfile(state.currentEffect.profile)) return;
  state.currentEffect = {
    ...state.currentEffect,
    chips: getNetworkWaveRealtimeChips(status, downKbps, upKbps, state.currentEffect.profile),
  };
  renderCurrentEffect();
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
  const dynamicWave = isNetworkWaveProfile(profile);
  return {
    ok: true,
    active: true,
    blocked,
    timestamp: Date.now(),
    downKbps: blocked ? 0 : dynamicWave ? 500 : getProfileLimitKbps(profile, "downloadKbps"),
    upKbps: blocked ? 0 : dynamicWave ? 200 : getProfileLimitKbps(profile, "uploadKbps"),
    jitter: dynamicWave,
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
  const localWave = localProfile && isNetworkWaveProfile(localProfile);
  const blocked = Boolean(status.blocked || localBlocked);
  const downKbps = blocked
    ? 0
    : localProfile && !localWave
      ? getProfileLimitKbps(localProfile, "downloadKbps")
      : localWave
        ? Math.max(0, Number(status.downKbps || getProfileLimitKbps(localProfile, "downloadKbps") || 0))
        : Math.max(0, Number(status.downKbps || 0));
  const upKbps = blocked
    ? 0
    : localProfile && !localWave
      ? getProfileLimitKbps(localProfile, "uploadKbps")
      : localWave
        ? Math.max(0, Number(status.upKbps || getProfileLimitKbps(localProfile, "uploadKbps") || 0))
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
    elements.networkCurveStatus.textContent = status.jitter || localWave ? "波动中" : "限制生效";
  } else {
    elements.networkCurveStatus.textContent = "未启用";
  }
  if (localWave) updateNetworkWaveCurrentEffect(status, downKbps, upKbps);
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
  const chartTheme = {
    background: "#11171d",
    grid: "rgba(226, 236, 242, 0.08)",
    axisText: "rgba(148, 159, 178, 0.78)",
    emptyText: "rgba(220, 232, 238, 0.58)",
    downLine: "rgba(103, 106, 255, 1)",
    upLine: "rgba(36, 199, 108, 1)",
    downArea: "rgba(112, 121, 137, 0.58)",
    upArea: "rgba(28, 126, 95, 0.16)",
  };
  ctx.fillStyle = chartTheme.background;
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

  ctx.strokeStyle = chartTheme.grid;
  ctx.lineWidth = 1;
  ctx.font = "11px Inter, sans-serif";
  ctx.fillStyle = chartTheme.axisText;
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
    ctx.fillStyle = chartTheme.emptyText;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "13px Inter, sans-serif";
    ctx.fillText("等待网络曲线数据", width / 2, height / 2);
    return;
  }

  ctx.textBaseline = "top";
  const labelStep = Math.max(1, Math.floor(samples.length / 6));
  const labelGap = 12;
  const labelY = height - pad.bottom + 8;
  const lastIndex = samples.length - 1;
  const lastLabel = samples[lastIndex].label;
  const lastLabelWidth = ctx.measureText(lastLabel).width;
  const lastLabelX = width - pad.right;
  const lastLabelLeft = lastLabelX - lastLabelWidth;
  const timeLabels = [];

  const getSampleX = (index) => pad.left + (index / lastIndex) * chartWidth;
  samples.forEach((sample, index) => {
    if (index === lastIndex || index % labelStep !== 0) return;
    const labelWidth = ctx.measureText(sample.label).width;
    const rawX = getSampleX(index);
    const x = Math.max(pad.left + labelWidth / 2, Math.min(width - pad.right - labelWidth / 2, rawX));
    const left = x - labelWidth / 2;
    const right = x + labelWidth / 2;
    const previous = timeLabels[timeLabels.length - 1];
    if (previous && left < previous.right + labelGap) return;
    if (right > lastLabelLeft - labelGap) return;
    timeLabels.push({
      align: "center",
      label: sample.label,
      left,
      right,
      x,
    });
  });
  timeLabels.push({
    align: "right",
    label: lastLabel,
    left: lastLabelLeft,
    right: lastLabelX,
    x: lastLabelX,
  });
  ctx.fillStyle = chartTheme.axisText;
  timeLabels.forEach((label) => {
    ctx.textAlign = label.align;
    ctx.fillText(label.label, label.x, labelY);
  });

  const getPoint = (sample, index, key) => ({
    x: pad.left + (index / (samples.length - 1)) * chartWidth,
    y: pad.top + chartHeight - (sample[key] / yMax) * chartHeight,
  });

  const drawSeriesArea = (key, fill) => {
    ctx.beginPath();
    samples.forEach((sample, index) => {
      const { x, y } = getPoint(sample, index, key);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.left + chartWidth, pad.top + chartHeight);
    ctx.lineTo(pad.left, pad.top + chartHeight);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  const drawSeriesLine = (key, color) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.45;
    ctx.lineJoin = "miter";
    ctx.lineCap = "butt";
    ctx.miterLimit = 2;
    samples.forEach((sample, index) => {
      const { x, y } = getPoint(sample, index, key);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  const drawSeriesDot = (key, color) => {
    const last = samples[samples.length - 1];
    const dotX = pad.left + chartWidth;
    const dotY = pad.top + chartHeight - (last[key] / yMax) * chartHeight;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 3.1, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };

  drawSeriesArea("upKbps", chartTheme.upArea);
  drawSeriesArea("downKbps", chartTheme.downArea);
  drawSeriesLine("upKbps", chartTheme.upLine);
  drawSeriesLine("downKbps", chartTheme.downLine);
  drawSeriesDot("upKbps", chartTheme.upLine);
  drawSeriesDot("downKbps", chartTheme.downLine);
}

function startNetworkCurve() {
  if (state.networkCurve.eventSource || state.networkCurve.timerId) return;
  if (!isLikelyLocalAgent()) {
    elements.networkCurveStatus.textContent = "未连接";
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

function stopNetworkCurve() {
  if (state.networkCurve.eventSource) {
    state.networkCurve.eventSource.close();
    state.networkCurve.eventSource = null;
  }
  window.clearInterval(state.networkCurve.timerId);
  state.networkCurve.timerId = null;
}

function setMonitorTab() {
  state.monitorTab = "network";
  if (elements.monitorTitle) elements.monitorTitle.textContent = "实时网络曲线";
  if (elements.networkCurveTab) {
    elements.networkCurveTab.classList.add("active");
    elements.networkCurveTab.setAttribute("aria-selected", "true");
  }
  if (elements.performanceTab) {
    elements.performanceTab.classList.remove("active");
    elements.performanceTab.setAttribute("aria-selected", "false");
  }
  if (elements.networkCurvePanel) elements.networkCurvePanel.hidden = false;
  if (elements.performancePanel) elements.performancePanel.hidden = true;
  if (elements.networkCurveStatus) elements.networkCurveStatus.hidden = false;
  if (elements.monitorStatus) elements.monitorStatus.hidden = true;
  drawNetworkCurveChart();
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

  state.performance.running = false;
  state.agent.metricsSource = "none";
  setMonitorStatusText("未采集");
  elements.deviceNote.textContent = "性能监控需要本地 Agent 和已授权 Android 设备。";
  showToast(elements.deviceNote.textContent, "error", { duration: 6200 });
  renderPerformanceStatus();
}

function startRealMonitoring() {
  const serial = state.agent.selectedSerial;
  const packageName = elements.targetApp.value.trim();
  if (!packageName) {
    setMonitorStatusText("缺少包名");
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
  setMonitorStatusText("真机监控中");
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
    setMonitorStatusText("采集异常");
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
  setMonitorStatusText("已暂停");
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
  renderNetworkWaveControl();

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
  renderConsoleSummaries();
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

function pushWindowsWeaknetCommandNotes(lines, profile) {
  if (profile.jitterMs > 0) {
    lines.push("", `# 抖动=${formatMs(profile.jitterMs)}：Windows 后端会在包调度时加入随机延迟`);
  }
  if (isNetworkWaveProfile(profile)) {
    lines.push(
      "",
      "# 网络波动模式：Windows 后端会在运行时动态切换延迟/丢包/带宽",
      "# 常规波动：下行 50K~3M，上行 20K~1M，延迟 30~400ms，丢包 0~5%",
      "# 15% 信号丢失：下行 5~30K，上行 2~15K，延迟 500~1200ms，丢包 10~30%",
    );
  }
  if (profile.disconnectMode === "periodic") {
    lines.push("", `# 断续网络：每 ${profile.disconnectIntervalSec}s 阻断 ${profile.disconnectDurationSec}s`);
  }
}

function renderWindowsCommandPreview(profile, deviceIp, targetEndpoint) {
  const oneWayDelay = getSingleWayDelay(profile);
  const target = targetEndpoint && targetEndpoint !== "com.example.game" ? targetEndpoint : "1.2.3.4:443";
  const modeLabel = isMacGlobalMode() ? "Windows 全局弱网" : isMacUnityMode() ? "Windows 目标弱网" : "Windows 网关";
  const scope = isMacGlobalMode() ? "win-global" : isMacUnityMode() ? "win-target" : "win-gateway";

  if (profile.presetKey === "normal") {
    elements.commandPreview.textContent = [
      `# ${modeLabel}：清理 Windows WinDivert 弱网后端`,
      "POST /api/weaknet/clear",
      "# Agent 会停止 Weaknet.WinDivertShaper.exe，并删除 pid 文件",
    ].join("\n");
    return;
  }

  const lines = [
    `# ${profile.displayNameZh}：${modeLabel}`,
    `# backend=Weaknet.WinDivertShaper / scope=${scope}`,
    `# RTT=${formatMs(profile.latencyRttMs)}，单向延迟≈${formatMs(oneWayDelay)}，丢包=${formatLoss(profile.packetLossPercent)}`,
  ];

  if (isMacGlobalMode()) {
    lines.push("# filter: outbound/inbound，排除 loopback");
  } else if (isMacUnityMode()) {
    lines.push(`# target=${target}`, "# 首版 Windows 目标弱网要求填写 IPv4 或 IPv4:端口");
  } else {
    lines.push(`# device_ip=${deviceIp}`, "# layer=network-forward，用于经过 Windows 的测试机流量");
  }

  lines.push(
    "# config: windows-backend/runtime/ui/weaknet-win32-config.json",
    "# status: windows-backend/runtime/ui/weaknet-win32-status.json",
    "Weaknet.WinDivertShaper.exe run --config <config> --status <status> --pid <pid>",
  );

  if (profile.disconnectMode === "always") {
    lines.push("# 100% 丢包/断网由后端直接丢弃匹配包实现");
  }
  pushWindowsWeaknetCommandNotes(lines, profile);
  elements.commandPreview.textContent = lines.join("\n");
}

function renderCommandPreview() {
  const profile = getProfileForApply();
  const deviceIp = elements.deviceIp.value.trim() || "192.168.2.12";
  const targetPackage = elements.targetApp.value.trim() || "com.example.game";
  const serial = state.agent.selectedSerial || "<device_serial>";

  if (elements.commandEyebrow) {
    elements.commandEyebrow.textContent = isAndroidVpnMode()
      ? "Android VPN Agent"
      : isMacGlobalMode()
        ? isWindowsAgent()
          ? "Windows Global"
          : "Mac Global"
        : isMacUnityMode()
          ? isWindowsAgent()
            ? "Windows Target"
            : "Mac Unity"
        : isWindowsAgent()
          ? "Windows Gateway"
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
      const lines = [
        `# ${profile.displayNameZh}：Android VPN Agent + ${getHostLabel()} SOCKS 弱网`,
        `# serial=${serial}`,
        `# target_package=${targetPackage}`,
        `# ${getHostLabel()} 控制台会启动 SOCKS5 出口 0.0.0.0:8124，仅允许当前 Android IP 连接`,
        isWindowsAgent()
          ? "# Windows 控制台会用 WinDivert 对 Android<->Windows SOCKS 隧道施加延迟/丢包/带宽/断续"
          : "# Mac 控制台会用 pf/dnctl 对 Android<->Mac SOCKS 隧道施加延迟/丢包/带宽/断续",
        `adb -s ${serial} shell am broadcast -n com.weaknet.agent/.CommandReceiver -a com.weaknet.agent.APPLY --es profileBase64 '<profile-json-with-socks-endpoint>' --es targetPackage ${targetPackage}`,
      ];
      pushNetworkWaveCommandNotes(lines, profile);
      elements.commandPreview.textContent = lines.join("\n");
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

  if (isWindowsAgent()) {
    renderWindowsCommandPreview(profile, deviceIp, targetPackage);
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
    pushNetworkWaveCommandNotes(lines, profile);
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
    pushNetworkWaveCommandNotes(lines, profile);
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
  pushNetworkWaveCommandNotes(lines, profile);

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
    renderOperationLog();
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
              <dd>${item.performanceSnapshot && Number.isFinite(item.performanceSnapshot.fps) ? Math.round(item.performanceSnapshot.fps) : "未记录"}</dd>
            </div>
            <div>
              <dt>CPU</dt>
              <dd>${item.performanceSnapshot && Number.isFinite(item.performanceSnapshot.cpu) ? formatPercent(item.performanceSnapshot.cpu) : "未记录"}</dd>
            </div>
          </dl>
        </article>
      `,
    )
    .join("");
  renderOperationLog();
}

function getOperationLogTime(createdAt) {
  const value = String(createdAt || "").trim();
  if (!value) return "--:--";
  return value.split(/\s+/).pop();
}

function getOperationLogDetail(item) {
  if (!item) return "";
  const mode = item.networkMode || "macOS 网关";
  const target = getRecordTarget(item);
  if (item.presetKey === "normal") return `${mode} · 已恢复`;
  if (isNetworkWaveProfile(item)) return `${mode} · ${NETWORK_WAVE_MODE.scene}`;
  return `${mode} · ${target}`;
}

function renderOperationLog() {
  if (!elements.operationLog) return;
  const items = state.history.slice(0, 3);
  if (!items.length) {
    elements.operationLog.innerHTML = `
      <div class="operation-log-title">最近操作</div>
      <p class="operation-empty">暂无最近操作。</p>
    `;
    return;
  }

  elements.operationLog.innerHTML = `
    <div class="operation-log-title">最近操作</div>
    ${items
      .map(
        (item) => `
          <div class="operation-log-row">
            <time>${escapeHtml(getOperationLogTime(item.createdAt))}</time>
            <strong>${escapeHtml(item.displayNameZh || "弱网操作")}</strong>
            <span>${escapeHtml(getOperationLogDetail(item))}</span>
          </div>
        `,
      )
      .join("")}
  `;
}

function renderAll() {
  renderPresets();
  renderPerformance();
  renderSummary();
  syncEditorFromProfile();
  renderCommandPreview();
  renderGatewayScope();
  renderCurrentEffect();
  renderOperationStatus();
  renderServiceActionButton();
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
  setOperationStatus({
    tone: "info",
    title: getApplyOperationStartTitle(profile),
    message: getApplyOperationStartMessage(profile),
    steps: [],
  });

  const data = await postAgentJson("/api/android-vpn/apply", {
    serial: state.agent.selectedSerial,
    profile,
    targetApp: record.targetApp,
    deviceIp: record.deviceIp,
  });

  record.applyMode = data.mode;
  state.agent.androidVpn = data.status || state.agent.androidVpn;
  const isNormal = profile.presetKey === "normal";
  elements.runtimeMode.textContent = isNormal ? "正常网络" : `${record.displayNameZh} 已生效`;
  elements.deviceNote.textContent = data.message || describeAndroidVpnStatus(data.status);
  rememberNetworkCurveLimit(profile, data.mode || "android-vpn");
  setCurrentEffectFromRecord(record, profile, "ok");
  renderConsoleSummaries();
  renderDeviceModeSummary();
  renderGatewayScope();
  updateOperationFromSteps({
    tone: "ok",
    title: getApplyOperationDoneTitle(profile),
    message: getApplyOperationDoneMessage(profile),
    steps: data.steps,
  });
  showToast(isNormal ? "已恢复正常网络 · Android VPN 已停止" : `已生效：${record.displayNameZh}`, "success", {
    duration: 5200,
  });
  return data;
}

async function applyProfile() {
  syncProfileFromEditor();
  const profile = getProfileForApply();
  state.networkMode = getNetworkMode();
  if (!requireLocalAgent()) {
    renderSummary();
    renderCommandPreview();
    return;
  }
  if (!requireServiceRunning()) {
    renderSummary();
    renderCommandPreview();
    return;
  }

  if (isAndroidVpnMode()) {
    elements.runtimeMode.textContent = "准备 Android VPN";
    try {
      await ensureAndroidVpnReady(profile);
    } catch (error) {
      if (handleServiceStoppedError(error)) {
        renderSummary();
        renderCommandPreview();
        return;
      }
      elements.runtimeMode.textContent = "准备失败";
      elements.deviceNote.textContent = error.message;
      const readable = getReadableError(error);
      renderConsoleSummaries();
      renderDeviceModeSummary();
      renderGatewayScope();
      updateOperationFromSteps({
        tone: "error",
        title: "准备失败",
        message: readable,
        steps: [],
      });
      showToast(`未生效：${readable}`, "error", { duration: 6800 });
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
      if (handleServiceStoppedError(error)) {
        renderSummary();
        renderCommandPreview();
        return;
      }
      const readable = error.data && error.data.message ? getReadableError(error.data.message) : getReadableError(error);
      if (error.data && error.data.requiresUserAction) {
        elements.runtimeMode.textContent = "等待手机授权";
        elements.deviceNote.textContent = readable;
        updateOperationFromSteps({
          tone: "warn",
          title: "等待手机授权",
          message: readable,
          steps: error.data.steps,
        });
        showToast(`未生效：${readable}`, "info", { duration: 8200 });
      } else {
        elements.runtimeMode.textContent = "下发失败";
        elements.deviceNote.textContent = `Android VPN 下发失败：${readable}`;
        updateOperationFromSteps({
          tone: "error",
          title: "应用失败",
          message: readable,
          steps: error.data && error.data.steps,
        });
        showToast(`未生效：${readable}`, "error", { duration: 6800 });
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

  if (isMacLocalMode()) {
    elements.runtimeMode.textContent = isMacGlobalMode()
      ? `准备 ${getHostLabel()} 全局`
      : isWindowsAgent()
        ? "准备 Windows 目标"
        : "准备 Mac Unity";
    try {
      await refreshAdminStatus();
      assertMacUnityTargetReady(profile);
    } catch (error) {
      if (handleServiceStoppedError(error)) {
        renderSummary();
        renderCommandPreview();
        return;
      }
      elements.runtimeMode.textContent = "准备失败";
      const readable = getReadableError(error);
      renderDeviceModeNote();
      updateOperationFromSteps({
        tone: "error",
        title: "准备失败",
        message: readable,
        steps: [],
      });
      showToast(`未生效：${readable}`, "error", { duration: 6800 });
      renderSummary();
      renderCommandPreview();
      return;
    }
  }

  if (profile.presetKey !== "normal" && !isMacLocalMode()) {
    elements.runtimeMode.textContent = "准备设备";
    try {
      await ensureWeaknetDeviceReady(profile);
    } catch (error) {
      if (handleServiceStoppedError(error)) {
        renderSummary();
        renderCommandPreview();
        return;
      }
      elements.runtimeMode.textContent = "准备失败";
      elements.deviceNote.textContent = error.message;
      const readable = getReadableError(error);
      updateOperationFromSteps({
        tone: "error",
        title: "准备失败",
        message: readable,
        steps: [],
      });
      showToast(`未生效：${readable}`, "error");
      renderSummary();
      renderCommandPreview();
      return;
    }
  }

  const now = new Date();
  const record = {
    ...profile,
    createdAt: now.toLocaleString("zh-CN", { hour12: false }),
    deviceIp: isMacLocalMode() ? `${getHostLabel()} 本机` : elements.deviceIp.value.trim() || "未填写",
    platform: isMacLocalMode() ? getGatewayHostLabel() : elements.platform.value === "ios" ? "iOS" : "Android",
    targetApp: isMacGlobalMode() ? `整台 ${getHostLabel()} 外网流量` : elements.targetApp.value.trim() || "未填写",
    networkMode: getNetworkModeLabel(),
    performanceSnapshot: getLatestPerformanceSample(),
  };
  setOperationStatus({
    tone: "info",
    title: getApplyOperationStartTitle(profile),
    message: getApplyOperationStartMessage(profile),
    steps: [],
  });

  if (isMacGlobalMode()) {
    elements.runtimeMode.textContent = "检查全局模式";
  } else if (isMacUnityMode()) {
    elements.runtimeMode.textContent = "检查目标";
  } else {
    elements.runtimeMode.textContent = "检查 IP";
    try {
      await assertWeaknetTargetIpSafe(record.deviceIp, profile);
    } catch (error) {
      if (handleServiceStoppedError(error)) {
        renderSummary();
        renderCommandPreview();
        return;
      }
      elements.runtimeMode.textContent = "下发已阻止";
      const readable = getReadableError(error);
      elements.deviceNote.textContent = readable;
      updateOperationFromSteps({
        tone: "error",
        title: "应用失败",
        message: readable,
        steps: [],
      });
      showToast(`未生效：${readable}`, "error");
      renderSummary();
      renderCommandPreview();
      return;
    }
  }

  try {
    await assertTrafficPathReady(record, profile);
  } catch (error) {
    if (handleServiceStoppedError(error)) {
      renderSummary();
      renderCommandPreview();
      return;
    }
    elements.runtimeMode.textContent = "下发已阻止";
    const readable = getReadableError(error);
    if (isMacLocalMode()) {
      renderDeviceModeNote();
    } else {
      elements.deviceNote.textContent = readable;
    }
    updateOperationFromSteps({
      tone: "error",
      title: "应用失败",
      message: readable,
      steps: [],
    });
    showToast(`未生效：${readable}`, "error", { duration: 7000 });
    renderSummary();
    renderCommandPreview();
    return;
  }

  elements.runtimeMode.textContent = "正在下发";
  if (isMacLocalMode()) {
    renderDeviceModeNote();
  } else {
    elements.deviceNote.textContent = `正在下发 ${record.displayNameZh} 到 ${record.deviceIp}...`;
  }
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
    const isNormal = profile.presetKey === "normal";
    elements.runtimeMode.textContent = isNormal ? "正常网络" : `${record.displayNameZh} 已生效`;
    if (isMacLocalMode()) {
      renderDeviceModeNote();
    } else {
      elements.deviceNote.textContent = data.message || `${record.displayNameZh} 已下发到 ${record.deviceIp}`;
    }
    setCurrentEffectFromRecord(record, profile, "ok");
    renderConsoleSummaries();
    renderDeviceModeSummary();
    renderGatewayScope();
    updateOperationFromSteps({
      tone: "ok",
      title: getApplyOperationDoneTitle(profile),
      message: getApplyOperationDoneMessage(profile),
      steps: data.steps,
    });
    showToast(isNormal ? "已恢复正常网络" : `已生效：${record.displayNameZh}`, "success", { duration: 4600 });
  } catch (error) {
    if (handleServiceStoppedError(error)) {
      renderSummary();
      renderCommandPreview();
      return;
    }
    elements.runtimeMode.textContent = "下发失败";
    const readable = getReadableError(error);
    if (isMacLocalMode()) {
      renderDeviceModeNote();
    } else {
      elements.deviceNote.textContent = `弱网下发失败：${readable}`;
    }
    updateOperationFromSteps({
      tone: "error",
      title: "应用失败",
      message: readable,
      steps: error.data && error.data.steps,
    });
    showToast(`未生效：${readable}`, "error", { duration: 6200 });
    renderSummary();
    renderCommandPreview();
    return;
  }

  pushHistory(record);
  renderSummary();
  renderCommandPreview();
}

async function clearWeakNet() {
  if (!requireLocalAgent()) {
    renderGatewayScope();
    return;
  }
  if (!requireServiceRunning()) {
    renderGatewayScope();
    return;
  }
  selectPreset("normal");

  state.networkMode = getNetworkMode();
  if (isAndroidVpnMode()) {
    try {
      const device = await ensureAndroidDeviceSelected();
      elements.runtimeMode.textContent = "清除 Android VPN";
      setOperationStatus({
        tone: "info",
        title: "正在恢复正常网络",
        message: "正在清理手机端弱网规则。",
        steps: [],
      });
      const data = await postAgentJson("/api/android-vpn/clear", { serial: device.serial });
      state.agent.androidVpn = data.status || state.agent.androidVpn;
      elements.runtimeMode.textContent = "正常网络";
      elements.deviceNote.textContent = data.message || describeAndroidVpnStatus(data.status);
      rememberNetworkCurveLimit(null, "normal");
      setCurrentEffect({
        tone: "ok",
        title: "正常网络",
        meta: "未施加弱网",
        profile: null,
        modeLabel: "Android VPN Agent",
        target: elements.targetApp.value.trim() || "目标应用",
      });
      updateOperationFromSteps({
        tone: "ok",
        title: "清除完成",
        message: "手机端弱网规则已清理。",
        steps: data.steps,
      });
      renderConsoleSummaries();
      renderDeviceModeSummary();
      renderGatewayScope();
      disableNetworkWaveAfterClear();
      showToast("已恢复正常网络 · Android VPN 已停止", "success");
      await refreshAndroidVpnStatus(false);
    } catch (error) {
      if (handleServiceStoppedError(error)) {
        renderGatewayScope();
        return;
      }
      elements.runtimeMode.textContent = "清除失败";
      const readable = getReadableError(error);
      elements.deviceNote.textContent = `Android VPN 清除失败：${readable}`;
      updateOperationFromSteps({
        tone: "error",
        title: "清除失败",
        message: readable,
        steps: error.data && error.data.steps,
      });
      showToast(`未恢复：${readable}`, "error", { duration: 6200 });
    }
    return;
  }

  elements.runtimeMode.textContent = "正在清除";
  setOperationStatus({
    tone: "info",
    title: "正在恢复正常网络",
    message: "正在清理弱网规则。",
    steps: [],
  });
  try {
    const data = await postAgentJson("/api/weaknet/clear", {});
    elements.runtimeMode.textContent = "正常网络";
    if (isMacLocalMode()) {
      renderDeviceModeNote();
    } else {
      elements.deviceNote.textContent = data.message || "弱网规则已清理";
    }
    rememberNetworkCurveLimit(null, "normal");
    setCurrentEffect({
      tone: "ok",
      title: "正常网络",
      meta: "未施加弱网",
      profile: null,
      modeLabel: getNetworkModeLabel(),
      target: "当前模式",
    });
    updateOperationFromSteps({
      tone: "ok",
      title: "清除完成",
      message: "弱网规则已清理。",
      steps: data.steps,
    });
    renderConsoleSummaries();
    renderDeviceModeSummary();
    renderGatewayScope();
    disableNetworkWaveAfterClear();
    showToast("已恢复正常网络", "success");
  } catch (error) {
    if (handleServiceStoppedError(error)) {
      renderGatewayScope();
      return;
    }
    elements.runtimeMode.textContent = "清除失败";
    const readable = getReadableError(error);
    if (isMacLocalMode()) {
      renderDeviceModeNote();
    } else {
      elements.deviceNote.textContent = `清除弱网失败：${readable}`;
    }
    updateOperationFromSteps({
      tone: "error",
      title: "清除失败",
      message: readable,
      steps: error.data && error.data.steps,
    });
    showToast(`未恢复：${readable}`, "error", { duration: 6200 });
  }
}

function getStopServiceSteps(data = {}) {
  const stop = data.stop || data;
  const androidSteps = stop.androidVpn && Array.isArray(stop.androidVpn.steps) ? stop.androidVpn.steps : [];
  const weaknetSteps = stop.weaknet && Array.isArray(stop.weaknet.steps) ? stop.weaknet.steps : [];
  return [...androidSteps, ...weaknetSteps];
}

async function stopService() {
  if (state.serviceStopped) {
    await restartService();
    return;
  }
  if (!isLikelyLocalAgent()) {
    const message = "请通过本地 Agent 页面停止弱网服务。";
    showToast(message, "error", { duration: 6200 });
    return;
  }
  const confirmed = window.confirm("停止本机弱网服务？将先恢复正常网络，然后关闭 8123 Agent。");
  if (!confirmed) return;

  let stopped = false;
  if (elements.stopServiceButton) elements.stopServiceButton.disabled = true;
  elements.runtimeMode.textContent = "正在停止服务";
  setOperationStatus({
    tone: "info",
    title: "正在停止服务",
    message: "正在恢复正常网络并关闭本机弱网 Agent。",
    steps: [],
  });

  try {
    const payload = { serial: isAndroidVpnMode() ? state.agent.selectedSerial || "" : "" };
    const data = isLauncherPage() || isWindowsAgent()
      ? await fetchLauncherJson("/api/launcher/stop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await postAgentJson("/api/service/stop", payload);
    stopped = true;
    stopNetworkCurve();
    stopMonitoring();
    state.serviceStopped = true;
    state.agent.available = false;
    state.agent.admin = null;
    state.agent.metricsSource = "none";
    elements.runtimeMode.textContent = "服务已停止";
    elements.deviceNote.textContent = SERVICE_STOPPED_MESSAGE;
    setServiceUnavailableEffect();
    updateOperationFromSteps({
      tone: "ok",
      title: "服务已停止",
      message: "Agent 已关闭。",
      steps: getStopServiceSteps(data),
    });
    renderServiceActionButton();
    renderPerformanceStatus();
    renderGatewayScope();
    showToast(SERVICE_STOPPED_MESSAGE, "info", { duration: 7000 });
  } catch (error) {
    const readable = getReadableError(error);
    elements.runtimeMode.textContent = "停止失败";
    elements.deviceNote.textContent = `停止服务失败：${readable}`;
    updateOperationFromSteps({
      tone: "error",
      title: "停止失败",
      message: readable,
      steps: error.data && getStopServiceSteps(error.data),
    });
    showToast(`停止服务失败：${readable}`, "error", { duration: 6800 });
  } finally {
    if (elements.stopServiceButton && !stopped) elements.stopServiceButton.disabled = false;
  }
}

async function restartService() {
  if (!isLikelyLocalAgent()) {
    showToast("请重新打开 WeakNetConsole.app 启动服务。", "error", { duration: 6200 });
    return;
  }

  if (isWindowsAgent() && !isLauncherPage()) {
    window.location.replace(getLauncherUrl("/?action=restart"));
    return;
  }

  if (elements.stopServiceButton) {
    elements.stopServiceButton.disabled = true;
    elements.stopServiceButton.textContent = "重启中";
  }
  elements.runtimeMode.textContent = "正在重启服务";
  setOperationStatus({
    tone: "info",
    title: "正在重启服务",
    message: "正在请求 macOS 授权并重新启动弱网服务。",
    steps: [],
  });

  try {
    const result = await fetchLauncherJson("/api/launcher/start", { method: "POST" });
    state.launcher.status = result;
    if (result.agentPort) launcherConfig.agentPort = String(result.agentPort);
    const status = result.agent && result.agent.ready ? result : await waitForLauncherAgentReady();
    state.serviceStopped = false;
    showToast("弱网服务已重新启动", "success", { duration: 4200 });
    setTimeout(() => redirectToAgent(status), 300);
  } catch (error) {
    state.serviceStopped = true;
    const message = "无法自动重启服务，请重新打开 WeakNetConsole.app 重新启动服务。";
    elements.runtimeMode.textContent = "重启失败";
    elements.deviceNote.textContent = message;
    updateOperationFromSteps({
      tone: "error",
      title: "重启失败",
      message,
      steps: [],
    });
    showToast(message, "error", { duration: 7000 });
    renderServiceActionButton();
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

  elements.themePrevButton?.addEventListener("click", () => cycleTheme(-1));
  elements.themeNextButton?.addEventListener("click", () => cycleTheme(1));
  elements.themeLockButton?.addEventListener("click", lockCurrentTheme);

  elements.advancedToggle.addEventListener("change", () => {
    elements.advancedEditor.classList.toggle("visible", elements.advancedToggle.checked);
    syncEditorFromProfile();
  });

  if (elements.networkWaveToggle) {
    elements.networkWaveToggle.addEventListener("change", () => {
      renderNetworkWaveControl();
      renderSummary();
      renderCommandPreview();
    });
  }

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
      renderConsoleSummaries();
      if (input === elements.targetApp) {
        renderDeviceModeSummary();
        renderGatewayScope();
      }
    });
    input.addEventListener("change", () => {
      renderCommandPreview();
      renderConsoleSummaries();
      if (input === elements.targetApp) {
        renderDeviceModeSummary();
        renderGatewayScope();
      }
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

  if (elements.modeCardList) {
    elements.modeCardList.addEventListener("click", (event) => {
      const option = event.target.closest("[data-mode]");
      if (!option) return;
      setNetworkMode(option.dataset.mode);
    });
  }

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
  if (elements.networkCurveTab) elements.networkCurveTab.addEventListener("click", () => setMonitorTab());
  if (elements.performanceTab) elements.performanceTab.addEventListener("click", () => setMonitorTab());
  elements.applyButton.addEventListener("click", applyProfile);
  elements.clearButton.addEventListener("click", clearWeakNet);
  elements.resetButton.addEventListener("click", clearWeakNet);
  if (elements.stopServiceButton) elements.stopServiceButton.addEventListener("click", stopService);
  if (elements.startMonitorButton) elements.startMonitorButton.addEventListener("click", startMonitoring);
  if (elements.stopMonitorButton) elements.stopMonitorButton.addEventListener("click", stopMonitoring);
  elements.clearHistoryButton.addEventListener("click", clearHistory);

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
  await hydrateThemePreference();
  setTheme(state.theme);
  bindEvents();
  setMonitorTab("network");
  updateNetworkModeUi();
  renderAll();
  if (await refreshLauncherGate()) return;
  await refreshAgentHealth();
  updateNetworkModeUi();
  renderAll();
  startNetworkCurve();
  refreshDevices();
}

initApp();
