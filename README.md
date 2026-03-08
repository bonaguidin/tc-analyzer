# ⚖️ T&C Analyzer — Chrome Extension

A Chrome extension that automatically detects Terms & Conditions pages and modals, extracts the text, and uses an LLM to flag potentially harmful clauses — color-coded, plain-language, and no copy-pasting required.

![Status](https://img.shields.io/badge/status-MVP-green) ![Manifest](https://img.shields.io/badge/manifest-v3-blue) ![Model](https://img.shields.io/badge/model-DeepSeek%20V3-purple)

---

## What It Does

When you land on a Terms & Conditions page, the extension:

1. Detects the T&C content automatically (including accordion/collapsed sections)
2. Shows a toast notification pointing you to the extension icon
3. Lets you run an analysis with one click
4. Returns a color-coded summary in the popup
5. Offers a full detailed breakdown in a separate tab

**Severity levels:**
- 🔴 **Alarming** — data selling, binding arbitration, indemnification clauses, perpetual licenses, unilateral policy changes
- 🟡 **Caution** — vague affiliate sharing, likeness/photo rights, auto-renewal traps, forced jurisdiction, liability caps
- 🟢 **Standard** — cookies, basic analytics, payment processor data sharing

---

## Project Structure

```
tc-analyzer/
├── manifest.json          # Chrome extension manifest v3
├── background.js          # Service worker: badge management, API calls
├── content.js             # Injected into pages: T&C detection, extraction, toast
├── config.js              # ⚠️  API key config — gitignored, never commit
├── config.example.js      # Safe template — copy this to create config.js
├── .gitignore             # Ensures config.js is never committed
├── lib/
│   └── analyzer.js        # Prompt logic and OpenRouter API call (popup context)
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── results/
│   ├── results.html
│   ├── results.js
│   └── results.css
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Setup & Installation

### Step 1 — Get an API Key

This extension uses an LLM via API to analyze T&C text. It is configured for **DeepSeek V3 via OpenRouter** by default, but any OpenAI-compatible API will work with minor changes to `config.js` and `lib/analyzer.js`.

**Option A — OpenRouter (recommended, what this project uses)**
1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Go to **Keys** and create a new API key
3. We utilized Deepseek V3 for the models logic capablities and low cost. You can use whatever model you would like

**Option B — OpenAI directly**
1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Go to **API Keys** and create a key
3. In `config.js`, change the model to `gpt-4o-mini` or similar
4. In `lib/analyzer.js` and `background.js`, change the API endpoint from `https://openrouter.ai/api/v1/chat/completions` to `https://api.openai.com/v1/chat/completions`
5. Remove the `HTTP-Referer` and `X-Title` headers from the fetch calls (OpenAI doesn't use them)

**Option C — Any OpenAI-compatible provider**
Most providers (Anthropic via proxy, Mistral, Groq, etc.) follow the same API shape. Update the endpoint URL and model name in `config.js`.

---

### Step 2 — Configure the Extension

```bash
# Copy the example config file
cp config.example.js config.js
```

Open `config.js` and fill in your values:

```js
const CONFIG = {
  OPENROUTER_API_KEY: "your-api-key-here",
  MODEL: "deepseek/deepseek-chat",       // Change this if using a different provider
  MAX_TOKENS: 2000,                       // Output length — 2000 is sufficient for analysis
  MAX_INPUT_CHARS: 40000,                 // ~10k tokens of T&C input; increase for very long docs
};
```

> ⚠️ `config.js` is listed in `.gitignore` and will not be committed. Never paste your API key anywhere else in the codebase.

---

### Step 3 — Load into Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** using the toggle in the top-right corner
3. Click **Load unpacked**
4. Select the `tc-analyzer/` folder (the root folder containing `manifest.json`)
5. The extension will appear in your toolbar — pin it for easy access

**To reload after making code changes:**
- Go back to `chrome://extensions`
- Click the refresh icon (↺) on the T&C Analyzer card
- You do **not** need to re-unpack unless you change `manifest.json`

---

## How to Use

1. Navigate to any page with Terms & Conditions
2. A small toast notification appears near the top-right of the page pointing to the extension icon
3. Click the **T&C Analyzer icon** in your toolbar
4. The popup opens — click **Analyze Now**
5. Wait 5–15 seconds for the analysis to complete
6. The popup shows a color-coded severity banner, a plain-language summary, and clause counts
7. Click **View Full Analysis** for the detailed breakdown with individual flagged clauses

**Tips:**
- Pin the extension to your toolbar for quick access (puzzle piece icon → pin T&C Analyzer)
- The badge on the icon updates: amber `!` = detected, colored `!` or `✓` = analysis complete
- If a T&C is very long, a truncation warning will appear — the analysis covers the first ~40,000 characters
- The extension will not fire on Google, Bing, or other search engine results pages

---

## Technical Notes

### Content Extraction

The extension uses `textContent` (not `innerText`) to capture text from collapsed accordion sections without needing to open them. It also programmatically clicks accordion triggers that pass a safety check before extracting — this handles sites like the YMCA that nest policies inside expandable headers.

The safety check prevents clicking navigation elements, search bars, or anything outside the main content area that could trigger page navigation.

### Token & Cost Management

At the default `MAX_INPUT_CHARS: 40000`, each analysis costs roughly $0.01–0.02 with DeepSeek V3. Google's ToS (~80k characters) will be truncated; most real-world T&Cs fall within the 40k limit.

To increase the limit, change `MAX_INPUT_CHARS` in `config.js`. Setting it to `80000` covers nearly all documents at ~$0.02–0.04 per analysis.

### Prompt Design

The analysis prompt uses an explicit severity taxonomy with numbered rules to prevent the model from being too lenient. Key design decisions:

- Indemnification clauses are hardcoded as RED regardless of wording
- Photo/likeness rights are hardcoded as YELLOW regardless of wording
- "Effective immediately upon posting" is explicitly RED, not standard
- The model is instructed to round up severity when in doubt, not down
- `overallSeverity` reflects the single worst clause found, not an average

### Architecture

- **Toast → Popup flow:** The toast only directs the user to the extension icon. All analysis logic runs inside the popup (which has full access to `config.js` and the analyzer). This avoids Chrome's restriction on content scripts making external API calls.
- **Background service worker:** Handles badge updates and stores results in `chrome.storage.session` keyed by tab ID. Results persist until the tab navigates away.
- **Shadow DOM toast:** The toast is injected using Shadow DOM to isolate its styles from the host page, preventing conflicts with site CSS.

---

## Known Limitations

- **Truncation:** Documents longer than `MAX_INPUT_CHARS` are cut off. A warning is shown when this occurs.
- **Dynamic content:** T&C loaded via JavaScript after page load (lazy-loaded) may not be captured on first run. Reloading the page usually resolves this.
- **External PDFs:** Linked PDF documents are not analyzed. Phase 3 roadmap item.
- **Not legal advice:** This is an AI-assisted summary tool. It is not a substitute for legal review.

---

## Roadmap

- [x] MVP: Detection, extraction, LLM analysis, color-coded results
- [x] Accordion/collapsed section support
- [x] Toast notification with toolbar guidance
- [x] Dynamic severity-colored UI
- [ ] PDF support for externally linked T&C documents
- [ ] Caching to avoid re-analyzing identical documents
- [ ] Options page for user-provided API key (required for Chrome Web Store publication)
- [ ] Chrome Web Store publication

---

## Publishing to the Chrome Web Store

This extension is not currently listed on the Chrome Web Store. To publish it publicly:

1. Move the API key to a user-facing options page (hardcoded keys violate Web Store policy)
2. Pay the one-time $5 Google developer registration fee
3. Package the extension via `chrome://extensions` → Pack Extension
4. Submit via the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole) with screenshots and a privacy policy
5. Wait 1–3 days for Google's review

---

## Disclaimer

T&C Analyzer is an informational tool built to help everyday users understand what they're agreeing to. It does not provide legal advice. Always review important agreements in full before accepting them. Analysis accuracy depends on the quality of text extraction and the LLM's output — treat results as a starting point, not a definitive ruling.
