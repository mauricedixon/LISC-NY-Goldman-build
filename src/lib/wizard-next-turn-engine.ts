import {
  buildAcknowledgment,
  buildCategoryTransition,
  getFollowUpQuestion,
  isRedundantLoanTypeQuestion,
  type FollowUpQuestion,
  type WizardConversationContext,
} from "@/lib/wizard-conversation";
import type { WizardAnswer, WizardQuestion } from "@/types/wizard";
import type {
  NextTurnPrefaceMessage,
  NextTurnSuccess,
} from "@/lib/wizard-next-turn-schema";

export interface ResolveNextTurnInput {
  loanType: string;
  fundingPrograms: string[];
  currentIndex: number;
  triggerQuestion: WizardQuestion;
  updatedAnswers: WizardAnswer[];
  questions: WizardQuestion[];
  completedFollowUpKeys: Set<string>;
  acknowledgment: string;
  clarification?: {
    question: string;
    helpText?: string;
    clarificationKey: string;
    storeInField: import("@/lib/wizard-form-sync").DealFieldKey;
  };
}

function conversationContext(
  loanType: string,
  fundingPrograms: string[]
): WizardConversationContext {
  return { loanType, fundingPrograms };
}

function computeRuleFollowUp(
  input: ResolveNextTurnInput
): FollowUpQuestion | null {
  const ctx = conversationContext(input.loanType, input.fundingPrograms);
  const mainAnswer = input.updatedAnswers.find(
    (a) => a.questionId === input.triggerQuestion.id
  );
  return getFollowUpQuestion(
    input.triggerQuestion,
    mainAnswer?.value ?? "",
    input.updatedAnswers,
    input.questions,
    input.completedFollowUpKeys,
    ctx
  );
}

function computeAdvanceAfterTrigger(
  input: ResolveNextTurnInput
): Pick<
  NextTurnSuccess,
  "nextAction" | "prefaceMessages" | "followUp" | "mainQuestion" | "categoryTransition" | "nextIndex" | "workingAnswers"
> {
  const ctx = conversationContext(input.loanType, input.fundingPrograms);
  const prefaceMessages: NextTurnPrefaceMessage[] = [];
  let nextIndex = input.currentIndex + 1;
  let workingAnswers = [...input.updatedAnswers];

  const prevCategory = input.questions[input.currentIndex]?.category;

  while (
    nextIndex < input.questions.length &&
    isRedundantLoanTypeQuestion(input.questions[nextIndex], input.loanType)
  ) {
    const skippedQ = input.questions[nextIndex];
    workingAnswers = [
      ...workingAnswers.filter((a) => a.questionId !== skippedQ.id),
      { questionId: skippedQ.id, value: input.loanType, skipped: false },
    ];

    prefaceMessages.push({
      content: buildAcknowledgment(
        skippedQ,
        input.loanType,
        workingAnswers,
        input.questions,
        ctx
      ),
      isAcknowledgment: true,
    });

    const followUp = getFollowUpQuestion(
      skippedQ,
      input.loanType,
      workingAnswers,
      input.questions,
      input.completedFollowUpKeys,
      ctx
    );

    if (followUp) {
      return {
        nextAction: "follow_up",
        prefaceMessages,
        followUp: { ...followUp, source: "rule" },
        nextIndex,
        workingAnswers,
      };
    }

    nextIndex++;
  }

  if (nextIndex >= input.questions.length) {
    return {
      nextAction: "finish",
      prefaceMessages,
      workingAnswers,
    };
  }

  const nextQuestion = input.questions[nextIndex];
  const categoryTransition = buildCategoryTransition(
    prevCategory,
    nextQuestion.category
  );

  return {
    nextAction: "main_question",
    prefaceMessages,
    mainQuestion: nextQuestion,
    categoryTransition: categoryTransition || undefined,
    nextIndex,
    workingAnswers,
  };
}

export function resolveNextTurnAfterMainAnswer(
  input: ResolveNextTurnInput
): Omit<NextTurnSuccess, "success"> {
  const ruleFollowUp = computeRuleFollowUp(input);

  if (input.clarification) {
    return {
      acknowledgment: input.acknowledgment,
      nextAction: "clarification",
      clarification: input.clarification,
      workingAnswers: input.updatedAnswers,
    };
  }

  if (ruleFollowUp) {
    return {
      acknowledgment: input.acknowledgment,
      nextAction: "follow_up",
      followUp: { ...ruleFollowUp, source: "rule" },
      workingAnswers: input.updatedAnswers,
    };
  }

  const advance = computeAdvanceAfterTrigger(input);
  return {
    acknowledgment: input.acknowledgment,
    ...advance,
  };
}
