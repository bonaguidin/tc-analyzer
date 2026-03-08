--- OUTDATED README BUT NEEDED FOR THE MANIFEST FILE STRUCUTE ---

# ⚖️ T&C Analyzer — Chrome Extension

A Chrome extension that automatically detects Terms & Conditions pages and modals, extracts the text, and uses an LLM to flag potentially harmful clauses — color-coded, plain-language, no copy-pasting required.

---

## Features

- **Auto-detection** — identifies T&C pages and modals as you browse
- **One-click analysis** — sends the text to DeepSeek V3 via OpenRouter
- **Color-coded summary** popup for a quick gut-check
- **Detailed results tab** with filterable clause cards
- **Truncation warnings** when a document is too long to fully analyze

**Clause severity levels:**
- 🔴 **Alarming** — data selling, binding arbitration, perpetual licenses, monitoring
- 🟡 **Caution** — vague affiliate sharing, auto-renewal traps, forced jurisdiction
- 🟢 **Standard** — cookies, basic analytics, payment processor data sharing

---

## Setup

### 1. Get an OpenRouter API key
Sign up at [openrouter.ai](https://openrouter.ai) and create an API key.

### 2. Configure the extension
```bash
cp config.example.js config.js
```
Open `config.js` and replace `YOUR_OPENROUTER_API_KEY_HERE` with your real key.

> ⚠️ `config.js` is gitignored. Never commit it.

### 3. Install the pre-commit hook (recommended)
```bash
cp .git-hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```
This will block any commit that accidentally includes `config.js` or a raw API key.

### 4. Load the extension in Chrome
1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `tc-analyzer/` folder

---

## Usage

1. Navigate to any page with Terms & Conditions
2. The extension icon will show a **yellow badge** when T&C is detected
3. Click the icon → click **Analyze Now**
4. A quick summary appears in the popup
5. Click **View Full Analysis** for the detailed results tab

---

## Project Structure

```
tc-analyzer/
├── manifest.json          # Chrome extension manifest v3
├── background.js          # Service worker: badge + tab management
├── content.js             # Page injection: T&C detection + extraction
├── config.js              # ⚠️ API key (gitignored — do not commit)
├── config.example.js      # Safe template (committed)
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── results/
│   ├── results.html
│   ├── results.js
│   └── results.css
├── lib/
│   └── analyzer.js        # OpenRouter API call + prompt logic
└── icons/
```

---

## Tech Stack

- **Platform:** Chrome Extension (Manifest V3)
- **LLM:** DeepSeek V3 via [OpenRouter](https://openrouter.ai)
- **Content extraction:** DOM scraping (no external dependencies)

---

## Known Limitations

- **Truncation:** T&C documents longer than ~12,000 characters are truncated before analysis. A warning is shown when this occurs.
- **Dynamic content:** T&C loaded via JavaScript after page load may not always be captured. A page reload often fixes this.
- **External PDFs:** Linked PDF documents are not analyzed in this version.
- **Not legal advice:** This tool provides an AI-assisted summary for general awareness only. It is not a substitute for legal review.

---

## Roadmap

- [ ] Improved modal detection across more site patterns
- [ ] Caching to avoid re-analyzing identical documents
- [ ] PDF support for externally linked T&C documents
- [ ] Options page for user-provided API key

---

## Disclaimer

T&C Analyzer is an informational tool. It does not provide legal advice. Always review important agreements in full before accepting them.
