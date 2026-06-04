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

function parseMoney(value: string | undefined): number | null {
  return parseNumber(value);
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
    case "affordableUnits": {
      const aff = parseNumber(v);
      const total = parseNumber(getAnswerByField(answers, questions, "totalUnits"));
      if (aff != null && total != null && aff < total) {
        const market = total - aff;
        return `**${aff}** affordable of **${total}** total (${market} market-rate) — got it.`;
      }
      return aff != null ? `**${aff}** affordable units — thanks.` : `Affordable unit count recorded.`;
    }
    case "targetAMI":
      return `AMI mix noted: **${v}**.`;
    case "totalDevelopmentCost":
      return `TDC **${v}** — recorded.`;
    case "requestedLoanAmount":
      return `Requested loan **${v}** — noted.`;
    case "ltv":
      return `LTV **${v}%** — thanks.`;
    case "dscr":
      return `DSCR **${v}** — recorded.`;
    case "otherFundingSources":
      return `Capital stack details saved.`;
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
  const field = triggerQuestion.field;
  const value = answerValue.trim();

  if (field === "affordableUnits" || field === "totalUnits") {
    const total = parseNumber(
      field === "totalUnits"
        ? value
        : getAnswerByField(answers, questions, "totalUnits")
    );
    const affordable = parseNumber(
      field === "affordableUnits"
        ? value
        : getAnswerByField(answers, questions, "affordableUnits")
    );

    if (total != null && affordable != null) {
      if (affordable > total) {
        const key = "followup_unit_mix_over";
        if (!completedFollowUpKeys.has(key)) {
          return {
            id: key,
            followUpKey: key,
            category: "Unit Mix",
            field: "additionalNotes",
            storeInField: "additionalNotes",
            mergeMode: "append",
            question:
              "Affordable units exceed the total — can you clarify the unit breakdown?",
            helpText: "Underwriters need consistent unit counts for agency programs.",
            inputType: "textarea",
            required: false,
          };
        }
      } else if (affordable < total) {
        const market = total - affordable;
        const key = "followup_unit_mix_market";
        if (!completedFollowUpKeys.has(key) && market > 0) {
          return {
            id: key,
            followUpKey: key,
            category: "Unit Mix",
            field: "additionalNotes",
            storeInField: "additionalNotes",
            mergeMode: "append",
            question: `You have **${market}** market-rate units — any restrictions or set-asides on those units?`,
            inputType: "textarea",
            required: false,
          };
        }
      }
    }
  }

  if (field === "targetAMI") {
    const lower = value.toLowerCase();
    const bandCount = (value.match(/\d+\s*%/g) ?? []).length;
    const isVague = /mixed|various|multiple|tbd|blend|range/i.test(lower);

    if (bandCount >= 2 || isVague) {
      const key = "followup_ami_breakdown";
      if (!completedFollowUpKeys.has(key)) {
        return {
          id: key,
          followUpKey: key,
          category: "Unit Mix",
          field: "targetAMI",
          storeInField: "targetAMI",
          mergeMode: "append",
          question:
            "Can you break down unit counts or shares at each AMI band (e.g. 30%: 20 units)?",
          helpText: "Agency programs often require AMI-level unit mix detail.",
          inputType: "textarea",
          required: false,
        };
      }
    }
  }

  if (field === "requestedLoanAmount" || field === "totalDevelopmentCost") {
    const tdc = parseMoney(getAnswerByField(answers, questions, "totalDevelopmentCost"));
    const loan = parseMoney(getAnswerByField(answers, questions, "requestedLoanAmount"));
    const ltvAnswer = getAnswerByField(answers, questions, "ltv");

    if (tdc != null && tdc > 0 && loan != null && loan > 0 && !ltvAnswer) {
      const implied = Math.round((loan / tdc) * 1000) / 10;
      const key = "followup_ltv_implied";
      if (!completedFollowUpKeys.has(key)) {
        return {
          id: key,
          followUpKey: key,
          category: "Financials",
          field: "ltv",
          storeInField: "ltv",
          mergeMode: "replace",
          question: `Loan ÷ TDC implies **~${implied}%** LTV — does that match your underwriting? Enter LTV % if different.`,
          inputType: "number",
          required: false,
        };
      }
    }
  }

  if (field === "ltv") {
    const ltv = parseNumber(value);
    if (ltv != null && ltv > 100) {
      const key = "followup_ltv_high";
      if (!completedFollowUpKeys.has(key)) {
        return {
          id: key,
          followUpKey: key,
          category: "Financials",
          field: "ltv",
          storeInField: "ltv",
          mergeMode: "replace",
          question: "LTV is over 100% — please confirm the correct loan-to-value percentage.",
          inputType: "number",
          required: true,
        };
      }
    }
  }

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
