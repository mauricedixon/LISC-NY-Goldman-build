import { NextRequest, NextResponse } from "next/server";
import { generateConversationAck } from "@/lib/wizard-conversation-llm";
import { isWizardLlmConversationEnabledServer } from "@/lib/wizard-conversation-config";
import { buildAcknowledgment } from "@/lib/wizard-conversation";
import { shouldSuppressLlmClarification } from "@/lib/wizard-next-turn-dedup";
import { resolveNextTurnAfterMainAnswer } from "@/lib/wizard-next-turn-engine";
import { isWizardNextTurnEnabledServer } from "@/lib/wizard-next-turn-config";
import type { NextTurnRequest, NextTurnSuccess } from "@/lib/wizard-next-turn-schema";
import {
  getFollowUpQuestion,
  type WizardConversationContext,
} from "@/lib/wizard-conversation";

export async function POST(request: NextRequest) {
  if (!isWizardNextTurnEnabledServer()) {
    return NextResponse.json(
      { success: false, error: "Next-turn orchestration is disabled." },
      { status: 403 }
    );
  }

  const startedAt = Date.now();

  try {
    const body = (await request.json()) as NextTurnRequest;

    if (
      !body.loanType ||
      body.currentIndex == null ||
      !body.triggerQuestion ||
      !body.questions?.length
    ) {
      return NextResponse.json(
        { success: false, error: "loanType, currentIndex, triggerQuestion, and questions are required." },
        { status: 400 }
      );
    }

    const completedKeys = new Set(body.completedFollowUpKeys ?? []);
    const conversationContext: WizardConversationContext = {
      loanType: body.loanType,
      fundingPrograms: body.fundingPrograms ?? [],
    };

    let acknowledgment: string;
    let clarification = undefined;
    let claudeMs = 0;

    if (isWizardLlmConversationEnabledServer()) {
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
          "If a rule-based follow-up will ask about LIHTC set-asides, HPD set-asides, HCR rent rules, AMI bands, construction phasing, or leverage, do NOT clarify those topics.",
        ],
      });
      acknowledgment = llm.acknowledgment;
      claudeMs = llm.claudeMs;

      const ruleFollowUp = getFollowUpQuestion(
        body.triggerQuestion,
        body.answerValue,
        body.answers,
        body.questions,
        completedKeys,
        conversationContext
      );

      if (
        llm.clarification &&
        !completedKeys.has(llm.clarification.clarificationKey) &&
        !shouldSuppressLlmClarification(
          body.triggerQuestion,
          body.answerValue,
          ruleFollowUp,
          llm.clarification
        )
      ) {
        clarification = llm.clarification;
      }
    } else {
      acknowledgment = buildAcknowledgment(
        body.triggerQuestion,
        body.answerValue,
        body.answers,
        body.questions,
        conversationContext
      );
    }

    const resolved = resolveNextTurnAfterMainAnswer({
      loanType: body.loanType,
      fundingPrograms: body.fundingPrograms ?? [],
      currentIndex: body.currentIndex,
      triggerQuestion: body.triggerQuestion,
      updatedAnswers: body.answers,
      questions: body.questions,
      completedFollowUpKeys: completedKeys,
      acknowledgment,
      clarification,
    });

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[next-turn] action=${resolved.nextAction} claude=${claudeMs}ms total=${Date.now() - startedAt}ms field=${body.triggerQuestion.field}`
      );
    }

    const result: NextTurnSuccess = {
      success: true,
      ...resolved,
    };

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Next turn API error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
