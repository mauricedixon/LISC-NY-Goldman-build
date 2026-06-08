import {
  hasExtendedGuideItems,
  mergeGuideSections,
} from "@/lib/term-sheet-guide-utils";
import type { TermSheetGuideResult } from "@/types/term-sheet-guide";

const CACHE_VERSION = "v3";
const cache = new Map<string, TermSheetGuideResult>();
const inflight = new Map<string, Promise<TermSheetGuideResult>>();

export function getTermSheetGuideContextKey(
  loanType: string,
  agencies: string[],
  fundingPrograms: string[]
): string {
  return `${CACHE_VERSION}:${loanType}:${[...agencies].sort().join(",")}:${[...fundingPrograms].sort().join(",")}`;
}

function essentialInflightKey(contextKey: string): string {
  return `${contextKey}:essential`;
}

function extendedInflightKey(contextKey: string): string {
  return `${contextKey}:extended`;
}

export function getCachedTermSheetGuide(
  loanType: string,
  agencies: string[],
  fundingPrograms: string[]
): TermSheetGuideResult | null {
  const key = getTermSheetGuideContextKey(loanType, agencies, fundingPrograms);
  return cache.get(key) ?? null;
}

export function hasCachedExtendedGuide(
  loanType: string,
  agencies: string[],
  fundingPrograms: string[]
): boolean {
  const guide = getCachedTermSheetGuide(loanType, agencies, fundingPrograms);
  return !!guide && hasExtendedGuideItems(guide.sections);
}

/** Restore a guide into the in-memory cache (e.g. after session resume). */
export function seedTermSheetGuideCache(
  key: string,
  guide: TermSheetGuideResult
): void {
  cache.set(key, guide);
}

export function isTermSheetGuidePrefetching(
  loanType: string,
  agencies: string[],
  fundingPrograms: string[]
): boolean {
  const key = getTermSheetGuideContextKey(loanType, agencies, fundingPrograms);
  return (
    inflight.has(essentialInflightKey(key)) || inflight.has(extendedInflightKey(key))
  );
}

export function isTermSheetGuideExtendedLoading(
  loanType: string,
  agencies: string[],
  fundingPrograms: string[]
): boolean {
  const key = getTermSheetGuideContextKey(loanType, agencies, fundingPrograms);
  return inflight.has(extendedInflightKey(key));
}

async function requestGuidePhase(
  loanType: string,
  agencies: string[],
  fundingPrograms: string[],
  phase: "essential" | "extended",
  essentialContext?: Pick<TermSheetGuideResult, "summary" | "keyThresholds">
): Promise<TermSheetGuideResult> {
  const response = await fetch("/api/term-sheet-guide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      loanType,
      agencies,
      fundingPrograms,
      phase,
      essentialContext,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to generate term sheet guide");
  }

  if (data.timingMs && process.env.NODE_ENV === "development") {
    console.info(`[term-sheet-guide] ${phase} timing`, data.timingMs);
  }

  return data.guide as TermSheetGuideResult;
}

export async function fetchTermSheetGuideEssential(
  loanType: string,
  agencies: string[],
  fundingPrograms: string[]
): Promise<TermSheetGuideResult> {
  const key = getTermSheetGuideContextKey(loanType, agencies, fundingPrograms);
  const cached = cache.get(key);
  if (cached) return cached;

  const inflightKey = essentialInflightKey(key);
  const pending = inflight.get(inflightKey);
  if (pending) return pending;

  const request = requestGuidePhase(loanType, agencies, fundingPrograms, "essential")
    .then((guide) => {
      cache.set(key, guide);
      inflight.delete(inflightKey);
      return guide;
    })
    .catch((error) => {
      inflight.delete(inflightKey);
      throw error;
    });

  inflight.set(inflightKey, request);
  return request;
}

export async function fetchTermSheetGuideExtended(
  loanType: string,
  agencies: string[],
  fundingPrograms: string[]
): Promise<TermSheetGuideResult> {
  const key = getTermSheetGuideContextKey(loanType, agencies, fundingPrograms);
  const cached = cache.get(key);
  if (cached && hasExtendedGuideItems(cached.sections)) {
    return cached;
  }

  const essential =
    cached ??
    (await fetchTermSheetGuideEssential(loanType, agencies, fundingPrograms));

  const inflightKey = extendedInflightKey(key);
  const pending = inflight.get(inflightKey);
  if (pending) return pending;

  const request = requestGuidePhase(
    loanType,
    agencies,
    fundingPrograms,
    "extended",
    {
      summary: essential.summary,
      keyThresholds: essential.keyThresholds,
    }
  )
    .then((extendedGuide) => {
      const merged: TermSheetGuideResult = {
        summary: essential.summary,
        keyThresholds: essential.keyThresholds,
        sections: mergeGuideSections(essential.sections, extendedGuide.sections),
      };
      cache.set(key, merged);
      inflight.delete(inflightKey);
      return merged;
    })
    .catch((error) => {
      inflight.delete(inflightKey);
      throw error;
    });

  inflight.set(inflightKey, request);
  return request;
}

/** Load essential tier first; extended loads on demand via fetchTermSheetGuideExtended. */
export async function fetchTermSheetGuide(
  loanType: string,
  agencies: string[],
  fundingPrograms: string[]
): Promise<TermSheetGuideResult> {
  return fetchTermSheetGuideEssential(loanType, agencies, fundingPrograms);
}

export function prefetchTermSheetGuide(
  loanType: string,
  agencies: string[],
  fundingPrograms: string[]
): void {
  if (!loanType || agencies.length === 0 || fundingPrograms.length === 0) return;
  const key = getTermSheetGuideContextKey(loanType, agencies, fundingPrograms);
  if (cache.has(key) || inflight.has(essentialInflightKey(key))) return;

  fetchTermSheetGuideEssential(loanType, agencies, fundingPrograms).catch(() => {
    // Prefetch failures are silent — user can retry via the button
  });
}
