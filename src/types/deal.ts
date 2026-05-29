export interface DealFormData {
  projectName: string;
  developerName: string;
  loanType: string;
  borough: string;
  totalUnits: string;
  affordableUnits: string;
  targetAMI: string;
  totalDevelopmentCost: string;
  requestedLoanAmount: string;
  ltv: string;
  dscr: string;
  otherFundingSources: string;
  additionalNotes: string;
}

export const EMPTY_DEAL_FORM: DealFormData = {
  projectName: "",
  developerName: "",
  loanType: "",
  borough: "",
  totalUnits: "",
  affordableUnits: "",
  targetAMI: "",
  totalDevelopmentCost: "",
  requestedLoanAmount: "",
  ltv: "",
  dscr: "",
  otherFundingSources: "",
  additionalNotes: "",
};

export function buildDealSummary(formData: DealFormData): string {
  const lines = [
    "AFFORDABLE HOUSING DEAL SUMMARY",
    "",
    `Project Name: ${formData.projectName || "[Not provided]"}`,
    `Developer / Sponsor: ${formData.developerName || "[Not provided]"}`,
    `Loan Type: ${formData.loanType || "[Not provided]"}`,
    `Borough: ${formData.borough || "[Not provided]"}`,
    "",
    "UNIT MIX",
    `Total Units: ${formData.totalUnits || "[Not provided]"}`,
    `Affordable Units: ${formData.affordableUnits || "[Not provided]"}`,
    `AMI Targets: ${formData.targetAMI || "[Not provided]"}`,
    "",
    "FINANCIALS",
    `Total Development Cost: ${formData.totalDevelopmentCost || "[Not provided]"}`,
    `Requested Loan Amount: ${formData.requestedLoanAmount || "[Not provided]"}`,
    `Loan-to-Value (LTV): ${formData.ltv ? formData.ltv + "%" : "[Not provided]"}`,
    `Debt Service Coverage Ratio (DSCR): ${formData.dscr || "[Not provided]"}`,
    "",
    "OTHER SOURCES",
    `Other Funding Sources: ${formData.otherFundingSources || "[Not provided]"}`,
    "",
    "ADDITIONAL NOTES",
    formData.additionalNotes || "[None]",
  ];
  return lines.join("\n");
}
