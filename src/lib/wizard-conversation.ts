import type { DealFieldKey } from "@/lib/wizard-form-sync";
import type { WizardAnswer, WizardQuestion } from "@/types/wizard";

export interface WizardConversationContext {
  fundingPrograms?: string[];
  loanType?: string;
}

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

function parseMoney(value: string | undefined): number | null {
  return parseNumber(value);
}

/** Opening assistant message when guided review starts. */
export function buildOpeningMessage(context: WizardConversationContext): string {
  const programs = context.fundingPrograms?.filter(Boolean) ?? [];
  const loan = context.loanType?.trim();

  if (programs.length > 0 && loan) {
    return `Quick context on your **${programs.join(" + ")}** **${loan}** deal — a few short questions, not a term sheet review.`;
  }
  if (programs.length > 0) {
    return `Quick context on your **${programs.join(" + ")}** deal — a few short questions, not a term sheet review.`;
  }
  if (loan) {
    return `Quick context on this **${loan}** deal — a few short questions to capture basics.`;
  }
  return `Quick context pass — a few short questions to capture deal basics.`;
}

/** Brief transition when interview moves to a new category. */
export function buildCategoryTransition(
  previousCategory: string | undefined,
  nextCategory: string
): string | null {
  if (!previousCategory || previousCategory === nextCategory) return null;

  const transitions: Record<string, string> = {
    "Unit Mix": "Let's talk unit mix.",
    Financials: "Now — a few financials.",
    Additional: "Almost done — anything else to note?",
    Compliance: "A couple compliance items.",
  };

  return transitions[nextCategory] ?? `Moving on to **${nextCategory}**.`;
}

/** Brief acknowledgment after the user answers a main interview question. */
export function buildAcknowledgment(
  question: WizardQuestion,
  answerValue: string,
  answers: WizardAnswer[],
  questions: WizardQuestion[],
  _context?: WizardConversationContext
): string {
  const v = answerValue.trim();
  const field = question.field;
  const project = getAnswerByField(answers, questions, "projectName");

  switch (field) {
    case "projectName":
      return `Got it — **${v}**.`;
    case "developerName":
      return project
        ? `Thanks — **${v}** on **${project}**.`
        : `Thanks — noted **${v}** as the sponsor.`;
    case "loanType":
      return `Confirmed — **${v}** loan.`;
    case "borough":
      return project
        ? `**${v}** for **${project}** — noted.`
        : `Noted — **${v}**.`;
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

function makeNotesFollowUp(
  key: string,
  category: string,
  question: string,
  helpText?: string,
  required = false
): FollowUpQuestion {
  return {
    id: key,
    followUpKey: key,
    category,
    field: "additionalNotes",
    storeInField: "additionalNotes",
    mergeMode: "append",
    question,
    helpText,
    inputType: "textarea",
    required,
  };
}

/**
 * Rule-based follow-up after a main question, if applicable and not already asked.
 */
export function getFollowUpQuestion(
  triggerQuestion: WizardQuestion,
  answerValue: string,
  answers: WizardAnswer[],
  questions: WizardQuestion[],
  completedFollowUpKeys: Set<string>,
  context: WizardConversationContext = {}
): FollowUpQuestion | null {
  const field = triggerQuestion.field;
  const value = answerValue.trim();
  const programs = context.fundingPrograms ?? [];

  if (field === "borough" && programs.includes("HPD")) {
    const key = "followup_hpd_setasides";
    if (!completedFollowUpKeys.has(key)) {
      return makeNotesFollowUp(
        key,
        "Compliance",
        "Any HPD set-asides or program requirements to flag?",
        "Optional — captures deal-specific HPD context for the rulebook check."
      );
    }
  }

  if (field === "totalUnits") {
    const n = parseNumber(value);
    if (n != null && (n > 250 || n < 10)) {
      const key = "followup_unit_scale";
      if (!completedFollowUpKeys.has(key)) {
        return makeNotesFollowUp(
          key,
          "Unit Mix",
          n > 250
            ? `**${n}** units is a large project — anything unusual about scale or phasing?`
            : `**${n}** units is a small project — confirm that's the full building count?`,
          "Helps underwriters spot data entry issues or special program rules."
        );
      }
    }
  }

  if (field === "requestedLoanAmount" || field === "totalDevelopmentCost") {
    const tdc = parseMoney(getAnswerByField(answers, questions, "totalDevelopmentCost"));
    const loan = parseMoney(getAnswerByField(answers, questions, "requestedLoanAmount"));

    if (tdc != null && loan != null && tdc > 0 && loan > 0) {
      if (loan > tdc) {
        const key = "followup_loan_over_tdc";
        if (!completedFollowUpKeys.has(key)) {
          return makeNotesFollowUp(
            key,
            "Financials",
            "Requested loan exceeds TDC — can you briefly explain the financing structure?",
            "Unusual leverage or supplemental funding may need clarification.",
            false
          );
        }
      } else {
        const implied = Math.round((loan / tdc) * 1000) / 10;
        const key = "followup_leverage_implied";
        if (!completedFollowUpKeys.has(key) && implied >= 80) {
          return makeNotesFollowUp(
            key,
            "Financials",
            `Loan ÷ TDC implies **~${implied}%** leverage — anything we should note?`,
            "Captures context without re-entering LTV on the form."
          );
        }
      }
    }
  }

  return null;
}

export function buildFollowUpAcknowledgment(answer: string): string {
  return answer.trim() ? `Thanks — noted.` : `No problem — moving on.`;
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
