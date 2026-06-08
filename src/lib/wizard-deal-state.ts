import type { WizardQuestion } from "@/types/wizard";

const FIELD_LABELS: Record<string, string> = {
  projectName: "project name",
  developerName: "sponsor",
  loanType: "loan type",
  borough: "borough",
  totalUnits: "total units",
  totalDevelopmentCost: "TDC",
  requestedLoanAmount: "loan amount",
  additionalNotes: "additional notes",
};

/** Compact hint for Haiku: which main questions are still queued. */
export function buildOpenGapsSummary(
  remainingQuestionIds: string[],
  questions: WizardQuestion[]
): string | undefined {
  if (!remainingQuestionIds.length) return undefined;

  const labels: string[] = [];
  for (const id of remainingQuestionIds) {
    const field = questions.find((q) => q.id === id)?.field;
    if (field && FIELD_LABELS[field]) {
      labels.push(FIELD_LABELS[field]);
    }
  }

  if (!labels.length) return undefined;

  const unique = [...new Set(labels)];
  return `Still on the interview queue: ${unique.join(", ")}. Do not clarify those topics now — they will be asked as main questions.`;
}
