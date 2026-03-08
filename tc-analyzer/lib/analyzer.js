// lib/analyzer.js
// Handles all LLM interaction. Imported by popup.js.
// Truncates input, builds the prompt, calls OpenRouter, parses the response.

// ─── Prompt ───────────────────────────────────────────────────────────────
function buildPrompt(tcText) {
  return `You are a consumer-protection legal analyst. Your job is to identify clauses in Terms & Conditions documents that could harm, surprise, or disadvantage an average user. You default to flagging when in doubt — missing a harmful clause is a worse outcome than flagging something borderline.

Analyze the following Terms & Conditions text and return a JSON object ONLY — no markdown, no explanation, no preamble.

═══ SEVERITY TAXONOMY ═══

🔴 RED — Genuinely alarming. Flag these always.
- Selling or sharing personal data with third parties for their own use, with no opt-out
- Binding arbitration clauses (waives the user's right to sue or join class actions)
- Class action waiver (explicitly bars joining a class action lawsuit)
- Right to monitor, record, or access private communications or device activity
- Perpetual, irrevocable license to user content (company keeps rights forever even after you leave)
- Unilateral right to change terms at any time without prior notice ("we may update these terms at any time")
- Policy changes effective immediately upon posting, without notification
- Retaining user data indefinitely after account deletion
- Excessive or continuous location tracking beyond core app function
- Broad indemnification clause — user agrees to cover the company's legal costs and liability

🟡 YELLOW — Worth knowing. Flag these always.
- Vague data sharing with "affiliates," "partners," or "third parties" without specifics
- Photo, video, likeness, or voice rights granted to the company for promotional use
- Auto-renewal subscriptions with unclear or buried cancellation terms
- Broad IP or copyright ownership over user-generated content
- Cross-site or cross-app behavioral tracking
- Right to suspend or terminate account without cause or notice
- Forced jurisdiction or venue (requires disputes to be handled in a specific location)
- Liability cap or disclaimer of warranties that significantly limits user recourse
- Age-related data collection (collecting data on minors)
- Right to share data with law enforcement beyond legal requirements

🟢 GREEN — Standard practice, basically fine. Only include these if no red/yellow clauses exist.
- Standard cookie usage for site functionality
- Basic anonymized analytics to improve the service
- Sharing data with payment processors solely to complete transactions
- Standard copyright notice over the company's own content

═══ OUTPUT FORMAT ═══

Return this exact JSON structure:
{
  "overallSeverity": "red" | "yellow" | "green",
  "summary": "2-3 sentence plain English summary written for a non-lawyer. Name the most important findings directly. Do not say 'this document' — say what the company actually does.",
  "truncated": false,
  "clauses": [
    {
      "severity": "red" | "yellow" | "green",
      "title": "Short clause name (e.g. 'Binding Arbitration', 'Likeness Rights', 'Indemnification')",
      "explanation": "1-2 sentences explaining what this means for the user in plain English. Be specific about the real-world impact.",
      "quote": "Short relevant excerpt from the original text (max 100 chars), or null if not applicable"
    }
  ]
}

═══ RULES ═══

1. overallSeverity = the single worst severity level found. One red clause makes it red. One yellow clause (with no red) makes it yellow. Only return green if truly nothing concerning exists.
2. Flag every clause that matches the taxonomy above — do not skip or consolidate them.
3. Only include clauses actually present in the text. Do not hallucinate or infer things not written.
4. Order clauses: red first, then yellow, then green.
5. When in doubt between yellow and green, choose yellow. When in doubt between red and yellow, choose yellow. Do not round down.
6. "Effective immediately upon posting" or "we may change these terms at any time" = RED. This is not standard and not acceptable.
7. Indemnification clauses are RED regardless of how routine they appear — they shift significant legal liability to the user.
8. Photo/likeness/media release clauses are YELLOW regardless of how casually they are worded.
9. The "truncated" field must always be false — the caller sets the real value.
10. If no clauses are found at all, return an empty array and overallSeverity "green".

Terms & Conditions text:
---
${tcText}
---`;
}

// ─── Main Analyzer Function ───────────────────────────────────────────────
async function analyzeTCText(rawText) {
  const wasTruncated = rawText.length > CONFIG.MAX_INPUT_CHARS;
  const inputText = wasTruncated
    ? rawText.slice(0, CONFIG.MAX_INPUT_CHARS) + "\n\n[TEXT TRUNCATED DUE TO LENGTH]"
    : rawText;

  const prompt = buildPrompt(inputText);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://github.com/tc-analyzer-extension",
      "X-Title": "T&C Analyzer",
    },
    body: JSON.stringify({
      model: CONFIG.MODEL,
      max_tokens: CONFIG.MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1, // Low temp for consistent structured output
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;

  if (!rawContent) {
    throw new Error("Empty response from model.");
  }

  // Strip markdown fences if the model wrapped the JSON anyway
  const cleaned = rawContent.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Failed to parse model response as JSON: ${e.message}\n\nRaw: ${cleaned}`);
  }

  // Stamp truncation flag from our side (model can't know this)
  parsed.truncated = wasTruncated;

  return parsed;
}
