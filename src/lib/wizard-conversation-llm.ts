import Anthropic from "@anthropic-ai/sdk";
import { applyWizardAnswersToFormData } from "@/lib/wizard-form-sync";
import { getWizardConversationModel } from "@/lib/wizard-conversation-config";
import {
  CONVERSATION_TURN_JSON_SCHEMA,
  type ConversationClarification,
  type ConversationTurnMessage,
} from "@/lib/wizard-conversation-schema";
import { buildDealSummary, formatFundingPrograms } from "@/types/deal";
import { parseClaudeJson } from "@/utils/parse-claude-json";
import type { DealFieldKey } from "@/lib/wizard-form-sync";
import type { WizardAnswer, WizardQuestion } from "@/types/wizard";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const VALID_STORE_FIELDS: DealFieldKey[] = [
  "projectName",
  "developerName",
  "loanType",
  "borough",
  "totalUnits",
  "totalDevelopmentCost",
  "requestedLoanAmount",
  "additionalNotes",
];

export interface ConversationLlmInput {
  loanType: string;
  agencies: string[];
  fundingPrograms: string[];
  triggerQuestion: WizardQuestion;
  answerValue: string;
  skipped: boolean;
  questions: WizardQuestion[];
  answers: WizardAnswer[];
  termSheetGuideSummary?: string;
  recentMessages?: ConversationTurnMessage[];
  /** Extra instruction lines appended to the prompt (Phase 2b dedup hints). */
  extraInstructions?: string[];
}

export interface ConversationLlmResult {
  acknowledgment: string;
  clarification?: ConversationClarification;
  claudeMs: number;
}

function buildCompactContext(input: ConversationLlmInput): string {
  const formPatch = applyWizardAnswersToFormData(
    input.questions,
    input.answers,
    input.loanType
  );
  return buildDealSummary({
    projectName: "",
    developerName: "",
    loanType: input.loanType,
    borough: "",
    totalUnits: "",
    totalDevelopmentCost: "",
    requestedLoanAmount: "",
    fundingPrograms: input.fundingPrograms,
    additionalNotes: "",
    ...formPatch,
  });
}

export function normalizeClarification(
  raw: ConversationClarification | undefined
): ConversationClarification | undefined {
  if (!raw?.question?.trim() || !raw.clarificationKey?.trim()) return undefined;

  const storeInField = VALID_STORE_FIELDS.includes(raw.storeInField)
    ? raw.storeInField
    : "additionalNotes";

  return {
    question: raw.question.trim(),
    helpText: raw.helpText?.trim() || undefined,
    clarificationKey: raw.clarificationKey.trim(),
    storeInField,
  };
}

export async function generateConversationAck(
  input: ConversationLlmInput
): Promise<ConversationLlmResult> {
  const answerValue = input.skipped ? "(skipped)" : (input.answerValue?.trim() || "(empty)");
  const dealContext = buildCompactContext(input);
  const recentTail = (input.recentMessages ?? []).slice(-6);
  const recentBlock =
    recentTail.length > 0
      ? recentTail.map((m) => `${m.role}: ${m.content}`).join("\n")
      : "(none)";
  const programs = formatFundingPrograms(input.fundingPrograms ?? []);
  const extraBlock =
    input.extraInstructions?.length ?
      `\n${input.extraInstructions.map((line, i) => `${10 + i}. ${line}`).join("\n")}`
    : "";

  const prompt = `
You are an expert affordable housing underwriter assistant for LISC NY.
The underwriter is in a guided deal interview. Write a brief, professional acknowledgment and optionally one clarification.

Deal context:
- Loan type: ${input.loanType}
- Funding programs: ${programs}
- Agencies: ${(input.agencies ?? []).join(", ") || "(none)"}
${input.termSheetGuideSummary ? `- Term sheet guide note: ${input.termSheetGuideSummary.slice(0, 500)}` : ""}

Answers captured so far:
${dealContext}

Question just answered (${input.triggerQuestion.category} / ${input.triggerQuestion.field}):
"${input.triggerQuestion.question}"

User answer: ${answerValue}

Recent chat (for tone continuity):
${recentBlock}

Instructions:
1. Write a 1-2 sentence acknowledgment in plain text (no markdown). Reference project name and funding programs when known (e.g. "noted for LIHTC + HPD review").
2. Set needsClarification true ONLY if the answer is ambiguous, incomplete, or inconsistent with prior answers.
3. If needsClarification is true, ask exactly ONE short clarification question.
4. If the user skipped or the answer is clearly sufficient, needsClarification must be false.
5. Do NOT ask the next interview question — the server handles that.
6. Do NOT clarify topics the client will ask via rule-based follow-ups: LIHTC set-asides, HPD set-asides, HCR rent restrictions, construction phasing, loan/TDC leverage, or rehab scope.
7. Treat borough labels like "Bronx" and "The Bronx" as equivalent — do not flag as inconsistent.
8. Never invent deal facts not present in the answers above.
9. clarification.storeInField should usually be "additionalNotes" unless clarifying the same field.${extraBlock}

Respond strictly in this JSON format:
${CONVERSATION_TURN_JSON_SCHEMA}
`;

  const model = getWizardConversationModel();
  const claudeStartedAt = Date.now();

  const msg = await anthropic.messages.create({
    model,
    max_tokens: 400,
    temperature: 0,
    system:
      "You are a precise underwriting assistant. Output valid JSON only. Never invent deal facts.",
    messages: [{ role: "user", content: prompt }],
  });

  const claudeMs = Date.now() - claudeStartedAt;
  const responseText = msg.content[0].type === "text" ? msg.content[0].text : "{}";

  let parsed: {
    acknowledgment: string;
    needsClarification: boolean;
    clarification?: ConversationClarification;
  };

  try {
    parsed = parseClaudeJson<typeof parsed>(responseText);
  } catch {
    throw new Error("Malformed LLM response.");
  }

  const acknowledgment = parsed.acknowledgment?.trim() || "Got it — thanks.";
  const clarification = parsed.needsClarification
    ? normalizeClarification(parsed.clarification)
    : undefined;

  return { acknowledgment, clarification, claudeMs };
}
