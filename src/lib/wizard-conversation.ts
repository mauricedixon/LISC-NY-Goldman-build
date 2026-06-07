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

function programReviewNote(programs: string[]): string {
  if (programs.length === 0) return "";
  return ` — noted for **${programs.join(" + ")}** review`;
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
  context: WizardConversationContext = {}
): string {
  const v = answerValue.trim();
  const field = question.field;
  const project = getAnswerByField(answers, questions, "projectName");
  const programs = context.fundingPrograms?.filter(Boolean) ?? [];
  const programNote = programReviewNote(programs);
  const loan = context.loanType?.trim();

  switch (field) {
    case "projectName":
      return programs.length > 0
        ? `Got it — **${v}**${programNote}.`
        : `Got it — **${v}**.`;
    case "developerName":
      if (project && programs.length > 0) {
        return `Thanks — **${v}** on **${project}**${programNote}.`;
      }
      return project
        ? `Thanks — **${v}** on **${project}**.`
        : `Thanks — noted **${v}** as the sponsor.`;
    case "loanType":
      return loan
        ? `Confirmed — **${loan}** loan${programNote}.`
        : `Confirmed — **${v}** loan.`;
    case "borough":
      if (project && programs.length > 0) {
        return `**${v}** for **${project}**${programNote}.`;
      }
      return project
        ? `**${v}** for **${project}** — noted.`
        : `Noted — **${v}**.`;
    case "totalUnits": {
      const n = parseNumber(v);
      if (n != null && programs.includes("LIHTC")) {
        return `**${n}** total units — we'll cross-check LIHTC set-asides.`;
      }
      return n != null ? `**${n}** total units — thanks.` : `Total units recorded.`;
    }
    case "totalDevelopmentCost":
      return programs.length > 0
        ? `TDC **${v}** — recorded${programNote}.`
        : `TDC **${v}** — recorded.`;
    case "requestedLoanAmount":
      if (loan?.includes("Construction")) {
        return `Requested loan **${v}** — noted for construction financing.`;
      }
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
  const loanType = context.loanType?.trim() ?? "";

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

  if (field === "borough" && programs.includes("HCR")) {
    const key = "followup_hcr_rent_restrictions";
    if (!completedFollowUpKeys.has(key)) {
      return makeNotesFollowUp(
        key,
        "Compliance",
        "Any HCR rent restrictions or MBR requirements to note?",
        "Captures NYS affordability rules that may apply to this deal."
      );
    }
  }

  if (field === "borough" && programs.includes("HUD")) {
    const key = "followup_hud_program_type";
    if (!completedFollowUpKeys.has(key)) {
      return makeNotesFollowUp(
        key,
        "Compliance",
        "Is this FHA-insured, project-based Section 8, or another HUD program?",
        "Helps target the right federal compliance rules."
      );
    }
  }

  if (field === "totalUnits" && programs.includes("LIHTC")) {
    const key = "followup_lihtc_setasides";
    if (!completedFollowUpKeys.has(key)) {
      return makeNotesFollowUp(
        key,
        "Unit Mix",
        "What's the LIHTC set-aside breakdown (e.g. 20/50, 40/60, or 80% AMI bands)?",
        "Optional — helps verify unit mix against LIHTC program rules."
      );
    }
  }

  if (field === "totalUnits" && loanType === "New Construction") {
    const key = "followup_construction_phasing";
    if (!completedFollowUpKeys.has(key)) {
      return makeNotesFollowUp(
        key,
        "Project Basics",
        "Any construction phasing, multiple buildings, or staged certificate of occupancy?",
        "New construction deals often have phasing that affects underwriting."
      );
    }
  }

  if (field === "totalUnits" && loanType === "Supportive Housing") {
    const key = "followup_supportive_services";
    if (!completedFollowUpKeys.has(key)) {
      return makeNotesFollowUp(
        key,
        "Project Basics",
        "Who is the supportive services operator, and what service model applies?",
        "Supportive housing deals require services coordination details."
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

  if (field === "developerName" && programs.includes("ESD")) {
    const key = "followup_esd_jobs";
    if (!completedFollowUpKeys.has(key)) {
      return makeNotesFollowUp(
        key,
        "Compliance",
        "Any ESD job creation, MWBE, or local hiring commitments tied to this deal?",
        "ESD-funded deals often have economic development covenants."
      );
    }
  }

  if (field === "requestedLoanAmount" && programs.includes("Fannie/Freddie")) {
    const key = "followup_agency_execution";
    if (!completedFollowUpKeys.has(key)) {
      return makeNotesFollowUp(
        key,
        "Financials",
        "Any Fannie/Freddie DUS execution details or agency sizing constraints?",
        "Captures agency-specific underwriting context."
      );
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

  if (field === "loanType" && loanType === "Preservation / Rehab") {
    const key = "followup_rehab_scope";
    if (!completedFollowUpKeys.has(key)) {
      return makeNotesFollowUp(
        key,
        "Project Basics",
        "What's the scope of rehab — moderate, substantial, or gut renovation?",
        "Preservation deals have different compliance triggers by rehab depth."
      );
    }
  }

  return null;
}

/** Whether the sidebar already supplies loan type and this question is redundant. */
export function isRedundantLoanTypeQuestion(
  question: WizardQuestion | undefined,
  sidebarLoanType: string
): boolean {
  return (
    question?.field === "loanType" && Boolean(sidebarLoanType.trim())
  );
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
