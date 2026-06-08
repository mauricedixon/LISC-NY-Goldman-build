/**
 * Tier 2 Phase 2b — server-orchestrated turn loop via /api/wizard/next-turn.
 * Phase 2c skip/reorder/RAG: see wizard-dynamic-interview-config.ts
 * Requires Phase 2a flags on for LLM acks. Add to .env.local:
 *   NEXT_PUBLIC_WIZARD_NEXT_TURN=true
 *   WIZARD_NEXT_TURN=true
 */
export function isWizardNextTurnEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WIZARD_NEXT_TURN === "true";
}

export function isWizardNextTurnEnabledServer(): boolean {
  return (
    process.env.WIZARD_NEXT_TURN === "true" ||
    process.env.NEXT_PUBLIC_WIZARD_NEXT_TURN === "true"
  );
}
