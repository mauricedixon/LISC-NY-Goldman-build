/** Shared JSON schema fragment for the term sheet guide route. */
export const TERM_SHEET_GUIDE_JSON_SCHEMA = `{
  "summary": "2-3 sentence overview of key term sheet requirements for this program stack",
  "sections": [
    {
      "title": "Section name (e.g. Loan Terms, Equity, Closing, Program Requirements)",
      "items": [
        {
          "item": "Short label (e.g. Maximum LTV, Minimum DSCR)",
          "requirement": "Concrete requirement or threshold from the rulebooks",
          "citation": "Exact citation including [Source: Agency - Title, Page N]",
          "programs": ["Optional list of which funding programs this applies to"]
        }
      ]
    }
  ]
}`;

export const TERM_SHEET_GUIDE_FIELD_GUIDANCE = `Build a structured term sheet checklist grounded ONLY in the rulebook excerpts.
Include sections covering, where supported by the excerpts:
- Loan Terms (LTV, DSCR, rate caps, amortization, term length)
- Equity / Capital Stack (equity minimums, subordination, LIHTC equity structure)
- Closing Requirements (conditions precedent, reserves, insurance)
- Program Requirements (program-specific thresholds per selected funding program)

Rules:
- Provide 4-7 sections with 2-6 items each when rulebook content supports it.
- Every item must include a citation from the excerpts when possible.
- Tag items with applicable programs in the "programs" array when program-specific.
- If a requirement is not found in excerpts, omit it — do not invent thresholds.
- Prioritize requirements for the selected funding programs and loan type.`;
