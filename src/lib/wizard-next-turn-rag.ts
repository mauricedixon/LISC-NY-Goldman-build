import { retrieveRulebookContext } from "@/utils/rag";
import type { WizardQuestion } from "@/types/wizard";

const AMBIGUOUS_ANSWER = /about|approximately|~|roughly|around|maybe|tbd|not sure/i;

export function shouldFetchTargetedRag(
  triggerQuestion: WizardQuestion,
  answerValue: string,
  skipped: boolean
): boolean {
  if (skipped) return false;
  const answer = answerValue.trim();
  if (!answer) return false;

  if (AMBIGUOUS_ANSWER.test(answer)) return true;

  const complianceFields = ["borough", "totalUnits", "loanType", "additionalNotes"];
  if (complianceFields.includes(triggerQuestion.field)) return true;

  return false;
}

export function buildTargetedRagQuery(
  triggerQuestion: WizardQuestion,
  answerValue: string,
  loanType: string,
  fundingPrograms: string[]
): string {
  return [
    `${loanType} affordable housing`,
    `programs: ${fundingPrograms.join(", ")}`,
    `field: ${triggerQuestion.field}`,
    `question: ${triggerQuestion.question}`,
    `answer: ${answerValue}`,
    "clarification eligibility unit set-aside LIHTC HPD HCR",
  ].join(". ");
}

export async function fetchTargetedRulebookSnippets(
  query: string,
  agencies: string[]
): Promise<string | undefined> {
  const { chunks, contextText } = await retrieveRulebookContext(query, agencies, 4);
  if (chunks.length === 0) return undefined;
  const trimmed = contextText.slice(0, 2400);
  return trimmed;
}
