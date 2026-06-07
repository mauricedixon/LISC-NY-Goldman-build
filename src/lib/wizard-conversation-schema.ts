import type { DealFieldKey } from "@/lib/wizard-form-sync";
import type { WizardAnswer, WizardQuestion } from "@/types/wizard";

export interface ConversationTurnMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationTurnRequest {
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
}

export interface ConversationClarification {
  question: string;
  helpText?: string;
  clarificationKey: string;
  storeInField: DealFieldKey;
}

export interface ConversationTurnSuccess {
  success: true;
  acknowledgment: string;
  needsClarification: boolean;
  clarification?: ConversationClarification;
}

export interface ConversationTurnFailure {
  success: false;
  error: string;
}

export type ConversationTurnResponse = ConversationTurnSuccess | ConversationTurnFailure;

export const CONVERSATION_TURN_JSON_SCHEMA = `{
  "acknowledgment": "1-2 sentence plain-text acknowledgment",
  "needsClarification": false,
  "clarification": {
    "question": "short clarification question",
    "helpText": "optional brief context",
    "clarificationKey": "stable_snake_case_id",
    "storeInField": "additionalNotes"
  }
}`;
