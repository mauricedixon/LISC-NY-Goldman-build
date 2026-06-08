import type { ConversationClarification } from "@/lib/wizard-conversation-schema";
import type { FollowUpQuestion } from "@/lib/wizard-conversation";
import type { WizardAnswer, WizardQuestion } from "@/types/wizard";

export type NextTurnAction = "clarification" | "follow_up" | "main_question" | "finish";

export type NextTurnType = "main_answer" | "follow_up_answer" | "clarification_answer";

export interface NextTurnMessage {
  role: "user" | "assistant";
  content: string;
}

export interface NextTurnRequest {
  loanType: string;
  agencies: string[];
  fundingPrograms: string[];
  currentIndex: number;
  triggerQuestion: WizardQuestion;
  answerValue: string;
  skipped: boolean;
  questions: WizardQuestion[];
  answers: WizardAnswer[];
  completedFollowUpKeys: string[];
  termSheetGuideSummary?: string;
  recentMessages?: NextTurnMessage[];
  /** Phase 2c — ordered ids still to ask; server updates each turn. */
  remainingQuestionIds?: string[];
  /** Defaults to main_answer. */
  turnType?: NextTurnType;
  /** Required for follow_up_answer / clarification_answer. */
  mainQuestion?: WizardQuestion;
  /** Follow-up being answered (follow_up_answer). */
  answeredFollowUp?: Pick<
    FollowUpQuestion,
    "id" | "followUpKey" | "storeInField" | "category" | "question" | "mergeMode"
  >;
}

export interface NextTurnPrefaceMessage {
  content: string;
  isAcknowledgment: true;
}

export interface NextTurnSuccess {
  success: true;
  acknowledgment: string;
  nextAction: NextTurnAction;
  /** Auto-skip acks emitted while advancing past redundant loan-type questions. */
  prefaceMessages?: NextTurnPrefaceMessage[];
  clarification?: ConversationClarification;
  /** Clarification deferred because a rule follow-up took priority (tier 2.1). */
  deferredClarification?: ConversationClarification;
  followUp?: FollowUpQuestion;
  mainQuestion?: WizardQuestion;
  categoryTransition?: string;
  nextIndex?: number;
  workingAnswers: WizardAnswer[];
  remainingQuestionIds: string[];
  skippedQuestionIds?: string[];
}

export interface NextTurnFailure {
  success: false;
  error: string;
}

export type NextTurnResponse = NextTurnSuccess | NextTurnFailure;
