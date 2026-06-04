export type WizardInputType = "text" | "number" | "select" | "textarea";

export interface WizardQuestion {
  id: string;
  category: string;
  field: string;
  question: string;
  helpText?: string;
  inputType: WizardInputType;
  options?: string[];
  required: boolean;
}

export interface WizardAnswer {
  questionId: string;
  value: string;
  skipped: boolean;
}

export interface WizardSession {
  questions: WizardQuestion[];
  answers: WizardAnswer[];
  currentIndex: number;
}

export interface CompletenessChecklistItem {
  field: string;
  status: "provided" | "missing" | "needs_clarification";
  note?: string;
}

export interface ComplianceFlag {
  issue: string;
  citation: string;
  severity: "High" | "Medium" | "Low";
}

export interface ActionItem {
  item: string;
  priority?: "high" | "medium" | "low";
}

export interface AnalysisResult {
  executiveSummary?: string;
  actionItems?: ActionItem[];
  completenessChecklist: CompletenessChecklistItem[];
  complianceFlags: ComplianceFlag[];
}
