import {
  buildInformedSkipAcknowledgment,
  getFollowUpKeysSatisfiedByAnswers,
  isFieldSatisfiedByPriorAnswers,
} from "@/lib/wizard-answer-informed-skip";
import { shouldPreferRuleFollowUpOverClarification } from "@/lib/wizard-next-turn-dedup";
import {
  buildAcknowledgment,
  buildCategoryTransition,
  buildFollowUpAcknowledgment,
  getFollowUpQuestion,
  isRedundantLoanTypeQuestion,
  type FollowUpQuestion,
  type WizardConversationContext,
} from "@/lib/wizard-conversation";
import {
  advanceQuestionQueue,
  buildRemainingQuestionIds,
  removeQuestionFromRemaining,
} from "@/lib/wizard-question-order";
import type { WizardAnswer, WizardQuestion } from "@/types/wizard";
import type {
  NextTurnPrefaceMessage,
  NextTurnSuccess,
} from "@/lib/wizard-next-turn-schema";

export interface ResolveNextTurnBase {
  loanType: string;
  fundingPrograms: string[];
  questions: WizardQuestion[];
  updatedAnswers: WizardAnswer[];
  completedFollowUpKeys: Set<string>;
  remainingQuestionIds: string[];
  dynamicEnabled: boolean;
  acknowledgment: string;
}

export interface ResolveNextTurnAfterMainInput extends ResolveNextTurnBase {
  currentIndex: number;
  triggerQuestion: WizardQuestion;
  clarification?: {
    question: string;
    helpText?: string;
    clarificationKey: string;
    storeInField: import("@/lib/wizard-form-sync").DealFieldKey;
  };
}

export interface ResolveNextTurnAfterFollowUpInput extends ResolveNextTurnBase {
  mainQuestion: WizardQuestion;
}

function conversationContext(
  loanType: string,
  fundingPrograms: string[]
): WizardConversationContext {
  return { loanType, fundingPrograms };
}

function ensureRemainingIds(
  input: ResolveNextTurnBase
): string[] {
  if (input.remainingQuestionIds.length > 0) {
    return [...input.remainingQuestionIds];
  }
  return buildRemainingQuestionIds({
    questions: input.questions,
    loanType: input.loanType,
    fundingPrograms: input.fundingPrograms,
    answers: input.updatedAnswers,
    dynamicEnabled: input.dynamicEnabled,
  });
}

function mergeInformedFollowUpKeys(input: ResolveNextTurnBase): Set<string> {
  const keys = new Set(input.completedFollowUpKeys);
  for (const key of getFollowUpKeysSatisfiedByAnswers(
    input.updatedAnswers,
    input.questions,
    input.fundingPrograms,
    input.loanType
  )) {
    keys.add(key);
  }
  return keys;
}

function computeRuleFollowUpOnField(
  question: WizardQuestion,
  answerValue: string,
  input: ResolveNextTurnBase
): FollowUpQuestion | null {
  const ctx = conversationContext(input.loanType, input.fundingPrograms);
  const completedKeys = mergeInformedFollowUpKeys(input);
  return getFollowUpQuestion(
    question,
    answerValue,
    input.updatedAnswers,
    input.questions,
    completedKeys,
    ctx
  );
}

function advanceToNextMain(
  input: ResolveNextTurnBase,
  prevCategory?: string
): Pick<
  NextTurnSuccess,
  | "nextAction"
  | "prefaceMessages"
  | "followUp"
  | "mainQuestion"
  | "categoryTransition"
  | "nextIndex"
  | "workingAnswers"
  | "remainingQuestionIds"
  | "skippedQuestionIds"
> {
  const ctx = conversationContext(input.loanType, input.fundingPrograms);
  const prefaceMessages: NextTurnPrefaceMessage[] = [];
  let remaining = ensureRemainingIds(input);
  let workingAnswers = [...input.updatedAnswers];
  const allSkipped: string[] = [];

  const advanced = advanceQuestionQueue(
    remaining,
    input.questions,
    workingAnswers,
    input.loanType,
    ctx
  );
  remaining = advanced.remainingQuestionIds;
  workingAnswers = advanced.workingAnswers;
  allSkipped.push(...advanced.skippedQuestionIds);

  for (const skippedId of advanced.skippedQuestionIds) {
    const skippedQ = input.questions.find((q) => q.id === skippedId);
    if (!skippedQ) continue;

    if (isRedundantLoanTypeQuestion(skippedQ, input.loanType)) {
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

      const followUp = computeRuleFollowUpOnField(
        skippedQ,
        input.loanType,
        { ...input, updatedAnswers: workingAnswers, remainingQuestionIds: remaining }
      );
      if (followUp) {
        return {
          nextAction: "follow_up",
          prefaceMessages,
          followUp: { ...followUp, source: "rule" },
          nextIndex: input.questions.findIndex((q) => q.id === skippedId),
          workingAnswers,
          remainingQuestionIds: remaining,
          skippedQuestionIds: allSkipped,
        };
      }
      continue;
    }

    const informed = isFieldSatisfiedByPriorAnswers(
      skippedQ,
      workingAnswers,
      input.questions,
      input.fundingPrograms
    );
    if (informed.skip) {
      const inferred =
        informed.inferredValue ??
        workingAnswers.find((a) => a.questionId === skippedId)?.value;
      prefaceMessages.push({
        content: buildInformedSkipAcknowledgment(skippedQ, inferred),
        isAcknowledgment: true,
      });
    }
  }

  if (!advanced.nextQuestion) {
    return {
      nextAction: "finish",
      prefaceMessages,
      workingAnswers,
      remainingQuestionIds: [],
      skippedQuestionIds: allSkipped,
    };
  }

  const categoryTransition = buildCategoryTransition(
    prevCategory,
    advanced.nextQuestion.category
  );

  return {
    nextAction: "main_question",
    prefaceMessages,
    mainQuestion: advanced.nextQuestion,
    categoryTransition: categoryTransition || undefined,
    nextIndex: advanced.nextIndex,
    workingAnswers,
    remainingQuestionIds: remaining,
    skippedQuestionIds: allSkipped,
  };
}

export function resolveNextTurnAfterMainAnswer(
  input: ResolveNextTurnAfterMainInput
): Omit<NextTurnSuccess, "success"> {
  const ruleFollowUp = computeRuleFollowUpOnField(
    input.triggerQuestion,
    input.updatedAnswers.find((a) => a.questionId === input.triggerQuestion.id)?.value ?? "",
    input
  );

  let remaining = ensureRemainingIds(input);
  remaining = removeQuestionFromRemaining(remaining, input.triggerQuestion.id);

  const baseWithRemaining = { ...input, remainingQuestionIds: remaining };
  const answerValue =
    input.updatedAnswers.find((a) => a.questionId === input.triggerQuestion.id)?.value ?? "";

  if (
    input.clarification &&
    ruleFollowUp &&
    shouldPreferRuleFollowUpOverClarification(
      input.triggerQuestion,
      answerValue,
      ruleFollowUp,
      input.clarification,
      { remainingQuestionIds: remaining, questions: input.questions }
    )
  ) {
    return {
      acknowledgment: input.acknowledgment,
      nextAction: "follow_up",
      followUp: { ...ruleFollowUp, source: "rule" },
      deferredClarification: input.clarification,
      workingAnswers: input.updatedAnswers,
      remainingQuestionIds: remaining,
      nextIndex: input.currentIndex,
    };
  }

  if (input.clarification) {
    return {
      acknowledgment: input.acknowledgment,
      nextAction: "clarification",
      clarification: input.clarification,
      workingAnswers: input.updatedAnswers,
      remainingQuestionIds: remaining,
    };
  }

  if (ruleFollowUp) {
    return {
      acknowledgment: input.acknowledgment,
      nextAction: "follow_up",
      followUp: { ...ruleFollowUp, source: "rule" },
      workingAnswers: input.updatedAnswers,
      remainingQuestionIds: remaining,
      nextIndex: input.currentIndex,
    };
  }

  const prevCategory = input.questions[input.currentIndex]?.category;
  const advance = advanceToNextMain(baseWithRemaining, prevCategory);
  return {
    acknowledgment: input.acknowledgment,
    ...advance,
  };
}

export function resolveNextTurnAfterFollowUpAnswer(
  input: ResolveNextTurnAfterFollowUpInput
): Omit<NextTurnSuccess, "success"> {
  const mainAnswer =
    input.updatedAnswers.find((a) => a.questionId === input.mainQuestion.id)?.value ?? "";

  const chainedFollowUp = computeRuleFollowUpOnField(
    input.mainQuestion,
    mainAnswer,
    input
  );

  if (chainedFollowUp) {
    return {
      acknowledgment: input.acknowledgment,
      nextAction: "follow_up",
      followUp: { ...chainedFollowUp, source: "rule" },
      workingAnswers: input.updatedAnswers,
      remainingQuestionIds: ensureRemainingIds(input),
      nextIndex: input.questions.findIndex((q) => q.id === input.mainQuestion.id),
    };
  }

  const prevCategory = input.mainQuestion.category;
  const advance = advanceToNextMain(input, prevCategory);
  return {
    acknowledgment: input.acknowledgment,
    ...advance,
  };
}

export function buildFollowUpTurnAcknowledgment(answerValue: string, skipped: boolean): string {
  if (skipped) return "No problem — moving on.";
  return buildFollowUpAcknowledgment(answerValue);
}
