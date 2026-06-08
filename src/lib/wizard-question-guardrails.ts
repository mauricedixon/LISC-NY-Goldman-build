import { buildFallbackQuestions } from "@/lib/wizard-fallback";
import type { WizardQuestion } from "@/types/wizard";

/** Topics that belong on a different field — enrichment often mis-assigns these. */
const FIELD_MISUSE_PATTERNS: Record<string, RegExp[]> = {
  loanType: [/4\s*%|9\s*%|lihtc\s*(credit|type|band)/i, /tax-exempt bond/i, /ami band/i],
  totalUnits: [/set-aside/i, /20\s*\/\s*50/i, /40\s*\/\s*60/i, /80\s*%?\s*ami/i],
  developerName: [/for-profit or nonprofit/i],
  borough: [/set-aside/i, /lihtc/i],
  totalDevelopmentCost: [/leverage/i, /loan amount/i],
  requestedLoanAmount: [/tdc/i, /development cost/i],
};

function fallbackByField(loanType: string): Map<string, WizardQuestion> {
  const map = new Map<string, WizardQuestion>();
  for (const q of buildFallbackQuestions(loanType)) {
    if (!map.has(q.field)) map.set(q.field, q);
  }
  return map;
}

function questionText(q: WizardQuestion): string {
  return `${q.question} ${q.helpText ?? ""}`;
}

/**
 * Reset question/helpText to safe fallback copy when enrichment mismatches field semantics.
 */
export function applyQuestionGuardrails(
  questions: WizardQuestion[],
  loanType: string
): WizardQuestion[] {
  const fallbacks = fallbackByField(loanType);

  return questions.map((q) => {
    const patterns = FIELD_MISUSE_PATTERNS[q.field];
    if (!patterns?.some((p) => p.test(questionText(q)))) {
      return q;
    }

    const fb = fallbacks.get(q.field);
    if (!fb) return q;

    return {
      ...q,
      question: fb.question,
      helpText: fb.helpText ?? q.helpText,
      inputType: fb.inputType ?? q.inputType,
      options: fb.options ?? q.options,
      required: fb.required ?? q.required,
    };
  });
}
