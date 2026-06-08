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
  clarification: ConversationClarification | undefined
): boolean {
  if (!clarification) return true;
  if (!ruleFollowUp) return false;
  if (isHighValueClarification(triggerQuestion, answerValue)) return false;

  const clarifyText = `${clarification.question} ${clarification.helpText ?? ""}`;
  if (RULE_TOPIC_PATTERNS.some((pattern) => pattern.test(clarifyText))) {
    return true;
  }

  const ruleText = ruleFollowUp.question;
  if (RULE_TOPIC_PATTERNS.some((pattern) => pattern.test(ruleText) && pattern.test(clarifyText))) {
    return true;
  }

  return false;
}
