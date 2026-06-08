import { getAnswerByField } from "@/lib/wizard-conversation";
import type { WizardAnswer, WizardQuestion } from "@/types/wizard";

const LIHTC_CREDIT_PATTERN = /\b(9%|4%)\s*(lihtc|credit)|\blihtc\s*(9%|4%)/i;
const LIHTC_SETASIDE_PATTERN = /\b(20\/50|40\/60|80\/\d+|60%\s*ami|50%\s*ami)/i;
const HPD_SETASIDE_PATTERN =
  /formerly\s+homeless|hpd\s*(ncf|set-aside)|\d+%\s*(formerly\s+homeless|homeless)/i;
const CONSTRUCTION_PHASING_PATTERN =
  /single\s+building|one\s+co\b|certificate\s+of\s+occupancy|no\s+phasing/i;

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
  return /ami\s+band|set-aside\s+election|breakdown/i.test(question.question ?? "");
}

export interface InformedSkipResult {
  skip: boolean;
  inferredValue?: string;
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
      };
    }
  }

  if (field === "additionalNotes" && questionHintsAmiBreakdown(question)) {
    if (fundingPrograms.includes("LIHTC") && LIHTC_SETASIDE_PATTERN.test(combined)) {
      const match = combined.match(LIHTC_SETASIDE_PATTERN);
      const line = combined
        .split("\n")
        .find((l) => LIHTC_SETASIDE_PATTERN.test(l));
      return {
        skip: true,
        inferredValue: match?.[0] ?? line ?? notes,
      };
    }
  }

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
  if (fundingPrograms.includes("LIHTC") && LIHTC_SETASIDE_PATTERN.test(corpus)) {
    keys.push("followup_lihtc_setasides");
  }
  if (loanType === "New Construction" && CONSTRUCTION_PHASING_PATTERN.test(corpus)) {
    keys.push("followup_construction_phasing");
  }

  return keys;
}
