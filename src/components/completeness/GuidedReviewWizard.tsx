"use client";

import {
  Building2,
  CheckCircle2,
  ChevronDown,
  Send,
  SkipForward,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatFundingPrograms } from "@/types/deal";
import { applyWizardAnswersToFormData, type DealFieldKey } from "@/lib/wizard-form-sync";
import type { AnalysisResult, WizardAnswer, WizardQuestion } from "@/types/wizard";
import { getAccentStyle, getCategoryStyle } from "@/lib/agencies";
import {
  buildFallbackQuestions,
  getQuestionIndexByField,
  remapAnswersByField,
} from "@/lib/wizard-fallback";
import {
  fetchEnrichedQuestions,
  getCachedWizardQuestions,
  getWizardContextKey,
  prefetchWizardQuestions,
} from "@/lib/wizard-questions";
import {
  applyFollowUpAnswer,
  buildAcknowledgment,
  getAnswerByField,
  getFollowUpQuestion,
  plainAcknowledgment,
  type FollowUpQuestion,
} from "@/lib/wizard-conversation";

interface GuidedReviewWizardProps {
  selectedAgencies: string[];
  loanType: string;
  fundingPrograms: string[];
  setAnalysisResult: React.Dispatch<React.SetStateAction<AnalysisResult | null>>;
  onAnalysisComplete?: () => void;
  onAnalysisCleared?: () => void;
  onDealSync?: (field: DealFieldKey, value: string) => void;
  onWizardAnswersSync?: (
    questions: WizardQuestion[],
    answers: WizardAnswer[]
  ) => void;
  onWizardReset?: () => void;
}

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
  questionId?: string;
  helpText?: string;
  category?: string;
  skipped?: boolean;
  isAcknowledgment?: boolean;
}

function prefillLoanTypeAnswer(
  questions: WizardQuestion[],
  loanType: string
): WizardAnswer[] {
  const loanTypeQ = questions.find((q) => q.field === "loanType");
  if (!loanTypeQ) return [];
  return [{ questionId: loanTypeQ.id, value: loanType, skipped: false }];
}

export function GuidedReviewWizard({
  selectedAgencies,
  loanType,
  fundingPrograms,
  setAnalysisResult,
  onAnalysisComplete,
  onAnalysisCleared,
  onDealSync,
  onWizardAnswersSync,
  onWizardReset,
}: GuidedReviewWizardProps) {
  const [questions, setQuestions] = useState<WizardQuestion[]>([]);
  const [answers, setAnswers] = useState<WizardAnswer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [isEnriching, setIsEnriching] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [helpExpanded, setHelpExpanded] = useState(false);
  const [enrichedApplied, setEnrichedApplied] = useState(false);
  const [activeFollowUp, setActiveFollowUp] = useState<FollowUpQuestion | null>(null);
  const [completedFollowUpKeys, setCompletedFollowUpKeys] = useState<Set<string>>(
    () => new Set()
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contextKey = getWizardContextKey(loanType, selectedAgencies, fundingPrograms);
  const accent = getAccentStyle(selectedAgencies);
  const mainQuestion = questions[currentIndex];
  const currentQuestion = activeFollowUp ?? mainQuestion;
  const progress =
    questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const syncField = (field: string, value: string) => {
    onDealSync?.(field as DealFieldKey, value);
  };

  const syncAllAnswers = (
    qs: WizardQuestion[],
    ans: WizardAnswer[]
  ) => {
    if (onWizardAnswersSync) {
      onWizardAnswersSync(qs, ans);
    } else {
      const data = applyWizardAnswersToFormData(qs, ans, loanType);
      for (const q of qs) {
        const answer = ans.find((a) => a.questionId === q.id);
        if (answer && !answer.skipped && answer.value.trim()) {
          syncField(q.field, answer.value.trim());
        }
      }
      syncField("loanType", loanType);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSynthesizing, isEnriching]);

  useEffect(() => {
    prefetchWizardQuestions(loanType, selectedAgencies, fundingPrograms);
  }, [contextKey, loanType, selectedAgencies, fundingPrograms]);

  const loadEnrichedQuestionsInBackground = useCallback(
    async (initialQuestions: WizardQuestion[], initialAnswers: WizardAnswer[]) => {
      setIsEnriching(true);
      try {
        const enriched = await fetchEnrichedQuestions(
          loanType,
          selectedAgencies,
          fundingPrograms
        );
        const questionsChanged = enriched.some(
          (q, i) =>
            q.field !== initialQuestions[i]?.field || q.question !== initialQuestions[i]?.question
        );

        if (questionsChanged) {
          setQuestions((prevQuestions) => {
            setAnswers((prevAnswers) => {
              const remapped = remapAnswersByField(
                prevQuestions,
                enriched,
                prevAnswers.length ? prevAnswers : initialAnswers
              );
              queueMicrotask(() => syncAllAnswers(enriched, remapped));
              return remapped;
            });
            setCurrentIndex((idx) => {
              const field = prevQuestions[idx]?.field;
              if (!field) return idx;
              const newIdx = getQuestionIndexByField(enriched, field);
              return newIdx >= 0 ? newIdx : idx;
            });
            return enriched;
          });
        }
        setEnrichedApplied(true);
      } catch {
        // Fallback questions remain in use
      } finally {
        setIsEnriching(false);
      }
    },
    [loanType, selectedAgencies, fundingPrograms]
  );

  const startReview = () => {
    if (selectedAgencies.length === 0) {
      setErrorMessage("Please select at least one rulebook in the sidebar.");
      return;
    }

    setErrorMessage("");
    setIsComplete(false);
    setEnrichedApplied(false);
    setHelpExpanded(false);
    setActiveFollowUp(null);
    setCompletedFollowUpKeys(new Set());

    const cached = getCachedWizardQuestions(
      loanType,
      selectedAgencies,
      fundingPrograms
    );
    const initialQuestions = cached ?? buildFallbackQuestions(loanType);
    const initialAnswers = prefillLoanTypeAnswer(initialQuestions, loanType);
    const firstQuestion = initialQuestions[0];

    setQuestions(initialQuestions);
    setAnswers(initialAnswers);
    setCurrentIndex(0);
    setInputValue(firstQuestion?.field === "loanType" ? loanType : "");
    setMessages(
      firstQuestion
        ? [
            {
              role: "assistant",
              content: firstQuestion.question,
              questionId: firstQuestion.id,
              helpText: firstQuestion.helpText,
              category: firstQuestion.category,
            },
          ]
        : []
    );
    setHasStarted(true);
    syncField("loanType", loanType);
    if (initialAnswers.length) {
      syncAllAnswers(initialQuestions, initialAnswers);
    }

    if (!cached) {
      loadEnrichedQuestionsInBackground(initialQuestions, initialAnswers);
    } else {
      setEnrichedApplied(true);
    }
  };

  const handleReset = () => {
    setQuestions([]);
    setAnswers([]);
    setMessages([]);
    setCurrentIndex(0);
    setInputValue("");
    setHasStarted(false);
    setIsComplete(false);
    setErrorMessage("");
    setEnrichedApplied(false);
    setActiveFollowUp(null);
    setCompletedFollowUpKeys(new Set());
    setAnalysisResult(null);
    onAnalysisCleared?.();
    onWizardReset?.();
  };

  const upsertFieldAnswer = (
    field: string,
    value: string,
    existingAnswers: WizardAnswer[]
  ): WizardAnswer[] => {
    const q = questions.find((x) => x.field === field);
    if (!q) return existingAnswers;
    return [
      ...existingAnswers.filter((a) => a.questionId !== q.id),
      { questionId: q.id, value, skipped: false },
    ];
  };

  const appendAssistantMessages = (
    items: Array<{
      content: string;
      questionId?: string;
      helpText?: string;
      category?: string;
      isAcknowledgment?: boolean;
    }>
  ) => {
    setMessages((prev) => [
      ...prev,
      ...items.map((item) => ({
        role: "assistant" as const,
        content: plainAcknowledgment(item.content),
        questionId: item.questionId,
        helpText: item.helpText,
        category: item.category,
        isAcknowledgment: item.isAcknowledgment,
      })),
    ]);
  };

  const advanceToNextMainQuestion = (updatedAnswers: WizardAnswer[]) => {
    if (!mainQuestion || currentIndex >= questions.length - 1) {
      handleFinish(updatedAnswers);
      return;
    }

    const nextIndex = currentIndex + 1;
    const nextQuestion = questions[nextIndex];
    setCurrentIndex(nextIndex);
    setHelpExpanded(false);
    setActiveFollowUp(null);

    if (nextQuestion.field === "loanType") {
      setInputValue(loanType);
    } else {
      setInputValue("");
    }

    appendAssistantMessages([
      {
        content: nextQuestion.question,
        questionId: nextQuestion.id,
        helpText: nextQuestion.helpText,
        category: nextQuestion.category,
      },
    ]);
  };

  const proceedAfterMainAnswer = (
    triggerQuestion: WizardQuestion,
    answerValue: string,
    updatedAnswers: WizardAnswer[]
  ) => {
    const ack = buildAcknowledgment(
      triggerQuestion,
      answerValue,
      updatedAnswers,
      questions
    );

    appendAssistantMessages([{ content: ack, isAcknowledgment: true }]);

    const followUp = getFollowUpQuestion(
      triggerQuestion,
      answerValue,
      updatedAnswers,
      questions,
      completedFollowUpKeys
    );

    if (followUp) {
      setActiveFollowUp(followUp);
      setInputValue("");
      appendAssistantMessages([
        {
          content: followUp.question,
          questionId: followUp.id,
          helpText: followUp.helpText,
          category: followUp.category,
        },
      ]);
      return;
    }

    advanceToNextMainQuestion(updatedAnswers);
  };

  useEffect(() => {
    if (hasStarted) {
      handleReset();
    }
    // Reset when sidebar context changes mid-interview
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey]);

  const handleSend = () => {
    if (!currentQuestion || isSynthesizing) return;

    const trimmed = inputValue.trim();
    if (!trimmed && currentQuestion.required) {
      setErrorMessage("This field is required. Enter a value or skip if optional.");
      return;
    }

    setErrorMessage("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed || "(No answer provided)" },
    ]);
    setInputValue("");

    if (activeFollowUp) {
      const existing = getAnswerByField(answers, questions, activeFollowUp.storeInField);
      const merged = applyFollowUpAnswer(existing, activeFollowUp, trimmed);

      let updatedAnswers = [
        ...answers.filter((a) => a.questionId !== activeFollowUp.id),
        { questionId: activeFollowUp.id, value: trimmed, skipped: false },
      ];
      updatedAnswers = upsertFieldAnswer(activeFollowUp.storeInField, merged, updatedAnswers);

      setAnswers(updatedAnswers);
      syncField(activeFollowUp.storeInField, merged);
      setCompletedFollowUpKeys((prev) => new Set(prev).add(activeFollowUp.followUpKey));
      setActiveFollowUp(null);

      appendAssistantMessages([{ content: "Thanks — noted.", isAcknowledgment: true }]);
      advanceToNextMainQuestion(updatedAnswers);
      return;
    }

    if (!mainQuestion) return;

    const newAnswer: WizardAnswer = {
      questionId: mainQuestion.id,
      value: trimmed,
      skipped: false,
    };
    const updatedAnswers = [
      ...answers.filter((a) => a.questionId !== mainQuestion.id),
      newAnswer,
    ];
    setAnswers(updatedAnswers);
    syncField(mainQuestion.field, trimmed);

    proceedAfterMainAnswer(mainQuestion, trimmed, updatedAnswers);
  };

  const handleSkip = () => {
    if (!currentQuestion || currentQuestion.required) return;

    setErrorMessage("");
    setInputValue("");
    setMessages((prev) => [...prev, { role: "user", content: "Skipped", skipped: true }]);

    if (activeFollowUp) {
      setCompletedFollowUpKeys((prev) => new Set(prev).add(activeFollowUp.followUpKey));
      setActiveFollowUp(null);
      appendAssistantMessages([{ content: "No problem — moving on.", isAcknowledgment: true }]);
      advanceToNextMainQuestion(answers);
      return;
    }

    if (!mainQuestion) return;

    const newAnswer: WizardAnswer = {
      questionId: mainQuestion.id,
      value: "",
      skipped: true,
    };
    const updatedAnswers = [
      ...answers.filter((a) => a.questionId !== mainQuestion.id),
      newAnswer,
    ];
    setAnswers(updatedAnswers);
    syncField(mainQuestion.field, "");

    if (currentIndex < questions.length - 1) {
      advanceToNextMainQuestion(updatedAnswers);
    } else {
      handleFinish(updatedAnswers);
    }
  };

  const handleFinish = async (finalAnswers: WizardAnswer[]) => {
    setIsSynthesizing(true);
    setErrorMessage("");

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "Thanks — analyzing your responses against the rulebooks now.",
      },
    ]);

    try {
      const response = await fetch("/api/wizard/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanType,
          agencies: selectedAgencies,
          questions,
          answers: finalAnswers,
          fundingPrograms,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setAnalysisResult(data.analysis);
        onAnalysisComplete?.();
        setIsComplete(true);
        setTimeout(() => {
          document.getElementById("completeness-results")?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } else {
        setErrorMessage(data.error || "Failed to synthesize report.");
      }
    } catch {
      setErrorMessage("Failed to connect to synthesis service.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && currentQuestion?.inputType !== "textarea") {
      e.preventDefault();
      handleSend();
    }
  };

  if (!hasStarted) {
    const prefetched = getCachedWizardQuestions(
      loanType,
      selectedAgencies,
      fundingPrograms
    );

    return (
      <div className="relative bg-white rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 via-white to-sky-50/40 pointer-events-none" />
          <div className="relative px-8 py-10 text-center">
            <div className="w-16 h-16 bg-brand/10 rounded-2xl flex items-center justify-center mx-auto mb-5 ring-1 ring-brand/20">
              <Sparkles className="w-8 h-8 text-brand" />
            </div>
            <h3 className="font-semibold text-slate-800 text-xl mb-2">Guided Review</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
              Quick conversational deal context — not a term sheet lookup. Use the Term Sheet
              Guide above for program checklists, or Policy Chat (bottom-right) for ad-hoc
              rulebook questions.
            </p>
            {fundingPrograms.length > 0 && (
              <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 max-w-md mx-auto mb-4">
                Capital stack:{" "}
                <span className="font-medium">{formatFundingPrograms(fundingPrograms)}</span>
              </p>
            )}
            {prefetched && selectedAgencies.length > 0 && (
              <p className="text-xs text-emerald-600 font-medium mb-4">
                Program-tailored questions are ready — start immediately.
              </p>
            )}
            <button
              onClick={startReview}
              disabled={selectedAgencies.length === 0}
              className="inline-flex items-center gap-2 bg-[#0d6e52] hover:bg-[#0a5a43] disabled:opacity-50 disabled:cursor-not-allowed text-white px-7 py-3 rounded-xl font-medium text-sm transition-colors shadow-md"
            >
              <Send className="w-4 h-4" />
              Start Guided Review
            </button>
            {errorMessage && <p className="text-sm text-red-500 mt-4">{errorMessage}</p>}
          </div>
        </div>
    );
  }

  if (isComplete) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">
              Guided review complete — {answers.filter((a) => !a.skipped && a.value).length} of{" "}
              {questions.length} questions answered.
            </p>
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-medium"
          >
          Start over
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col bg-white rounded-xl border border-border-subtle shadow-sm overflow-hidden min-h-[520px]">
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-800">Guided Review</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Question {currentIndex + 1} of {questions.length}
                {activeFollowUp && (
                  <span className="ml-2 text-brand">· follow-up</span>
                )}
                {isEnriching && !enrichedApplied && (
                  <span className="ml-2 text-brand">· tailoring questions to rulebooks...</span>
                )}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors shrink-0"
            >
              Cancel
            </button>
          </div>
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden mt-3">
            <div
              className={`h-full ${accent.progress} rounded-full transition-all duration-500 ease-out`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-5 min-h-[320px]">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0 ring-1 ring-brand/20">
                  <Building2 className="w-4 h-4 text-brand" />
                </div>
              )}
              <div
                className={`max-w-[85%] ${
                  msg.role === "user"
                    ? "bg-[#0d6e52] text-white rounded-2xl rounded-tr-none px-4 py-3 text-sm shadow-sm"
                    : "space-y-2"
                }`}
              >
                {msg.role === "assistant" ? (
                  <>
                    {msg.isAcknowledgment ? (
                      <p className="text-xs text-slate-500 italic pl-1 py-1 leading-relaxed">
                        {msg.content}
                      </p>
                    ) : (
                      <>
                        {msg.category && (
                          <span
                            className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getCategoryStyle(msg.category)}`}
                          >
                            {msg.category}
                          </span>
                        )}
                        <p className="bg-slate-100 text-slate-800 rounded-2xl rounded-tl-none px-4 py-3 text-sm leading-relaxed">
                          {msg.content}
                        </p>
                      </>
                    )}
                    {msg.helpText && idx === messages.length - 1 && !msg.isAcknowledgment && (
                      <div className="pl-1">
                        <button
                          type="button"
                          onClick={() => setHelpExpanded((v) => !v)}
                          className="flex items-center gap-1 text-xs font-medium text-brand"
                        >
                          <ChevronDown
                            className={`w-3 h-3 transition-transform ${helpExpanded ? "rotate-180" : ""}`}
                          />
                          Why we ask this
                        </button>
                        {helpExpanded && (
                          <p className="mt-1 text-xs text-slate-500 pl-3 border-l-2 border-brand/30 leading-relaxed">
                            {msg.helpText}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <span className={msg.skipped ? "italic opacity-80" : ""}>{msg.content}</span>
                )}
              </div>
            </div>
          ))}

          {isSynthesizing && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0 ring-1 ring-brand/20">
                <Building2 className="w-4 h-4 text-brand" />
              </div>
              <div className="bg-slate-100 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-slate-600 flex gap-1">
                <span className="animate-bounce">.</span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>
                  .
                </span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>
                  .
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {!isSynthesizing && currentQuestion && (
          <div className="p-4 border-t border-slate-100 bg-white space-y-3">
            {currentQuestion.inputType === "select" ? (
              <select
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/40"
              >
                <option value="">Select...</option>
                {(currentQuestion.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : currentQuestion.inputType === "textarea" ? (
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                rows={3}
                placeholder="Type your answer..."
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            ) : (
              <input
                type={currentQuestion.inputType === "number" ? "number" : "text"}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer..."
                className="w-full bg-slate-50 border border-slate-200 rounded-full pl-5 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                autoFocus
              />
            )}

            <div className="flex items-center gap-2">
              {!currentQuestion.required && (
                <button
                  type="button"
                  onClick={handleSkip}
                  className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-50"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip
                </button>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={handleSend}
                disabled={!inputValue.trim() && currentQuestion.required}
                className="inline-flex items-center gap-2 bg-[#0d6e52] hover:bg-[#0a5a43] disabled:opacity-50 text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors"
              >
                {activeFollowUp
                  ? "Continue"
                  : currentIndex === questions.length - 1
                    ? "Finish & Analyze"
                    : "Send"}
                <Send className="w-4 h-4" />
              </button>
            </div>
            {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
          </div>
        )}
    </div>
  );
}
