import type { NextTurnRequest, NextTurnResponse } from "@/lib/wizard-next-turn-schema";

const NEXT_TURN_TIMEOUT_MS = 10000;

export async function fetchNextTurn(
  request: NextTurnRequest,
  signal?: AbortSignal
): Promise<NextTurnResponse> {
  const response = await fetch("/api/wizard/next-turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });

  const data = (await response.json()) as NextTurnResponse;

  if (!response.ok && !("success" in data)) {
    return { success: false, error: "Next turn request failed." };
  }

  return data;
}

export function createNextTurnAbortSignal(): {
  signal: AbortSignal;
  cancel: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NEXT_TURN_TIMEOUT_MS);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeoutId),
  };
}
