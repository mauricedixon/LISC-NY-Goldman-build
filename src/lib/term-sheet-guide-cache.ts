import type { TermSheetGuideResult } from "@/types/term-sheet-guide";

const cache = new Map<string, TermSheetGuideResult>();
const inflight = new Map<string, Promise<TermSheetGuideResult>>();

export function getTermSheetGuideContextKey(
  loanType: string,
  agencies: string[],
  fundingPrograms: string[]
): string {
  return `${loanType}:${[...agencies].sort().join(",")}:${[...fundingPrograms].sort().join(",")}`;
}

export function getCachedTermSheetGuide(
  loanType: string,
  agencies: string[],
  fundingPrograms: string[]
): TermSheetGuideResult | null {
  const key = getTermSheetGuideContextKey(loanType, agencies, fundingPrograms);
  return cache.get(key) ?? null;
}

export function isTermSheetGuidePrefetching(
  loanType: string,
  agencies: string[],
  fundingPrograms: string[]
): boolean {
  const key = getTermSheetGuideContextKey(loanType, agencies, fundingPrograms);
  return inflight.has(key);
}

export async function fetchTermSheetGuide(
  loanType: string,
  agencies: string[],
  fundingPrograms: string[]
): Promise<TermSheetGuideResult> {
  const key = getTermSheetGuideContextKey(loanType, agencies, fundingPrograms);

  const cached = cache.get(key);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const request = fetch("/api/term-sheet-guide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loanType, agencies, fundingPrograms }),
  })
    .then(async (response) => {
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate term sheet guide");
      }
      cache.set(key, data.guide as TermSheetGuideResult);
      inflight.delete(key);
      return data.guide as TermSheetGuideResult;
    })
    .catch((error) => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, request);
  return request;
}

export function prefetchTermSheetGuide(
  loanType: string,
  agencies: string[],
  fundingPrograms: string[]
): void {
  if (!loanType || agencies.length === 0 || fundingPrograms.length === 0) return;
  const key = getTermSheetGuideContextKey(loanType, agencies, fundingPrograms);
  if (cache.has(key) || inflight.has(key)) return;

  fetchTermSheetGuide(loanType, agencies, fundingPrograms).catch(() => {
    // Prefetch failures are silent — user can retry via the button
  });
}
