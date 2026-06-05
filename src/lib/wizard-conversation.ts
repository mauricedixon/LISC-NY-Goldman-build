import type { DealFieldKey } from "@/lib/wizard-form-sync";
import type { WizardAnswer, WizardQuestion } from "@/types/wizard";

export interface FollowUpQuestion extends WizardQuestion {
  /** Stable id for deduplication (e.g. followup_unit_mix_gap). */
  followUpKey: string;
  /** Where the follow-up answer should be stored. */
  storeInField: DealFieldKey;
  /** Merge into existing field value vs replace. */
  mergeMode: "append" | "replace";
}

export function getAnswerByField(
  answers: WizardAnswer[],
  questions: WizardQuestion[],
  field: string
): string | undefined {
  for (const q of questions) {
    if (q.field !== field) continue;
    const answer = answers.find((a) => a.questionId === q.id);
    if (answer && !answer.skipped && answer.value.trim()) {
      return answer.value.trim();
    }
  }
  return undefined;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const n = parseFloat(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Brief acknowledgment after the user answers a main interview question. */
export function buildAcknowledgment(
  question: WizardQuestion,
  answerValue: string,
  answers: WizardAnswer[],
  questions: WizardQuestion[]
): string {
  const v = answerValue.trim();
  const field = question.field;

  switch (field) {
    case "projectName":
      return `Got it — **${v}**.`;
    case "developerName":
      return `Thanks — noted **${v}** as the sponsor.`;
    case "loanType":
      return `Confirmed — **${v}** loan.`;
    case "borough":
      return `Noted — **${v}**.`;
    case "totalUnits": {
      const n = parseNumber(v);
      return n != null ? `**${n}** total units — thanks.` : `Total units recorded.`;
    }
    case "totalDevelopmentCost":
      return `TDC **${v}** — recorded.`;
    case "requestedLoanAmount":
      return `Requested loan **${v}** — noted.`;
    case "additionalNotes":
      return `Additional notes captured.`;
    default:
      return `Got it — thanks.`;
  }
}

/**
 * Rule-based follow-up after a main question, if applicable and not already asked.
 */
export function getFollowUpQuestion(
  triggerQuestion: WizardQuestion,
  answerValue: string,
  answers: WizardAnswer[],
  questions: WizardQuestion[],
  completedFollowUpKeys: Set<string>
): FollowUpQuestion | null {
  void triggerQuestion;
  void answerValue;
  void answers;
  void questions;
  void completedFollowUpKeys;
  return null;
}

export function applyFollowUpAnswer(
  existing: string | undefined,
  followUp: FollowUpQuestion,
  answer: string
): string {
  const trimmed = answer.trim();
  if (!trimmed) return existing ?? "";
  if (followUp.mergeMode === "append") {
    const prefix = existing?.trim() ? `${existing.trim()}\n` : "";
    return `${prefix}[${followUp.category}] ${trimmed}`;
  }
  return trimmed;
}

/** Strip markdown bold markers for plain chat display. */
export function plainAcknowledgment(text: string): string {
  return text.replace(/\*\*/g, "");
}
