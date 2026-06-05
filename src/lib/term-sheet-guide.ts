/** Fingerprint of inputs used for a term sheet guide run (stale detection). */
export function buildTermSheetGuideFingerprint(
  loanType: string,
  agencyIds: string[],
  fundingPrograms: string[]
): string {
  return JSON.stringify({
    loanType,
    agencies: [...agencyIds].sort(),
    fundingPrograms: [...fundingPrograms].sort(),
  });
}
