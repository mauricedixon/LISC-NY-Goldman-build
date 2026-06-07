import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { applyWizardAnswersToFormData } from "@/lib/wizard-form-sync";
import { getWizardConversationModel } from "@/lib/wizard-conversation-config";
import {
  CONVERSATION_TURN_JSON_SCHEMA,
  type ConversationTurnRequest,
  type ConversationTurnSuccess,
} from "@/lib/wizard-conversation-schema";
import { formatFundingPrograms, buildDealSummary } from "@/types/deal";
import { parseClaudeJson } from "@/utils/parse-claude-json";
import type { DealFieldKey } from "@/lib/wizard-form-sync";

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

function isConversationEnabled(): boolean {
  return (
    process.env.WIZARD_LLM_CONVERSATION === "true" ||
    process.env.NEXT_PUBLIC_WIZARD_LLM_CONVERSATION === "true"
  );
}

function buildCompactContext(body: ConversationTurnRequest): string {
  const formPatch = applyWizardAnswersToFormData(
    body.questions,
    body.answers,
    body.loanType
  );
  const summary = buildDealSummary({
    projectName: "",
    developerName: "",
    loanType: body.loanType,
    borough: "",
    totalUnits: "",
    totalDevelopmentCost: "",
    requestedLoanAmount: "",
    fundingPrograms: body.fundingPrograms,
    additionalNotes: "",
    ...formPatch,
  });
  return summary;
}

function normalizeClarification(
  raw: ConversationTurnSuccess["clarification"] | undefined
): ConversationTurnSuccess["clarification"] | undefined {
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

export async function POST(request: NextRequest) {
  if (!isConversationEnabled()) {
    return NextResponse.json(
      { success: false, error: "LLM conversation is disabled." },
      { status: 403 }
    );
  }

  const startedAt = Date.now();

  try {
    const body = (await request.json()) as ConversationTurnRequest;

    if (!body.loanType || !body.triggerQuestion || !body.questions?.length) {
      return NextResponse.json(
        { success: false, error: "loanType, triggerQuestion, and questions are required." },
        { status: 400 }
      );
    }

    const answerValue = body.skipped ? "(skipped)" : (body.answerValue?.trim() || "(empty)");
    const dealContext = buildCompactContext(body);
    const recentTail = (body.recentMessages ?? []).slice(-6);
    const recentBlock =
      recentTail.length > 0
        ? recentTail.map((m) => `${m.role}: ${m.content}`).join("\n")
        : "(none)";
    const programs = formatFundingPrograms(body.fundingPrograms ?? []);

    const prompt = `
You are an expert affordable housing underwriter assistant for LISC NY.
The underwriter is in a guided deal interview. Write a brief, professional acknowledgment and optionally one clarification.

Deal context:
- Loan type: ${body.loanType}
- Funding programs: ${programs}
- Agencies: ${(body.agencies ?? []).join(", ") || "(none)"}
${body.termSheetGuideSummary ? `- Term sheet guide note: ${body.termSheetGuideSummary.slice(0, 500)}` : ""}

Answers captured so far:
${dealContext}

Question just answered (${body.triggerQuestion.category} / ${body.triggerQuestion.field}):
"${body.triggerQuestion.question}"

User answer: ${answerValue}

Recent chat (for tone continuity):
${recentBlock}

Instructions:
1. Write a 1-2 sentence acknowledgment in plain text (no markdown). Reference project name and funding programs when known (e.g. "noted for LIHTC + HPD review").
2. Set needsClarification true ONLY if the answer is ambiguous, incomplete, or inconsistent with prior answers.
3. If needsClarification is true, ask exactly ONE short clarification question.
4. If the user skipped or the answer is clearly sufficient, needsClarification must be false.
5. Do NOT ask the next interview question — the client handles that.
6. Do NOT clarify topics the client will ask via rule-based follow-ups: LIHTC set-asides, HPD set-asides, construction phasing, loan/TDC leverage, or loan type details.
7. Treat borough labels like "Bronx" and "The Bronx" as equivalent — do not flag as inconsistent.
8. Never invent deal facts not present in the answers above.
9. clarification.storeInField should usually be "additionalNotes" unless clarifying the same field.

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

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[conversation-turn] model=${model} claude=${claudeMs}ms total=${Date.now() - startedAt}ms field=${body.triggerQuestion.field}`
      );
    }

    let parsed: {
      acknowledgment: string;
      needsClarification: boolean;
      clarification?: ConversationTurnSuccess["clarification"];
    };

    try {
      parsed = parseClaudeJson<typeof parsed>(responseText);
    } catch {
      console.error("Conversation turn JSON parse error:", responseText.slice(0, 500));
      return NextResponse.json(
        { success: false, error: "Malformed LLM response." },
        { status: 500 }
      );
    }

    const acknowledgment = parsed.acknowledgment?.trim() || "Got it — thanks.";
    const clarification = parsed.needsClarification
      ? normalizeClarification(parsed.clarification)
      : undefined;

    const result: ConversationTurnSuccess = {
      success: true,
      acknowledgment,
      needsClarification: Boolean(clarification),
      clarification,
    };

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Conversation turn API error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
