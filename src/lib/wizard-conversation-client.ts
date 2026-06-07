import type {
  ConversationTurnRequest,
  ConversationTurnResponse,
} from "@/lib/wizard-conversation-schema";

const CONVERSATION_TURN_TIMEOUT_MS = 8000;

export async function fetchConversationTurn(
  request: ConversationTurnRequest,
  signal?: AbortSignal
): Promise<ConversationTurnResponse> {
  const response = await fetch("/api/wizard/conversation-turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });

  const data = (await response.json()) as ConversationTurnResponse;

  if (!response.ok && !("success" in data)) {
    return { success: false, error: "Conversation turn request failed." };
  }

  return data;
}

export function createConversationTurnAbortSignal(): {
  signal: AbortSignal;
  cancel: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONVERSATION_TURN_TIMEOUT_MS);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeoutId),
  };
}
