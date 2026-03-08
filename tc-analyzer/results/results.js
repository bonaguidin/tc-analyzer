// results.js
// Reads the analysis result from chrome.storage.session and renders it.

const SEVERITY_CONFIG = {
  red:    { icon: "🔴", label: "Alarming Clauses Found"  },
  yellow: { icon: "🟡", label: "Clauses Worth Reviewing" },
  green:  { icon: "🟢", label: "Looks Standard"          },
};

// ─── State helpers ────────────────────────────────────────────────────────
function show(id) { document.getElementById(id).classList.remove("hidden"); }
function hide(id) { document.getElementById(id).classList.add("hidden"); }

// ─── Render ───────────────────────────────────────────────────────────────
function renderResults(result) {
  hide("state-loading");
  show("state-results");

  const cfg = SEVERITY_CONFIG[result.overallSeverity] || SEVERITY_CONFIG.yellow;

  // Header badge
  const badge = document.getElementById("header-badge");
  badge.textContent = cfg.label;
  badge.className = `header-badge ${result.overallSeverity}`;

  // Source URL
  if (result.sourceUrl) {
    document.getElementById("source-url").textContent = result.sourceUrl;
  }

  // Summary card
  const card = document.getElementById("summary-card");
  card.className = `summary-card ${result.overallSeverity}`;
  document.getElementById("summary-icon").textContent = cfg.icon;
  document.getElementById("summary-label").textContent = cfg.label;
  document.getElementById("summary-text").textContent = result.summary;

  if (result.truncated) {
    document.getElementById("truncation-warning").classList.remove("hidden");
  }

  // Stats
  const counts = { red: 0, yellow: 0, green: 0 };
  (result.clauses || []).forEach((c) => {
    if (counts[c.severity] !== undefined) counts[c.severity]++;
  });
  document.getElementById("count-red").textContent    = counts.red;
  document.getElementById("count-yellow").textContent = counts.yellow;
  document.getElementById("count-green").textContent  = counts.green;

  // Clause cards
  renderClauses(result.clauses || [], "all");

  // Filter buttons
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderClauses(result.clauses || [], btn.dataset.filter);
    });
  });

  // Footer
  if (result.analyzedAt) {
    const d = new Date(result.analyzedAt);
    document.getElementById("analyzed-time").textContent = d.toLocaleString();
  }
  if (result.extractionSource) {
    const srcMap = { modal: "extracted from modal", main: "extracted from main content", body: "extracted from page body (fallback)" };
    document.getElementById("extraction-source").textContent = srcMap[result.extractionSource] || result.extractionSource;
  }
}

function renderClauses(clauses, filter) {
  const list = document.getElementById("clause-list");
  list.innerHTML = "";

  const filtered = filter === "all" ? clauses : clauses.filter((c) => c.severity === filter);

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "full-center";
    empty.style.minHeight = "120px";
    empty.innerHTML = `<p style="color:var(--text-muted)">No clauses in this category.</p>`;
    list.appendChild(empty);
    return;
  }

  filtered.forEach((clause) => {
    const card = document.createElement("div");
    card.className = `clause-card ${clause.severity}`;

    const iconMap = { red: "🔴", yellow: "🟡", green: "🟢" };
    const icon = iconMap[clause.severity] || "⚪";

    card.innerHTML = `
      <div class="clause-header">
        <span class="clause-severity-icon">${icon}</span>
        <span class="clause-title">${escapeHtml(clause.title)}</span>
      </div>
      <div class="clause-body">
        <p class="clause-explanation">${escapeHtml(clause.explanation)}</p>
        ${clause.quote ? `<div class="clause-quote">"${escapeHtml(clause.quote)}"</div>` : ""}
      </div>
    `;
    list.appendChild(card);
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showError(msg) {
  hide("state-loading");
  show("state-error");
  if (msg) document.getElementById("error-msg").textContent = msg;
}

// ─── Boot ─────────────────────────────────────────────────────────────────
async function init() {
  const params = new URLSearchParams(window.location.search);
  const tabId = params.get("tabId");

  if (!tabId) {
    showError("No analysis data found. Close this tab and run the analysis again.");
    return;
  }

  const key = `result_${tabId}`;
  let stored;

  try {
    stored = await chrome.storage.session.get(key);
  } catch (e) {
    showError("Could not access storage. Try closing and re-opening the analysis.");
    return;
  }

  const result = stored[key];

  if (!result) {
    showError("Analysis results have expired or were not found. Run the analysis again from the extension popup.");
    return;
  }

  renderResults(result);
}

init();
