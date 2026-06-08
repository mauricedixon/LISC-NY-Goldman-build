/**
 * Tier 2 Phase 2c — dynamic skip/reorder + targeted per-turn RAG.
 * Requires Phase 2b (WIZARD_NEXT_TURN). Add to .env.local:
 *   NEXT_PUBLIC_WIZARD_DYNAMIC_INTERVIEW=true
 *   WIZARD_DYNAMIC_INTERVIEW=true
 */
export function isWizardDynamicInterviewEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WIZARD_DYNAMIC_INTERVIEW === "true";
}

export function isWizardDynamicInterviewEnabledServer(): boolean {
  return (
    process.env.WIZARD_DYNAMIC_INTERVIEW === "true" ||
    process.env.NEXT_PUBLIC_WIZARD_DYNAMIC_INTERVIEW === "true"
  );
}
