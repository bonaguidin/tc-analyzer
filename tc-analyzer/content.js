// content.js
// Injected into every page. Responsible for:
// 1. Detecting T&C pages and modals
// 2. Injecting a lightweight toast nudge pointing at the extension icon
// 3. Extracting text (including from accordions) when popup requests it

(function () {
  if (window.__tcAnalyzerInjected) return;
  window.__tcAnalyzerInjected = true;

  // ─── Search engine exclusion ─────────────────────────────────────────────
  // Prevent false positives on search results pages, which show T&C snippets
  const SEARCH_ENGINE_PATTERNS = [
    /^(www\.)?google\.[a-z.]+\/search/,
    /^(www\.)?bing\.com\/search/,
    /^(www\.)?duckduckgo\.com\/\?/,
    /^(www\.)?yahoo\.com\/search/,
    /^(www\.)?search\.yahoo\.com/,
    /^(www\.)?ecosia\.org\/search/,
    /^(www\.)?brave\.com\/search/,
    /^(www\.)?startpage\.com/,
  ];

  function isSearchPage() {
    const url = window.location.hostname + window.location.pathname + window.location.search;
    return SEARCH_ENGINE_PATTERNS.some(pattern => pattern.test(url));
  }

  // ─── Keywords ─────────────────────────────────────────────────────────────
  const TC_KEYWORDS = [
    "terms of service", "terms and conditions", "terms of use",
    "privacy policy", "user agreement", "end user license agreement",
    "eula", "acceptable use policy", "service agreement", "legal agreement",
  ];

  // ─── Accordion selectors ──────────────────────────────────────────────────
  const ACCORDION_TRIGGER_SELECTORS = [
    "[aria-expanded='false']", ".accordion-trigger", ".accordion-header",
    ".accordion-button", ".collapsible-trigger", ".collapsible-header",
    ".collapse-toggle", "[class*='accordion'] button",
    "[class*='accordion'] [role='button']", "[class*='collapsible'] button",
    "[class*='collapse'] button", "details:not([open]) > summary",
    "[data-toggle='collapse']", "[data-bs-toggle='collapse']",
  ].join(", ");

  const EXCLUDED_PARENTS = [
    "header", "nav", "footer", "[role='navigation']", "[role='search']",
    "[role='banner']", "form", "[class*='search']", "[class*='navbar']",
    "[class*='nav-']", "[id*='search']", "[id*='nav']",
    "[id*='header']", "[id*='menu']",
  ];

  function isSafeToClick(el) {
    const label = el.textContent.trim();
    if (label.length < 2 || label.length > 200) return false;
    for (const s of EXCLUDED_PARENTS) { if (el.closest(s)) return false; }
    if (el.tagName === "INPUT") return false;
    if (el.tagName === "A" && el.getAttribute("href") &&
        el.getAttribute("href") !== "#") return false;
    const controls = el.getAttribute("aria-controls");
    if (controls) {
      const target = document.getElementById(controls);
      if (target) {
        if (["search","navigation","banner"].includes(target.getAttribute("role") || "")) return false;
        if (/search|nav|menu|header/.test((target.className || "").toLowerCase())) return false;
      }
    }
    return !!el.closest(
      "main, article, [role='main'], .content, #content, " +
      "[class*='policy'], [class*='terms'], [class*='legal'], " +
      "[class*='accordion'], [class*='collapsible']"
    );
  }

  function isVisible(el) {
    const s = window.getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden" &&
           s.opacity !== "0" && el.offsetHeight > 0;
  }

  function looksLikeTCPage() {
    const combined = [
      document.title,
      ...Array.from(document.querySelectorAll("h1, h2")).map(e => e.textContent),
      window.location.href,
    ].join(" ").toLowerCase();
    return TC_KEYWORDS.some(kw => combined.includes(kw));
  }

  function looksLikeTCModal() {
    const els = document.querySelectorAll(
      '[role="dialog"],[role="alertdialog"],.modal,.overlay,' +
      '[class*="modal"],[class*="dialog"],[class*="consent"],[class*="terms"]'
    );
    for (const el of els) {
      if (!isVisible(el)) continue;
      if (TC_KEYWORDS.some(kw => el.textContent.toLowerCase().includes(kw))) return true;
    }
    return false;
  }

  function expandAccordions() {
    return new Promise(resolve => {
      let clicked = 0;
      try {
        document.querySelectorAll(ACCORDION_TRIGGER_SELECTORS).forEach(trigger => {
          try {
            if (trigger.getAttribute("aria-expanded") === "true") return;
            if (!isVisible(trigger) || !isSafeToClick(trigger)) return;
            trigger.click();
            clicked++;
          } catch (e) {}
        });
      } catch (e) {}
      setTimeout(resolve, clicked > 0 ? 400 : 0);
    });
  }

  function cleanText(raw) {
    return raw.replace(/\t/g, " ").replace(/\n{3,}/g, "\n\n")
              .replace(/ {2,}/g, " ").trim();
  }

  function extractTCText() {
    const modalEls = document.querySelectorAll(
      '[role="dialog"],[role="alertdialog"],.modal,[class*="modal"],' +
      '[class*="dialog"],[class*="terms"],[class*="consent"]'
    );
    for (const el of modalEls) {
      if (!isVisible(el)) continue;
      const text = cleanText(el.textContent);
      if (text.length > 200 && TC_KEYWORDS.some(kw => text.toLowerCase().includes(kw)))
        return { text, source: "modal" };
    }
    const mainEls = document.querySelectorAll(
      "main,article,[role='main'],.content,#content,.terms,#terms," +
      "[class*='policy'],[class*='legal']"
    );
    for (const el of mainEls) {
      const text = cleanText(el.textContent);
      if (text.length > 500) return { text, source: "main" };
    }
    return { text: cleanText(document.body.textContent), source: "body" };
  }

  // ─── Toast Nudge ──────────────────────────────────────────────────────────
  // A lightweight pointer that says "T&C found, open the extension."
  // No analysis logic here — just directs the user to the icon.
  function injectToast() {
    if (document.getElementById("tca-toast-host")) return;

    const host = document.createElement("div");
    host.id = "tca-toast-host";
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });
    const iconUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAABS0lEQVR4nOWazQ2DMAyFIeoUSJw5dY3O1BE6U9foiTMSa9CTq5TGwXb+bPquaZLv4RcTVfRdRg3jtFF+ty5zn2vP5IWo0JhSzYgmp0Jjkphx3Aml4KVrkx2XBA+JWg1SBWrDc/Y8NNACnrN31EBLeCoDakADPCjGEjSgCR6EMf0Y0AgPCrGx3wPa9GVA89MH7RkdNqBZPqv5CF2wgdvjhU563q9FYCRyXWcrPiBgNh8h+wYsxgc0jNNmvgJoF4op1qFyitLtUAP+5FrAEpmPkHkDojNQS350sfNAMlDr6iA5a+YjZN9Azj9aa2td5t5+BVoDpOoTH2uXOoi++Qqcx4ClbuSzOmxAq/aM54kQSHMVQmzBCmg0gTGhEdJkIsYSPQMaTBwxHB7iliYoe5O6UAsT1D3ZYKXvTNyHxX4PlKyGZO3//NgDU4vPbd4Z1oIdJk4p1AAAAABJRU5ErkJggg==';
    shadow.innerHTML = `
      <style>
        :host {
          position: fixed;
          top: 8px;
          right: 250px;
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        #toast {
          position: relative;
          background: #1a1d27;
          border: 1px solid #f59e0b;
          border-radius: 10px;
          padding: 12px 14px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          width: 260px;
          animation: dropIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        /* Arrow pointing up toward the extension icon */
        #toast::before {
          content: '';
          position: absolute;
          top: -7px;
          right: 80px;
          width: 12px;
          height: 12px;
          background: #1a1d27;
          border-top: 1px solid #f59e0b;
          border-left: 1px solid #f59e0b;
          transform: rotate(45deg);
        }
        @keyframes dropIn {
          from { transform: translateY(-10px); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
        #toast.hiding { animation: fadeOut 0.2s ease forwards; }
        @keyframes fadeOut { to { opacity: 0; transform: translateY(-8px); } }
        #header-row {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 7px;
        }
        #ext-icon {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          opacity: 0.85;
        }
        #inline-puzzle {
          width: 13px;
          height: 13px;
          display: inline-block;
          vertical-align: middle;
          margin: 0 2px -1px 2px;
          opacity: 0.9;
        }
        #title {
          color: #e8eaf0;
          font-weight: 600;
          font-size: 13px;
          flex: 1;
        }
        #instruction {
          color: #cbd5e1;
          font-size: 11.5px;
          line-height: 1.55;
          margin-bottom: 6px;
        }
        #tip {
          color: #7b7f96;
          font-size: 10.5px;
          font-style: italic;
          line-height: 1.4;
          padding-top: 5px;
          border-top: 1px solid #2a2d3a;
        }
        #btn-dismiss {
          background: none;
          border: none;
          color: #4b5563;
          font-size: 15px;
          cursor: pointer;
          padding: 0 2px;
          line-height: 1;
          flex-shrink: 0;
          align-self: flex-start;
        }
        #btn-dismiss:hover { color: #9ca3af; }
      </style>
      <div id="toast">
        <div id="header-row">
          <svg id="ext-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.5 11H19V7C19 5.9 18.1 5 17 5H13V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4C2.9 5 2 5.9 2 7V10.8H3.5C4.99 10.8 6.2 12.01 6.2 13.5S4.99 16.2 3.5 16.2H2V20C2 21.1 2.9 22 4 22H7.8V20.5C7.8 19.01 9.01 17.8 10.5 17.8S13.2 19.01 13.2 20.5V22H17C18.1 22 19 21.1 19 20V16H20.5C21.88 16 23 14.88 23 13.5S21.88 11 20.5 11Z" fill="#e8eaf0"/>
          </svg>
          <div id="title">T&amp;C Detected</div>
          <button id="btn-dismiss" aria-label="Dismiss">&#x2715;</button>
        </div>
        <div id="instruction">Click the
          <svg id="inline-puzzle" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20.5 11H19V7C19 5.9 18.1 5 17 5H13V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4C2.9 5 2 5.9 2 7V10.8H3.5C4.99 10.8 6.2 12.01 6.2 13.5S4.99 16.2 3.5 16.2H2V20C2 21.1 2.9 22 4 22H7.8V20.5C7.8 19.01 9.01 17.8 10.5 17.8S13.2 19.01 13.2 20.5V22H17C18.1 22 19 21.1 19 20V16H20.5C21.88 16 23 14.88 23 13.5S21.88 11 20.5 11Z" fill="#e8eaf0"/></svg>
          button above, then open T&amp;C Analyzer.
        </div>
        <div id="tip">&#128204; Tip: pin T&amp;C Analyzer for quick access</div>
      </div>
    `;

    const toast = shadow.getElementById("toast");
    shadow.getElementById("btn-dismiss").addEventListener("click", () => {
      toast.classList.add("hiding");
      setTimeout(() => host.remove(), 220);
    });
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────
  // Never fire on search engine results pages — they contain T&C text snippets
  // in search results which would cause false positives on nearly every search
  const detected = !isSearchPage() && (looksLikeTCPage() || looksLikeTCModal());
  chrome.runtime.sendMessage({ type: "TC_DETECTION_STATUS", detected });
  if (detected) setTimeout(injectToast, 800);

  // ─── Popup message listener ───────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "DISMISS_TOAST") {
      // Popup opened — dismiss the toast if it's still visible
      const host = document.getElementById("tca-toast-host");
      if (host && host.shadowRoot) {
        const toast = host.shadowRoot.getElementById("toast");
        if (toast) {
          toast.classList.add("hiding");
          setTimeout(() => host.remove(), 220);
        }
      }
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "GET_TC_STATUS") {
      sendResponse({ detected });
      return; // synchronous — do NOT return true
    }

    if (message.type === "EXTRACT_TC_TEXT") {
      if (!detected) {
        sendResponse({ success: false, reason: "No T&C detected on this page." });
        return; // synchronous
      }
      // Async: expand accordions then extract
      expandAccordions().then(() => {
        const { text, source } = extractTCText();
        sendResponse({ success: true, text, source, url: window.location.href });
      });
      return true; // keep channel open for async response
    }
  });
})();
