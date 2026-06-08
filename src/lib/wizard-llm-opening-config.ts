/**
 * Optional LLM-generated Guided Review opening (demo narrative).
 * Add to .env.local:
 *   NEXT_PUBLIC_WIZARD_LLM_OPENING=true
 *   WIZARD_LLM_OPENING=true
 */
export function isWizardLlmOpeningEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WIZARD_LLM_OPENING === "true";
}

export function isWizardLlmOpeningEnabledServer(): boolean {
  return (
    process.env.WIZARD_LLM_OPENING === "true" ||
    process.env.NEXT_PUBLIC_WIZARD_LLM_OPENING === "true"
  );
}
