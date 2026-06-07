import type { WizardAnswer, WizardQuestion } from "@/types/wizard";

export interface FollowUpTranscriptEntry {
  questionId: string;
  category: string;
  question: string;
  answer: string;
  skipped: boolean;
}

export function buildInterviewTranscript(
  loanType: string,
  fundingPrograms: string[] | undefined,
  questions: WizardQuestion[],
  answers: WizardAnswer[],
  followUpTranscript: FollowUpTranscriptEntry[] = []
): string {
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));
  const mainQuestionIds = new Set(questions.map((q) => q.id));
  const lines = [
    "GUIDED INTERVIEW RESPONSES",
    `Loan Type: ${loanType}`,
    fundingPrograms?.length
      ? `Funding Programs: ${fundingPrograms.join(", ")}`
      : null,
    "",
  ].filter((line): line is string => line !== null);

  for (const q of questions) {
    const answer = answerMap.get(q.id);
    const value = answer?.skipped
      ? "[Skipped]"
      : answer?.value?.trim() || "[Not provided]";
    lines.push(`Q (${q.category}): ${q.question}`);
    lines.push(`A: ${value}`);
    lines.push("");
  }

  if (followUpTranscript.length > 0) {
    lines.push("FOLLOW-UP QUESTIONS");
    lines.push("");
    for (const entry of followUpTranscript) {
      lines.push(`Q (${entry.category}): ${entry.question}`);
      lines.push(
        `A: ${entry.skipped ? "[Skipped]" : entry.answer.trim() || "[Not provided]"}`
      );
      lines.push("");
    }
  }

  const followUpIds = new Set(followUpTranscript.map((e) => e.questionId));

  // Include any orphan answers not tied to main questions (fallback safety net)
  for (const answer of answers) {
    if (mainQuestionIds.has(answer.questionId)) continue;
    if (followUpIds.has(answer.questionId)) continue;
    const value = answer.skipped
      ? "[Skipped]"
      : answer.value?.trim() || "[Not provided]";
    lines.push(`Q (Follow-up): [${answer.questionId}]`);
    lines.push(`A: ${value}`);
    lines.push("");
  }

  return lines.join("\n");
}
