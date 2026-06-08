/** Default model for conversation-turn acks (fast, short JSON). */
export const WIZARD_CONVERSATION_MODEL_DEFAULT = "claude-haiku-4-5";

/**
 * Tier 2 Phase 2a — LLM acknowledgments + optional clarification.
 * Tier 2 Phase 2b — see wizard-next-turn-config.ts for next-turn flag.
 * Add to .env.local (both required for full enable):
 *   NEXT_PUBLIC_WIZARD_LLM_CONVERSATION=true
 *   WIZARD_LLM_CONVERSATION=true
 * Optional override:
 *   WIZARD_CONVERSATION_MODEL=claude-sonnet-4-6
 */
export function isWizardLlmConversationEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WIZARD_LLM_CONVERSATION === "true";
}

export function isWizardLlmConversationEnabledServer(): boolean {
  return (
    process.env.WIZARD_LLM_CONVERSATION === "true" ||
    process.env.NEXT_PUBLIC_WIZARD_LLM_CONVERSATION === "true"
  );
}

export function getWizardConversationModel(): string {
  return process.env.WIZARD_CONVERSATION_MODEL?.trim() || WIZARD_CONVERSATION_MODEL_DEFAULT;
}
