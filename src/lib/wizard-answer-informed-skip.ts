import { isEnrichedQuestionRedundant } from "@/lib/wizard-enriched-question-runtime";
import { getAnswerByField } from "@/lib/wizard-conversation";
import type { WizardAnswer, WizardQuestion } from "@/types/wizard";

const LIHTC_CREDIT_PATTERN = /\b(9%|4%)\s*(lihtc|credit)|\blihtc\s*(9%|4%)/i;
const LIHTC_SETASIDE_PATTERN =
  /\b(20\/50|40\/60|80\/\d+|60%\s*ami|50%\s*ami|average\s+income)/i;
const HPD_SETASIDE_PATTERN =
  /formerly\s+homeless|hpd\s*(ncf|set-aside)|\d+%\s*(formerly\s+homeless|homeless)/i;
const HCR_MBR_PATTERN = /mbr\s+schedule|hcr\s+rent|rent\s+restriction/i;
const CONSTRUCTION_PHASING_PATTERN =
  /single\s+building|one\s+co\b|certificate\s+of\s+occupancy|no\s+phasing/i;
const REHAB_SCOPE_PATTERN =
  /\b(moderate|substantial|gut)\s+rehab|systems\s*\+\s*envelope/i;
const UNIT_COUNT_PATTERN = /\b(\d{1,4})\s*(?:total\s+)?(?:residential\s+)?units?\b/i;

function answerCorpus(answers: WizardAnswer[]): string {
  return answers
    .filter((a) => !a.skipped && a.value.trim())
    .map((a) => a.value.trim())
    .join("\n");
}

function questionHintsLihtcCredit(question: WizardQuestion): boolean {
  return /4%|9%|tax-exempt\s+bond/i.test(question.question ?? "");
}

function questionHintsAmiBreakdown(question: WizardQuestion): boolean {
  return /ami\s+band|set-aside\s+election|breakdown|income\s+set-aside/i.test(
    question.question ?? ""
  );
}

function questionHintsBedroomMix(question: WizardQuestion): boolean {
  return /bedroom|studio|1\s*br|2\s*br|3\s*br/i.test(question.question ?? "");
}

function questionHintsRehabScope(question: WizardQuestion): boolean {
  return /rehab\s+scope|moderate|gut\s+renovation|adaptive\s+reuse/i.test(
    question.question ?? ""
  );
}

export interface InformedSkipResult {
  skip: boolean;
  inferredValue?: string;
  reason?: "prior_answer" | "notes_corpus";
}

/** Brief ack when a main question is skipped because prior answers already cover it. */
export function buildInformedSkipAcknowledgment(
  question: WizardQuestion,
  inferredValue: string | undefined
): string {
  if (inferredValue?.trim()) {
    return `Already noted — **${inferredValue.trim()}**. Moving on.`;
  }
  const label = question.category?.trim() || "that";
  return `We already have enough on **${label}** — skipping ahead.`;
}

/** Skip a main question when a prior answer already covers it (e.g. 9% LIHTC in notes). */
export function isFieldSatisfiedByPriorAnswers(
  question: WizardQuestion,
  answers: WizardAnswer[],
  allQuestions: WizardQuestion[],
  fundingPrograms: string[]
): InformedSkipResult {
  const notes = getAnswerByField(answers, allQuestions, "additionalNotes") ?? "";
  const combined = `${answerCorpus(answers)}\n${notes}`;
  const field = question.field;

  if (field === "loanType" && questionHintsLihtcCredit(question)) {
    const match = combined.match(LIHTC_CREDIT_PATTERN);
    if (match) {
      const pct = match[1] || match[2] || "";
      return {
        skip: true,
        inferredValue: /4/.test(pct) ? "4% LIHTC" : "9% LIHTC",
        reason: "notes_corpus",
      };
    }
  }

  if (field === "loanType" && questionHintsRehabScope(question)) {
    const match = combined.match(REHAB_SCOPE_PATTERN);
    if (match) {
      return { skip: true, inferredValue: match[0], reason: "notes_corpus" };
    }
  }

  if (field === "totalUnits") {
    const existing = getAnswerByField(answers, allQuestions, "totalUnits");
    if (existing) return { skip: false };
    const match = combined.match(UNIT_COUNT_PATTERN);
    if (match) {
      return {
        skip: true,
        inferredValue: match[1],
        reason: "prior_answer",
      };
    }
  }

  if (field === "additionalNotes") {
    const qText = question.question ?? "";

    if (questionHintsAmiBreakdown(question) || questionHintsBedroomMix(question)) {
      if (fundingPrograms.includes("LIHTC") && LIHTC_SETASIDE_PATTERN.test(combined)) {
        const match = combined.match(LIHTC_SETASIDE_PATTERN);
        const line = combined.split("\n").find((l) => LIHTC_SETASIDE_PATTERN.test(l));
        return {
          skip: true,
          inferredValue: match?.[0] ?? line ?? notes,
          reason: "notes_corpus",
        };
      }
      if (/100%\s+affordable|60%\s*ami/i.test(combined) && questionHintsAmiBreakdown(question)) {
        const match = combined.match(/\d+%\s*ami|100%\s+affordable/i);
        return {
          skip: true,
          inferredValue: match?.[0] ?? notes,
          reason: "notes_corpus",
        };
      }
    }

    if (/rent restriction|mbr/i.test(qText) && HCR_MBR_PATTERN.test(combined)) {
      const match = combined.match(HCR_MBR_PATTERN);
      return {
        skip: true,
        inferredValue: match?.[0] ?? notes,
        reason: "notes_corpus",
      };
    }
  }

  const enriched = isEnrichedQuestionRedundant(
    question,
    answers,
    allQuestions,
    fundingPrograms
  );
  if (enriched.skip) return enriched;

  return { skip: false };
}

/** Rule follow-ups already answered in notes or prior fields — skip re-asking. */
export function getFollowUpKeysSatisfiedByAnswers(
  answers: WizardAnswer[],
  questions: WizardQuestion[],
  fundingPrograms: string[],
  loanType: string
): string[] {
  const notes = getAnswerByField(answers, questions, "additionalNotes") ?? "";
  const corpus = `${answerCorpus(answers)}\n${notes}`;
  const keys: string[] = [];

  if (fundingPrograms.includes("HPD") && HPD_SETASIDE_PATTERN.test(corpus)) {
    keys.push("followup_hpd_setasides");
  }
  if (fundingPrograms.includes("HCR") && HCR_MBR_PATTERN.test(corpus)) {
    keys.push("followup_hcr_rent_restrictions");
  }
  if (fundingPrograms.includes("LIHTC") && LIHTC_SETASIDE_PATTERN.test(corpus)) {
    keys.push("followup_lihtc_setasides");
  }
  if (loanType === "New Construction" && CONSTRUCTION_PHASING_PATTERN.test(corpus)) {
    keys.push("followup_construction_phasing");
  }
  if (loanType === "Preservation / Rehab" && REHAB_SCOPE_PATTERN.test(corpus)) {
    keys.push("followup_rehab_scope");
  }

  return keys;
}
