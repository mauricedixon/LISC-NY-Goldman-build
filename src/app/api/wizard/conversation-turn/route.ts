import { NextRequest, NextResponse } from "next/server";
import { generateConversationAck } from "@/lib/wizard-conversation-llm";
import { isWizardLlmConversationEnabledServer } from "@/lib/wizard-conversation-config";
import { buildAcknowledgment } from "@/lib/wizard-conversation";
import type {
  ConversationTurnRequest,
  ConversationTurnSuccess,
} from "@/lib/wizard-conversation-schema";

/**
 * Legacy Phase 2a endpoint — kept for flag-off / 2a-only fallback ladder.
 * Hot path uses /api/wizard/next-turn when WIZARD_NEXT_TURN is enabled.
 */
export async function POST(request: NextRequest) {
  if (!isWizardLlmConversationEnabledServer()) {
    return NextResponse.json(
      { success: false, error: "LLM conversation is disabled." },
      { status: 403 }
    );
  }

  const startedAt = Date.now();
  let body: ConversationTurnRequest;

  try {
    body = (await request.json()) as ConversationTurnRequest;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!body.loanType || !body.triggerQuestion || !body.questions?.length) {
    return NextResponse.json(
      { success: false, error: "loanType, triggerQuestion, and questions are required." },
      { status: 400 }
    );
  }

  try {
    const llm = await generateConversationAck({
      loanType: body.loanType,
      agencies: body.agencies ?? [],
      fundingPrograms: body.fundingPrograms ?? [],
      triggerQuestion: body.triggerQuestion,
      answerValue: body.answerValue,
      skipped: body.skipped,
      questions: body.questions,
      answers: body.answers,
      termSheetGuideSummary: body.termSheetGuideSummary,
      recentMessages: body.recentMessages,
      extraInstructions: [
        "Do NOT clarify topics covered by rule-based follow-ups: LIHTC set-asides, HPD set-asides, construction phasing, or leverage.",
      ],
    });

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[conversation-turn] claude=${llm.claudeMs}ms total=${Date.now() - startedAt}ms field=${body.triggerQuestion.field}`
      );
    }

    const result: ConversationTurnSuccess = {
      success: true,
      acknowledgment: llm.acknowledgment,
      needsClarification: Boolean(llm.clarification),
      clarification: llm.clarification,
    };

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Conversation turn API error:", error);
    const fallback = buildAcknowledgment(
      body.triggerQuestion,
      body.answerValue,
      body.answers,
      body.questions,
      { loanType: body.loanType, fundingPrograms: body.fundingPrograms ?? [] }
    );
    return NextResponse.json({
      success: true,
      acknowledgment: fallback,
      needsClarification: false,
    } satisfies ConversationTurnSuccess);
  }
}
