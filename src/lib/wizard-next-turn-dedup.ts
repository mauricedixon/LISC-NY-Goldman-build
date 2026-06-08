import type { ConversationClarification } from "@/lib/wizard-conversation-schema";
import type { FollowUpQuestion } from "@/lib/wizard-conversation";
import type { WizardQuestion } from "@/types/wizard";

const RULE_TOPIC_PATTERNS = [
  /lihtc set-aside/i,
  /hpd set-aside/i,
  /hcr rent/i,
  /mbr requirement/i,
  /construction phasing/i,
  /certificate of occupancy/i,
  /rehab scope/i,
  /leverage/i,
  /loan.*tdc/i,
  /40%.*60%.*ami/i,
  /ami band breakdown/i,
];

const LIHTC_SETASIDE_PATTERN = /\b(20\/50|40\/60|80\/\d+|60%\s*ami|50%\s*ami)/i;

export interface ClarificationDedupContext {
  remainingQuestionIds?: string[];
  questions?: WizardQuestion[];
}

function remainingIncludesField(
  field: string,
  ctx: ClarificationDedupContext
): boolean {
  const ids = ctx.remainingQuestionIds ?? [];
  const questions = ctx.questions ?? [];
  return ids.some((id) => questions.find((q) => q.id === id)?.field === field);
}

/** Clarifications worth keeping even when a rule follow-up is queued. */
export function isHighValueClarification(
  triggerQuestion: WizardQuestion,
  answerValue: string
): boolean {
  const q = triggerQuestion.question ?? "";
  const field = triggerQuestion.field;
  const answer = answerValue.trim();

  if (field === "totalUnits" && /about|approximately|~|roughly|around/i.test(answer)) {
    return true;
  }

  if (
    field === "developerName" &&
    (/for-profit|nonprofit|non-profit/i.test(q) || /for-profit|nonprofit/i.test(q))
  ) {
    return true;
  }

  if (
    field === "loanType" &&
    /4%|9%|tax-exempt bond/i.test(q) &&
    !/4%|9%|bond/i.test(answer)
  ) {
    return true;
  }

  return false;
}

export function shouldSuppressLlmClarification(
  triggerQuestion: WizardQuestion,
  answerValue: string,
  ruleFollowUp: FollowUpQuestion | null,
  clarification: ConversationClarification | undefined,
  ctx: ClarificationDedupContext = {}
): boolean {
  if (!clarification) return true;
  if (isHighValueClarification(triggerQuestion, answerValue)) return false;

  const clarifyText = `${clarification.question} ${clarification.helpText ?? ""}`;

  if (
    clarification.clarificationKey === "lihtc_percentage" &&
    (ruleFollowUp || triggerQuestion.field === "borough")
  ) {
    return true;
  }

  if (
    clarification.clarificationKey === "lihtc_40_60_unit_split" &&
    /\b40\/60\b/i.test(answerValue)
  ) {
    return true;
  }

  if (
    /total\s+(number\s+of\s+)?units|how\s+many\s+units/i.test(clarifyText) &&
    remainingIncludesField("totalUnits", ctx)
  ) {
    return true;
  }

  if (
    /bedroom\s+mix|studio|1\s*br|2\s*br/i.test(clarifyText) &&
    (LIHTC_SETASIDE_PATTERN.test(answerValue) || LIHTC_SETASIDE_PATTERN.test(clarifyText))
  ) {
    return true;
  }

  if (
    /per[-\s]?unit/i.test(clarifyText) &&
    triggerQuestion.field === "requestedLoanAmount" &&
    remainingIncludesField("totalUnits", ctx)
  ) {
    return true;
  }

  if (
    /per[-\s]?unit/i.test(clarifyText) &&
    triggerQuestion.field === "requestedLoanAmount" &&
    /\$\d|million|loan/i.test(answerValue)
  ) {
    return true;
  }

  if (!ruleFollowUp) return false;

  if (RULE_TOPIC_PATTERNS.some((pattern) => pattern.test(clarifyText))) {
    return true;
  }

  if (/4%.*9%|9%.*4%/i.test(clarifyText) && triggerQuestion.field === "borough") {
    return true;
  }

  const ruleText = ruleFollowUp.question;
  if (RULE_TOPIC_PATTERNS.some((pattern) => pattern.test(ruleText) && pattern.test(clarifyText))) {
    return true;
  }

  return false;
}

/** When both clarification and a rule follow-up are available, prefer the rule follow-up. */
export function shouldPreferRuleFollowUpOverClarification(
  triggerQuestion: WizardQuestion,
  answerValue: string,
  ruleFollowUp: FollowUpQuestion | null,
  clarification: ConversationClarification | undefined,
  ctx: ClarificationDedupContext = {}
): boolean {
  if (!ruleFollowUp || !clarification) return false;
  if (isHighValueClarification(triggerQuestion, answerValue)) return false;
  if (shouldSuppressLlmClarification(triggerQuestion, answerValue, ruleFollowUp, clarification, ctx)) {
    return true;
  }
  return true;
}
