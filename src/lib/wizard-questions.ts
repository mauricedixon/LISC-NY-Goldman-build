import type { WizardQuestion } from "@/types/wizard";

const cache = new Map<string, WizardQuestion[]>();
const inflight = new Map<string, Promise<WizardQuestion[]>>();

export function getWizardContextKey(loanType: string, agencies: string[]): string {
  return `${loanType}:${[...agencies].sort().join(",")}`;
}

export function getCachedWizardQuestions(
  loanType: string,
  agencies: string[]
): WizardQuestion[] | null {
  const key = getWizardContextKey(loanType, agencies);
  return cache.get(key) ?? null;
}

export async function fetchEnrichedQuestions(
  loanType: string,
  agencies: string[]
): Promise<WizardQuestion[]> {
  const key = getWizardContextKey(loanType, agencies);

  const cached = cache.get(key);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const request = fetch("/api/wizard/generate-questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loanType, agencies }),
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

export function prefetchWizardQuestions(loanType: string, agencies: string[]): void {
  if (!loanType || agencies.length === 0) return;
  const key = getWizardContextKey(loanType, agencies);
  if (cache.has(key) || inflight.has(key)) return;

  fetchEnrichedQuestions(loanType, agencies).catch(() => {
    // Prefetch failures are silent — fallback questions cover the gap
  });
}

export function clearWizardQuestionCache(): void {
  cache.clear();
  inflight.clear();
}
