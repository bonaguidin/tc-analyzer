// popup.js

const STATES = ["none", "ready", "loading", "done", "error"];

function showState(name) {
  STATES.forEach(s => document.getElementById(`state-${s}`).classList.add("hidden"));
  document.getElementById(`state-${name}`).classList.remove("hidden");
}

const SEVERITY_CONFIG = {
  red: {
    icon: "🔴", label: "Alarming Clauses Found", cls: "red",
    actionColor: "#ef4444", actionHover: "#f87171", actionText: "#ffffff",
  },
  yellow: {
    icon: "🟡", label: "Clauses Worth Reviewing", cls: "yellow",
    actionColor: "#f59e0b", actionHover: "#fbbf24", actionText: "#0f1117",
  },
  green: {
    icon: "🟢", label: "Looks Standard", cls: "green",
    actionColor: "#22c55e", actionHover: "#4ade80", actionText: "#0f1117",
  },
};

function renderSeverityBanner(severity) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.yellow;

  const banner = document.getElementById("severity-banner");
  banner.className = `severity-banner ${cfg.cls}`;
  document.getElementById("severity-icon").textContent = cfg.icon;
  document.getElementById("severity-label").textContent = cfg.label;

  // Dynamic button color
  const root = document.documentElement;
  root.style.setProperty("--action-color",       cfg.actionColor);
  root.style.setProperty("--action-color-hover", cfg.actionHover);
  root.style.setProperty("--action-text",        cfg.actionText);
}


function getCurrentTab() {
  return new Promise(resolve =>
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => resolve(tabs[0]))
  );
}

function sendToContentScript(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, response => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(response);
    });
  });
}

let cachedResult = null;
let currentTabId = null;

async function init() {
  const tab = await getCurrentTab();
  currentTabId = tab.id;

  // Dismiss the toast on the page — user has opened the extension
  try {
    await sendToContentScript(currentTabId, { type: "DISMISS_TOAST" });
  } catch {
    // Page may not have a content script — non-fatal
  }

  const stored = await chrome.storage.session.get(`result_${currentTabId}`);
  const existing = stored[`result_${currentTabId}`];
  if (existing) {
    cachedResult = existing;
    showDoneState(existing);
    return;
  }

  let status;
  try {
    status = await sendToContentScript(currentTabId, { type: "GET_TC_STATUS" });
  } catch {
    showState("none");
    return;
  }

  showState(status?.detected ? "ready" : "none");
}

async function runAnalysis() {
  const tab = await getCurrentTab();
  currentTabId = tab.id;

  showState("loading");
  chrome.runtime.sendMessage({ type: "SET_BADGE_ANALYZING", tabId: currentTabId });

  let extraction;
  try {
    extraction = await sendToContentScript(currentTabId, { type: "EXTRACT_TC_TEXT" });
  } catch {
    showError("Could not read this page. Try reloading and analyzing again.");
    return;
  }

  if (!extraction?.success) {
    showError(extraction?.reason || "Could not extract T&C text from this page.");
    return;
  }

  let result;
  try {
    result = await analyzeTCText(extraction.text);
  } catch (e) {
    showError(`Analysis failed: ${e.message}`);
    return;
  }

  result.sourceUrl        = extraction.url;
  result.analyzedAt       = new Date().toISOString();
  result.extractionSource = extraction.source;
  cachedResult = result;

  chrome.runtime.sendMessage({ type: "ANALYSIS_COMPLETE", tabId: currentTabId, result });
  showDoneState(result);
}

function renderClauseChips(clauses) {
  const counts = { red: 0, yellow: 0, green: 0 };
  (clauses || []).forEach(c => {
    if (counts[c.severity] !== undefined) counts[c.severity]++;
  });
  document.getElementById("chip-count-red").textContent    = counts.red;
  document.getElementById("chip-count-yellow").textContent = counts.yellow;
  document.getElementById("chip-count-green").textContent  = counts.green;
}

function showDoneState(result) {
  showState("done");
  renderSeverityBanner(result.overallSeverity);
  renderClauseChips(result.clauses);   // ← add this line back
  document.getElementById("done-summary").textContent = result.summary;
  document.getElementById("truncation-warning").classList.toggle("hidden", !result.truncated);
}

function showError(msg) {
  showState("error");
  document.getElementById("error-msg").textContent = msg;
  chrome.runtime.sendMessage({ type: "SET_BADGE_ANALYZING", tabId: currentTabId });
}

document.getElementById("btn-analyze").addEventListener("click", runAnalysis);
document.getElementById("btn-retry").addEventListener("click", () => showState("ready"));
document.getElementById("btn-reanalyze").addEventListener("click", async () => {
  if (currentTabId) {
    await chrome.storage.session.remove(`result_${currentTabId}`);
    cachedResult = null;
  }
  runAnalysis();
});
document.getElementById("btn-details").addEventListener("click", async () => {
  if (!cachedResult || !currentTabId) return;
  await chrome.storage.session.set({ [`result_${currentTabId}`]: cachedResult });
  chrome.tabs.create({
    url: chrome.runtime.getURL(`results/results.html?tabId=${currentTabId}`),
  });
});

init();
