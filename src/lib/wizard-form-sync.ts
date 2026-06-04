import type { DealFormData } from "@/types/deal";
import type { WizardAnswer, WizardQuestion } from "@/types/wizard";

export type DealFieldKey = keyof DealFormData;

/** Returns only fields with captured wizard answers (for merging into existing form state). */
export function applyWizardAnswersToFormData(
  questions: WizardQuestion[],
  answers: WizardAnswer[],
  loanType: string
): Partial<DealFormData> {
  const patch: Partial<DealFormData> = { loanType };
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));

  for (const q of questions) {
    const answer = answerMap.get(q.id);
    if (!answer || answer.skipped || !answer.value.trim()) continue;
    const key = q.field as DealFieldKey;
    patch[key] = answer.value.trim();
  }

  return patch;
}
