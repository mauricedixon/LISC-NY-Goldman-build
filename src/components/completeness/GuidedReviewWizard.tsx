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
import { AnalysisResults } from "./AnalysisResults";

interface GuidedReviewWizardProps {
  selectedAgencies: string[];
  loanType: string;
  analysisResult: AnalysisResult | null;
  setAnalysisResult: React.Dispatch<React.SetStateAction<AnalysisResult | null>>;
}

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
  questionId?: string;
  helpText?: string;
  category?: string;
  skipped?: boolean;
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
  analysisResult,
  setAnalysisResult,
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const contextKey = getWizardContextKey(loanType, selectedAgencies);
  const accent = getAccentStyle(selectedAgencies);
  const currentQuestion = questions[currentIndex];
  const progress =
    questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSynthesizing, isEnriching]);

  useEffect(() => {
    prefetchWizardQuestions(loanType, selectedAgencies);
  }, [contextKey, loanType, selectedAgencies]);

  const loadEnrichedQuestionsInBackground = useCallback(
    async (initialQuestions: WizardQuestion[], initialAnswers: WizardAnswer[]) => {
      setIsEnriching(true);
      try {
        const enriched = await fetchEnrichedQuestions(loanType, selectedAgencies);
        const questionsChanged = enriched.some(
          (q, i) =>
            q.field !== initialQuestions[i]?.field || q.question !== initialQuestions[i]?.question
        );

        if (questionsChanged) {
          setQuestions((prevQuestions) => {
            setAnswers((prevAnswers) =>
              remapAnswersByField(prevQuestions, enriched, prevAnswers.length ? prevAnswers : initialAnswers)
            );
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
    [loanType, selectedAgencies]
  );

  const startReview = () => {
    if (selectedAgencies.length === 0) {
      setErrorMessage("Please select at least one target agency in the sidebar.");
      return;
    }

    setErrorMessage("");
    setAnalysisResult(null);
    setIsComplete(false);
    setEnrichedApplied(false);
    setHelpExpanded(false);

    const cached = getCachedWizardQuestions(loanType, selectedAgencies);
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
    setAnalysisResult(null);
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
    const newAnswer: WizardAnswer = {
      questionId: currentQuestion.id,
      value: trimmed,
      skipped: false,
    };
    const updatedAnswers = [
      ...answers.filter((a) => a.questionId !== currentQuestion.id),
      newAnswer,
    ];
    setAnswers(updatedAnswers);

    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed || "(No answer provided)" },
    ]);
    setInputValue("");

    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextQuestion = questions[nextIndex];
      setCurrentIndex(nextIndex);
      setHelpExpanded(false);

      if (nextQuestion.field === "loanType") {
        setInputValue(loanType);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: nextQuestion.question,
          questionId: nextQuestion.id,
          helpText: nextQuestion.helpText,
          category: nextQuestion.category,
        },
      ]);
    } else {
      handleFinish(updatedAnswers);
    }
  };

  const handleSkip = () => {
    if (!currentQuestion?.required) {
      const newAnswer: WizardAnswer = {
        questionId: currentQuestion.id,
        value: "",
        skipped: true,
      };
      const updatedAnswers = [
        ...answers.filter((a) => a.questionId !== currentQuestion.id),
        newAnswer,
      ];
      setAnswers(updatedAnswers);
      setErrorMessage("");
      setInputValue("");

      setMessages((prev) => [...prev, { role: "user", content: "Skipped", skipped: true }]);

      if (currentIndex < questions.length - 1) {
        const nextIndex = currentIndex + 1;
        const nextQuestion = questions[nextIndex];
        setCurrentIndex(nextIndex);
        setHelpExpanded(false);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: nextQuestion.question,
            questionId: nextQuestion.id,
            helpText: nextQuestion.helpText,
            category: nextQuestion.category,
          },
        ]);
      } else {
        handleFinish(updatedAnswers);
      }
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
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setAnalysisResult(data.analysis);
        setIsComplete(true);
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: "smooth" });
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
    const prefetched = getCachedWizardQuestions(loanType, selectedAgencies);

    return (
      <div className="space-y-8">
        <div className="relative bg-white rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 via-white to-sky-50/40 pointer-events-none" />
          <div className="relative px-8 py-10 text-center">
            <div className="w-16 h-16 bg-brand/10 rounded-2xl flex items-center justify-center mx-auto mb-5 ring-1 ring-brand/20">
              <Sparkles className="w-8 h-8 text-brand" />
            </div>
            <h3 className="font-semibold text-slate-800 text-xl mb-2">Guided Review</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
              A conversational walkthrough of your deal — starts instantly and enriches
              questions from your rulebooks in the background.
            </p>
            {prefetched && selectedAgencies.length > 0 && (
              <p className="text-xs text-emerald-600 font-medium mb-4">
                Agency-specific questions are ready — start immediately.
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
        <AnalysisResults
          analysisResult={analysisResult}
          emptyMessage="Complete the guided review to see results."
        />
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="space-y-8">
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
        <div ref={resultsRef}>
          <AnalysisResults analysisResult={analysisResult} emptyMessage="No analysis available." />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="max-w-4xl mx-auto flex flex-col bg-white rounded-xl border border-border-subtle shadow-sm overflow-hidden min-h-[520px]">
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-800">Guided Review</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Question {currentIndex + 1} of {questions.length}
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
                    {msg.helpText && idx === messages.length - 1 && (
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
                {currentIndex === questions.length - 1 ? "Finish & Analyze" : "Send"}
                <Send className="w-4 h-4" />
              </button>
            </div>
            {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
          </div>
        )}
      </div>

      <AnalysisResults
        analysisResult={analysisResult}
        emptyMessage="Complete the interview to see your checklist and compliance flags."
      />
    </div>
  );
}
