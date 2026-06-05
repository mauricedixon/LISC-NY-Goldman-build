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
      "title": "Section name (e.g. Loan Terms, Equity, Closing, Program Requirements, Environmental Review)",
      "items": [
        {
          "item": "Short label",
          "requirement": "One concise sentence with the requirement",
          "citation": "Exact citation including [Source: Agency - Title, Page N]",
          "programs": ["Optional — only when program-specific"],
          "priority": "required" | "conditional" | "informational",
          "tier": "essential" | "extended"
        }
      ]
    }
  ]
}`;

export const TERM_SHEET_GUIDE_FIELD_GUIDANCE = `Build a two-tier term sheet guide grounded ONLY in the rulebook excerpts.

Structure:
1. keyThresholds — 4-8 numeric or concrete thresholds (LTV, DSCR, equity, fees, set-asides, rates, reserves). Do not repeat these verbatim in section items.
2. sections — up to 6 sections. Each item MUST include tier: "essential" or "extended".

ESSENTIAL tier (default view — max 12 items total across all sections):
- Loan terms, equity minimums, core closing conditions, top program eligibility rules
- Items with priority "required" that belong on every term sheet
- Only the highest-signal rules an underwriter needs at a glance

EXTENDED tier (full checklist — additional 10-18 items):
- Environmental review, design/construction/sustainability, regulatory agreement detail
- Pre-closing reviews and approvals, monitoring, informational procedures
- Items with priority "conditional" or "informational" unless critically required

Section order when supported:
Loan Terms → Equity / Capital Stack → Closing → Program Requirements → Environmental Review → Design / Construction / Sustainability

Priority rules:
- "required" — mandatory; usually tier "essential"
- "conditional" — tier "extended" unless deal-critical
- "informational" — tier "extended"

Rules:
- Hard cap: ≤12 essential items, ≤18 extended items (30 total max).
- Every item must include tier and a citation when possible.
- Do not duplicate keyThresholds content in section items.
- Do not invent thresholds — omit if not in excerpts.`;
