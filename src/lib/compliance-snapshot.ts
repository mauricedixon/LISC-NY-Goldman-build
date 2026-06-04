import type { DealFormData } from "@/types/deal";
import type { AnalysisResult, CompletenessChecklistItem } from "@/types/wizard";

export function computeAnalysisSummary(analysis: AnalysisResult) {
  const checklist = analysis.completenessChecklist ?? [];
  const flags = analysis.complianceFlags ?? [];

  const provided = checklist.filter((i) => i.status === "provided").length;
  const missing = checklist.filter((i) => i.status === "missing").length;
  const needsClarification = checklist.filter((i) => i.status === "needs_clarification").length;
  const highFlags = flags.filter((f) => f.severity === "High").length;

  return {
    provided,
    missing,
    needsClarification,
    flagCount: flags.length,
    highFlags,
  };
}

export function buildDealIdentityLine(
  formData: DealFormData,
  loanType: string,
  agencyNames: string[]
): string {
  const parts: string[] = [];

  const project = formData.projectName?.trim();
  if (project) parts.push(project);

  const borough = formData.borough?.trim();
  if (borough) parts.push(borough);

  parts.push(loanType || formData.loanType || "Loan type TBD");

  if (agencyNames.length > 0) {
    parts.push(`vs. ${agencyNames.join(", ")}`);
  }

  return parts.join(" · ");
}

export function parameterStatusLabel(status: CompletenessChecklistItem["status"]): string {
  if (status === "provided") return "Adequate";
  if (status === "missing") return "Missing";
  return "Needs clarification";
}

export function parameterStatusTone(status: CompletenessChecklistItem["status"]): string {
  if (status === "provided") return "text-emerald-700 bg-emerald-50 border-emerald-100";
  if (status === "missing") return "text-red-700 bg-red-50 border-red-100";
  return "text-amber-700 bg-amber-50 border-amber-100";
}

/** Fingerprint of inputs used for a given analysis run (stale detection). */
export function buildAnalysisInputFingerprint(
  formData: DealFormData,
  loanType: string,
  agencyIds: string[]
): string {
  return JSON.stringify({
    formData,
    loanType,
    agencies: [...agencyIds].sort(),
  });
}
