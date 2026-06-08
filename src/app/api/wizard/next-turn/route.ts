import { NextRequest, NextResponse } from "next/server";
import { generateConversationAck } from "@/lib/wizard-conversation-llm";
import { isWizardLlmConversationEnabledServer } from "@/lib/wizard-conversation-config";
import { buildAcknowledgment } from "@/lib/wizard-conversation";
import { isWizardDynamicInterviewEnabledServer } from "@/lib/wizard-dynamic-interview-config";
import { shouldSuppressLlmClarification } from "@/lib/wizard-next-turn-dedup";
import {
  buildFollowUpTurnAcknowledgment,
  resolveNextTurnAfterFollowUpAnswer,
  resolveNextTurnAfterMainAnswer,
} from "@/lib/wizard-next-turn-engine";
import {
  buildTargetedRagQuery,
  fetchTargetedRulebookSnippets,
  shouldFetchTargetedRag,
} from "@/lib/wizard-next-turn-rag";
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
    const turnType = body.turnType ?? "main_answer";
    const dynamicEnabled = isWizardDynamicInterviewEnabledServer();

    if (!body.loanType || !body.triggerQuestion || !body.questions?.length) {
      return NextResponse.json(
        { success: false, error: "loanType, triggerQuestion, and questions are required." },
        { status: 400 }
      );
    }

    if (
      (turnType === "follow_up_answer" || turnType === "clarification_answer") &&
      !body.mainQuestion
    ) {
      return NextResponse.json(
        { success: false, error: "mainQuestion is required for follow-up/clarification turns." },
        { status: 400 }
      );
    }

    const completedKeys = new Set(body.completedFollowUpKeys ?? []);
    const conversationContext: WizardConversationContext = {
      loanType: body.loanType,
      fundingPrograms: body.fundingPrograms ?? [],
    };

    const baseInput = {
      loanType: body.loanType,
      fundingPrograms: body.fundingPrograms ?? [],
      questions: body.questions,
      updatedAnswers: body.answers,
      completedFollowUpKeys: completedKeys,
      remainingQuestionIds: body.remainingQuestionIds ?? [],
      dynamicEnabled,
    };

    if (turnType === "follow_up_answer" || turnType === "clarification_answer") {
      if (body.answeredFollowUp?.followUpKey) {
        completedKeys.add(body.answeredFollowUp.followUpKey);
      }

      const acknowledgment = buildFollowUpTurnAcknowledgment(
        body.answerValue,
        body.skipped
      );

      const resolved = resolveNextTurnAfterFollowUpAnswer({
        ...baseInput,
        mainQuestion: body.mainQuestion!,
        completedFollowUpKeys: completedKeys,
        acknowledgment,
      });

      if (process.env.NODE_ENV === "development") {
        console.log(
          `[next-turn] turn=${turnType} action=${resolved.nextAction} total=${Date.now() - startedAt}ms followUp=${body.answeredFollowUp?.followUpKey ?? "clarify"}`
        );
      }

      return NextResponse.json({ success: true, ...resolved } satisfies NextTurnSuccess);
    }

    let acknowledgment: string;
    let clarification = undefined;
    let claudeMs = 0;
    let ragMs = 0;

    const extraInstructions = [
      "If a rule-based follow-up will ask about LIHTC set-asides, HPD set-asides, HCR rent rules, AMI bands, construction phasing, or leverage, do NOT clarify those topics.",
      "Only reference facts the user has already stated in answers — do not invent set-asides or program details.",
    ];

    if (
      dynamicEnabled &&
      shouldFetchTargetedRag(body.triggerQuestion, body.answerValue, body.skipped)
    ) {
      const ragStart = Date.now();
      const query = buildTargetedRagQuery(
        body.triggerQuestion,
        body.answerValue,
        body.loanType,
        body.fundingPrograms ?? []
      );
      const snippets = await fetchTargetedRulebookSnippets(query, body.agencies ?? []);
      ragMs = Date.now() - ragStart;
      if (snippets) {
        extraInstructions.push(
          "Relevant rulebook excerpts for this answer (use for clarification only, do not quote at length):",
          snippets
        );
      }
    }

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
        extraInstructions,
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

      const remainingForDedup =
        body.remainingQuestionIds?.length ?
          body.remainingQuestionIds.filter((id) => id !== body.triggerQuestion.id)
        : [];

      if (
        llm.clarification &&
        !completedKeys.has(llm.clarification.clarificationKey) &&
        !shouldSuppressLlmClarification(
          body.triggerQuestion,
          body.answerValue,
          ruleFollowUp,
          llm.clarification,
          { remainingQuestionIds: remainingForDedup, questions: body.questions }
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
      ...baseInput,
      currentIndex: body.currentIndex,
      triggerQuestion: body.triggerQuestion,
      acknowledgment,
      clarification,
    });

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[next-turn] turn=main_answer action=${resolved.nextAction} claude=${claudeMs}ms rag=${ragMs}ms total=${Date.now() - startedAt}ms field=${body.triggerQuestion.field} remaining=${resolved.remainingQuestionIds.length}`
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
