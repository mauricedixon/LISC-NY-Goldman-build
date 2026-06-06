import type { WizardQuestion } from "@/types/wizard";

const cache = new Map<string, WizardQuestion[]>();
const inflight = new Map<string, Promise<WizardQuestion[]>>();

export function getWizardContextKey(
  loanType: string,
  agencies: string[],
  fundingPrograms: string[] = []
): string {
  return `v2:${loanType}:${[...agencies].sort().join(",")}:${[...fundingPrograms].sort().join(",")}`;
}

export function getCachedWizardQuestions(
  loanType: string,
  agencies: string[],
  fundingPrograms: string[] = []
): WizardQuestion[] | null {
  const key = getWizardContextKey(loanType, agencies, fundingPrograms);
  return cache.get(key) ?? null;
}

export async function fetchEnrichedQuestions(
  loanType: string,
  agencies: string[],
  fundingPrograms: string[] = []
): Promise<WizardQuestion[]> {
  const key = getWizardContextKey(loanType, agencies, fundingPrograms);

  const cached = cache.get(key);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const request = fetch("/api/wizard/generate-questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loanType, agencies, fundingPrograms }),
  })
    .then(async (response) => {
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate questions");
      }
      cache.set(key, data.questions as WizardQuestion[]);
      inflight.delete(key);
      return data.questions as WizardQuestion[];
    })
    .catch((error) => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, request);
  return request;
}

export function prefetchWizardQuestions(
  loanType: string,
  agencies: string[],
  fundingPrograms: string[] = []
): void {
  if (!loanType || agencies.length === 0) return;
  const key = getWizardContextKey(loanType, agencies, fundingPrograms);
  if (cache.has(key) || inflight.has(key)) return;

  fetchEnrichedQuestions(loanType, agencies, fundingPrograms).catch(() => {
    // Prefetch failures are silent — fallback questions cover the gap
  });
}

export function clearWizardQuestionCache(): void {
  cache.clear();
  inflight.clear();
}
