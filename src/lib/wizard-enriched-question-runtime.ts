import { getAnswerByField } from "@/lib/wizard-conversation";
import type { WizardAnswer, WizardQuestion } from "@/types/wizard";

export interface EnrichedSkipResult {
  skip: boolean;
  inferredValue?: string;
  reason?: "prior_answer" | "notes_corpus";
}

const LIHTC_SETASIDE_PATTERN =
  /\b(20\/50|40\/60|80\/\d+|60%\s*ami|50%\s*ami|average\s+income)/i;
const LIHTC_CREDIT_PATTERN = /\b(9%|4%)\s*(lihtc|credit)|\blihtc\s*(9%|4%)/i;
const HPD_SETASIDE_PATTERN =
  /formerly\s+homeless|hpd\s*(ncf|set-aside)|\d+%\s*(formerly\s+homeless|homeless)/i;
const REHAB_SCOPE_PATTERN =
  /\b(moderate|substantial|gut)\s+rehab|systems\s*\+\s*envelope/i;
const UNIT_COUNT_PATTERN = /\b(\d{1,4})\s*(?:total\s+)?(?:residential\s+)?units?\b/i;

interface TopicCheck {
  questionPattern: RegExp;
  corpusPattern: RegExp;
  programs?: string[];
}

const ENRICHED_TOPIC_CHECKS: TopicCheck[] = [
  {
    questionPattern: /bedroom|studio|1\s*br|2\s*br|unit\s+mix/i,
    corpusPattern: LIHTC_SETASIDE_PATTERN,
    programs: ["LIHTC"],
  },
  {
    questionPattern: /income set-aside|ami set-aside|ami band|set-aside election/i,
    corpusPattern: LIHTC_SETASIDE_PATTERN,
    programs: ["LIHTC"],
  },
  {
    questionPattern: /4%|9%|tax-exempt bond|lihtc credit/i,
    corpusPattern: LIHTC_CREDIT_PATTERN,
    programs: ["LIHTC"],
  },
  {
    questionPattern: /hpd set-aside|formerly homeless|ncf/i,
    corpusPattern: HPD_SETASIDE_PATTERN,
    programs: ["HPD"],
  },
  {
    questionPattern: /rehab scope|moderate rehab|gut renovation/i,
    corpusPattern: REHAB_SCOPE_PATTERN,
  },
  {
    questionPattern: /how many.*units|total.*units|unit count/i,
    corpusPattern: UNIT_COUNT_PATTERN,
  },
];

function answerCorpus(answers: WizardAnswer[]): string {
  return answers
    .filter((a) => !a.skipped && a.value.trim())
    .map((a) => a.value.trim())
    .join("\n");
}

/**
 * Runtime check: enriched question text asks about a topic already present in answers.
 */
export function isEnrichedQuestionRedundant(
  question: WizardQuestion,
  answers: WizardAnswer[],
  allQuestions: WizardQuestion[],
  fundingPrograms: string[]
): EnrichedSkipResult {
  const notes = getAnswerByField(answers, allQuestions, "additionalNotes") ?? "";
  const combined = `${answerCorpus(answers)}\n${notes}`;
  const qText = `${question.question} ${question.helpText ?? ""}`;

  for (const check of ENRICHED_TOPIC_CHECKS) {
    if (check.programs && !check.programs.some((p) => fundingPrograms.includes(p))) {
      continue;
    }
    if (!check.questionPattern.test(qText)) continue;
    if (!check.corpusPattern.test(combined)) continue;

    const match = combined.match(check.corpusPattern);
    return {
      skip: true,
      inferredValue: match?.[0],
      reason: "prior_answer",
    };
  }

  return { skip: false };
}
