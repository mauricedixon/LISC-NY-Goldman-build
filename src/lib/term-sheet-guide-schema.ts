/** Shared JSON schema fragment for the term sheet guide route. */
export const TERM_SHEET_GUIDE_JSON_SCHEMA = `{
  "summary": "1-2 sentence overview of the most important term sheet requirements",
  "keyThresholds": [
    {
      "label": "Short label (e.g. Maximum LTV, Minimum DSCR, Equity Minimum)",
      "value": "Concrete threshold or requirement (e.g. 85%, 1.15x, 15% of TDC)",
      "citation": "Exact citation including [Source: Agency - Title, Page N]"
    }
  ],
  "sections": [
    {
      "title": "Section name (e.g. Loan Terms, Equity, Closing, Program Requirements)",
      "items": [
        {
          "item": "Short label",
          "requirement": "One concise sentence with the requirement",
          "citation": "Exact citation including [Source: Agency - Title, Page N]",
          "programs": ["Optional — only when program-specific"],
          "priority": "required" | "conditional" | "informational"
        }
      ]
    }
  ]
}`;

export const TERM_SHEET_GUIDE_FIELD_GUIDANCE = `Build a concise, scannable term sheet guide grounded ONLY in the rulebook excerpts.

Structure:
1. keyThresholds — 4-8 numeric or concrete thresholds underwriters need at a glance (LTV, DSCR, equity, rates, reserves, etc.). Omit if not in excerpts.
2. sections — at most 4 sections, 2-4 items each (hard cap ~14 checklist items total).

Section order when supported: Loan Terms → Equity / Capital Stack → Closing → Program Requirements.

Priority rules:
- "required" — must appear on term sheet / mandatory program rule
- "conditional" — applies in certain deal structures
- "informational" — helpful context, not a hard threshold

Rules:
- Every item must include a citation when possible.
- Keep requirement text to one sentence.
- Tag programs only when the item is program-specific.
- Do not invent thresholds — omit if not in excerpts.
- Prioritize selected funding programs and loan type.`;
