export const FUNDING_PROGRAMS = [
  "LIHTC",
  "HPD",
  "HCR",
  "ESD",
  "HUD",
  "Fannie/Freddie",
  "Other",
] as const;

export type FundingProgram = (typeof FUNDING_PROGRAMS)[number];

export interface DealFormData {
  projectName: string;
  developerName: string;
  loanType: string;
  borough: string;
  totalUnits: string;
  totalDevelopmentCost: string;
  requestedLoanAmount: string;
  fundingPrograms: string[];
  additionalNotes: string;
}

export const EMPTY_DEAL_FORM: DealFormData = {
  projectName: "",
  developerName: "",
  loanType: "",
  borough: "",
  totalUnits: "",
  totalDevelopmentCost: "",
  requestedLoanAmount: "",
  fundingPrograms: [],
  additionalNotes: "",
};

export function formatFundingPrograms(programs: string[]): string {
  return programs.length > 0 ? programs.join(", ") : "[Not provided]";
}

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
    "",
    "FINANCIALS",
    `Total Development Cost: ${formData.totalDevelopmentCost || "[Not provided]"}`,
    `Requested Loan Amount: ${formData.requestedLoanAmount || "[Not provided]"}`,
    "",
    "FUNDING PROGRAMS",
    `Programs: ${formatFundingPrograms(formData.fundingPrograms)}`,
    "",
    "ADDITIONAL NOTES",
    formData.additionalNotes || "[None]",
  ];
  return lines.join("\n");
}
