/** Maps funding program labels to rulebook agency ids to auto-suggest in the sidebar. */
export const FUNDING_PROGRAM_TO_AGENCY_IDS: Record<string, string[]> = {
  LIHTC: ["hcr"],
  HPD: ["hpd", "hdc"],
  HCR: ["hcr"],
  ESD: ["esd"],
  HUD: ["hud"],
  "Fannie/Freddie": ["fannie"],
  Other: [],
};

export function getSuggestedAgencyIds(fundingPrograms: string[]): string[] {
  const ids = new Set<string>();
  for (const program of fundingPrograms) {
    for (const id of FUNDING_PROGRAM_TO_AGENCY_IDS[program] ?? []) {
      ids.add(id);
    }
  }
  return [...ids];
}

/** Agency ids newly suggested by the latest program selection (for hints). */
export function getAgencyIdsForProgram(program: string): string[] {
  return FUNDING_PROGRAM_TO_AGENCY_IDS[program] ?? [];
}
