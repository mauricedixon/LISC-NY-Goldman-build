/** Shared JSON schema fragment for analyze + synthesize routes. */
export const ANALYSIS_JSON_SCHEMA = `{
  "executiveSummary": "2-4 sentence executive summary for the underwriter highlighting completeness and top compliance risks",
  "actionItems": [
    {
      "item": "Specific, actionable next step for the underwriter",
      "priority": "high" | "medium" | "low"
    }
  ],
  "completenessChecklist": [
    {
      "field": "Human-readable field name",
      "status": "provided" | "missing" | "needs_clarification",
      "note": "Optional short note, especially for needs_clarification items"
    }
  ],
  "complianceFlags": [
    {
      "issue": "Description of the violation or concern",
      "citation": "Exact citation from the rulebook including source and page number (use format [Source: Agency - Title, Page N])",
      "severity": "High" | "Medium" | "Low"
    }
  ]
}`;

export const ANALYSIS_FIELD_GUIDANCE = `Provide 3-6 actionItems ordered by priority (most urgent first).
For the completenessChecklist, evaluate these standard fields: Project Name, Developer/Sponsor, Loan Type, Borough/Location, Total Units, Affordable Units, AMI Targets, Total Development Cost, Requested Loan Amount, LTV, DSCR, Other Funding Sources.
A field is "provided" if a real value was given, "missing" if it was left blank or says [Not provided], and "needs_clarification" if the value seems incomplete, inconsistent, or unusual.`;
