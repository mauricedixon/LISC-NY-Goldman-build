import type { FollowUpTranscriptEntry } from "@/lib/wizard-interview-transcript";
import type { AnalysisResult, WizardAnswer, WizardQuestion } from "@/types/wizard";

const STORAGE_KEY = "lisc-guided-review-session";
const SESSION_VERSION = 1;

export interface GuidedReviewChatMessage {
  role: "assistant" | "user";
  content: string;
  questionId?: string;
  helpText?: string;
  category?: string;
  skipped?: boolean;
  isAcknowledgment?: boolean;
}

export interface GuidedReviewSession {
  version: typeof SESSION_VERSION;
  contextKey: string;
  savedAt: string;
  questions: WizardQuestion[];
  answers: WizardAnswer[];
  messages: GuidedReviewChatMessage[];
  currentIndex: number;
  hasStarted: boolean;
  isComplete: boolean;
  completedFollowUpKeys: string[];
  followUpTranscript: FollowUpTranscriptEntry[];
  questionsLocked: boolean;
  analysisResult?: AnalysisResult | null;
}

export function loadGuidedReviewSession(): GuidedReviewSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuidedReviewSession;
    if (parsed.version !== SESSION_VERSION || !parsed.contextKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGuidedReviewSession(session: GuidedReviewSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Quota exceeded or private browsing — fail silently
  }
}

export function clearGuidedReviewSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
