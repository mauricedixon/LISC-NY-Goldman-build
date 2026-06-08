export type TermSheetGuidePhase = "essential" | "extended";

/** Full guide JSON schema (legacy / docs). */
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

export const TERM_SHEET_GUIDE_ESSENTIAL_JSON_SCHEMA = `{
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
          "priority": "required" | "conditional" | "informational",
          "tier": "essential"
        }
      ]
    }
  ]
}`;

export const TERM_SHEET_GUIDE_EXTENDED_JSON_SCHEMA = `{
  "sections": [
    {
      "title": "Section name (e.g. Environmental Review, Design / Construction / Sustainability, Regulatory Agreement)",
      "items": [
        {
          "item": "Short label",
          "requirement": "One concise sentence with the requirement",
          "citation": "Exact citation including [Source: Agency - Title, Page N]",
          "programs": ["Optional — only when program-specific"],
          "priority": "required" | "conditional" | "informational",
          "tier": "extended"
        }
      ]
    }
  ]
}`;

export const TERM_SHEET_GUIDE_ESSENTIAL_GUIDANCE = `Generate ONLY the essential tier of a term sheet guide grounded ONLY in the rulebook excerpts.

Structure:
1. summary — 1-2 sentences on the highest-signal requirements.
2. keyThresholds — 4-8 numeric or concrete thresholds (LTV, DSCR, equity, fees, set-asides, rates, reserves). Do not repeat these verbatim in section items.
3. sections — up to 4 sections. Every item MUST have tier: "essential".

ESSENTIAL items (hard cap: ≤12 items total):
- Loan terms, equity minimums, core closing conditions, top program eligibility rules
- Items with priority "required" that belong on every term sheet
- Only the highest-signal rules an underwriter needs at a glance

Section order when supported:
Loan Terms → Equity / Capital Stack → Closing → Program Requirements

Rules:
- Do NOT include extended-tier topics (environmental, design/construction detail, monitoring procedures).
- Every item must include tier: "essential" and a citation when possible.
- Do not duplicate keyThresholds content in section items.
- Do not invent thresholds — omit if not in excerpts.`;

export const TERM_SHEET_GUIDE_EXTENDED_GUIDANCE = `Generate ONLY the extended tier checklist items grounded ONLY in the rulebook excerpts.

You are adding the "full checklist" layer. Do NOT repeat summary, keyThresholds, or essential-tier items.

Structure:
- sections — up to 6 sections. Every item MUST have tier: "extended".

EXTENDED items (target 10-18 items total):
- Environmental review, design/construction/sustainability, regulatory agreement detail
- Pre-closing reviews and approvals, monitoring, informational procedures
- Items with priority "conditional" or "informational" unless critically required

Section order when supported:
Environmental Review → Design / Construction / Sustainability → Regulatory Agreement → Pre-Closing / Monitoring

Rules:
- Every item must include tier: "extended" and a citation when possible.
- Do not duplicate essential-tier content.
- Do not invent requirements — omit if not in excerpts.`;

export function getTermSheetGuidePromptParts(phase: TermSheetGuidePhase): {
  jsonSchema: string;
  fieldGuidance: string;
} {
  if (phase === "extended") {
    return {
      jsonSchema: TERM_SHEET_GUIDE_EXTENDED_JSON_SCHEMA,
      fieldGuidance: TERM_SHEET_GUIDE_EXTENDED_GUIDANCE,
    };
  }
  return {
    jsonSchema: TERM_SHEET_GUIDE_ESSENTIAL_JSON_SCHEMA,
    fieldGuidance: TERM_SHEET_GUIDE_ESSENTIAL_GUIDANCE,
  };
}
