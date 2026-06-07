import { getAgencyIdsForProgram } from "@/lib/funding-program-map";

const DISMISSED_STORAGE_KEY = "lisc-dismissed-rulebook-hints";

export function dismissedPairKey(program: string, agencyId: string): string {
  return `${program}:${agencyId}`;
}

export function loadDismissedHintPairs(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function saveDismissedHintPairs(pairs: Set<string>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([...pairs]));
}

export interface RulebookHintSuggestion {
  agencyId: string;
  agencyName: string;
}

export interface RulebookHint {
  program: string;
  suggestions: RulebookHintSuggestion[];
}

export function getMissingSuggestionsForProgram(
  program: string,
  agencies: { id: string; name: string; checked: boolean }[],
  dismissedPairs: Set<string>
): RulebookHintSuggestion[] {
  return getAgencyIdsForProgram(program)
    .filter((id) => !agencies.find((a) => a.id === id)?.checked)
    .filter((id) => !dismissedPairs.has(dismissedPairKey(program, id)))
    .map((id) => ({
      agencyId: id,
      agencyName: agencies.find((a) => a.id === id)?.name ?? id,
    }));
}

export function buildRulebookHint(
  program: string,
  agencies: { id: string; name: string; checked: boolean }[],
  dismissedPairs: Set<string>
): RulebookHint | null {
  const suggestions = getMissingSuggestionsForProgram(program, agencies, dismissedPairs);
  if (suggestions.length === 0) return null;
  return { program, suggestions };
}

export function formatRulebookHintMessage(hint: RulebookHint): string {
  const names = hint.suggestions.map((s) => s.agencyName.split(" ")[0]).join(" + ");
  return `${hint.program} is often reviewed against ${names} rulebooks — add them above if relevant.`;
}

/** Record dismissals for every suggestion in the active hint. */
export function dismissRulebookHint(
  hint: RulebookHint,
  dismissedPairs: Set<string>
): Set<string> {
  const next = new Set(dismissedPairs);
  for (const s of hint.suggestions) {
    next.add(dismissedPairKey(hint.program, s.agencyId));
  }
  saveDismissedHintPairs(next);
  return next;
}

/** When a user unchecks a suggested rulebook, stop nagging for that program+agency pair. */
export function dismissPairsForUncheckedAgency(
  agencyId: string,
  fundingPrograms: string[],
  dismissedPairs: Set<string>
): Set<string> {
  const next = new Set(dismissedPairs);
  let changed = false;
  for (const program of fundingPrograms) {
    if (getAgencyIdsForProgram(program).includes(agencyId)) {
      const key = dismissedPairKey(program, agencyId);
      if (!next.has(key)) {
        next.add(key);
        changed = true;
      }
    }
  }
  if (changed) saveDismissedHintPairs(next);
  return next;
}
