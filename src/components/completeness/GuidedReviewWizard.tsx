"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  SkipForward,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalysisResult, WizardAnswer, WizardQuestion } from "@/types/wizard";
import { getAccentStyle, getCategoryStyle } from "@/lib/agencies";
import { AnalysisResults } from "./AnalysisResults";

interface GuidedReviewWizardProps {
  selectedAgencies: string[];
  loanType: string;
  analysisResult: AnalysisResult | null;
  setAnalysisResult: React.Dispatch<React.SetStateAction<AnalysisResult | null>>;
}

function StepDots({
  total,
  current,
  progressClass,
}: {
  total: number;
  current: number;
  progressClass: string;
}) {
  return (
    <div className="flex items-center gap-1.5 mt-3">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < current
              ? `${progressClass} w-4`
              : i === current
                ? `${progressClass} w-6`
                : "bg-slate-200 w-1.5"
          }`}
        />
      ))}
    </div>
  );
}

export function GuidedReviewWizard({
  selectedAgencies,
  loanType,
  analysisResult,
  setAnalysisResult,
}: GuidedReviewWizardProps) {
  const [questions, setQuestions] = useState<WizardQuestion[]>([]);
  const [answers, setAnswers] = useState<WizardAnswer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentValue, setCurrentValue] = useState("");
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [helpExpanded, setHelpExpanded] = useState(false);

  const accent = getAccentStyle(selectedAgencies);
  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const loadAnswerForIndex = useCallback(
    (index: number, questionList: WizardQuestion[], answerList: WizardAnswer[]) => {
      const q = questionList[index];
      if (!q) {
        setCurrentValue("");
        return;
      }
      const existing = answerList.find((a) => a.questionId === q.id);
      setCurrentValue(existing && !existing.skipped ? existing.value : "");
      setHelpExpanded(false);
    },
    []
  );

  const fetchQuestions = async () => {
    if (selectedAgencies.length === 0) {
      setErrorMessage("Please select at least one target agency in the sidebar.");
      return;
    }

    setIsLoadingQuestions(true);
    setErrorMessage("");
    setAnalysisResult(null);
    setIsComplete(false);

    try {
      const response = await fetch("/api/wizard/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loanType, agencies: selectedAgencies }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const generated: WizardQuestion[] = data.questions;
        setQuestions(generated);
        setAnswers([]);
        setCurrentIndex(0);
        setHasStarted(true);

        const loanTypeQ = generated.find((q) => q.field === "loanType");
        if (loanTypeQ) {
          setAnswers([{ questionId: loanTypeQ.id, value: loanType, skipped: false }]);
          if (generated[0]?.field === "loanType") {
            setCurrentValue(loanType);
          }
        }

        loadAnswerForIndex(0, generated, []);
      } else {
        setErrorMessage(data.error || "Failed to generate questions.");
      }
    } catch {
      setErrorMessage("Failed to connect to question generation service.");
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const saveCurrentAnswer = (value: string, skipped: boolean) => {
    if (!currentQuestion) return;
    setAnswers((prev) => {
      const filtered = prev.filter((a) => a.questionId !== currentQuestion.id);
      return [...filtered, { questionId: currentQuestion.id, value, skipped }];
    });
  };

  const handleNext = () => {
    if (!currentQuestion) return;
    if (!currentValue.trim() && currentQuestion.required) {
      setErrorMessage("This field is required. Enter a value or skip if optional.");
      return;
    }
    saveCurrentAnswer(currentValue.trim(), false);
    setErrorMessage("");
    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      const updatedAnswers = [
        ...answers.filter((a) => a.questionId !== currentQuestion.id),
        { questionId: currentQuestion.id, value: currentValue.trim(), skipped: false },
      ];
      loadAnswerForIndex(nextIndex, questions, updatedAnswers);
    } else {
      handleFinish([
        ...answers.filter((a) => a.questionId !== currentQuestion.id),
        { questionId: currentQuestion.id, value: currentValue.trim(), skipped: false },
      ]);
    }
  };

  const handleBack = () => {
    if (currentIndex === 0) return;
    saveCurrentAnswer(currentValue.trim(), false);
    setErrorMessage("");
    const prevIndex = currentIndex - 1;
    setCurrentIndex(prevIndex);
    loadAnswerForIndex(prevIndex, questions, answers);
  };

  const handleSkip = () => {
    if (!currentQuestion) return;
    saveCurrentAnswer("", true);
    setErrorMessage("");
    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      const updatedAnswers = [
        ...answers.filter((a) => a.questionId !== currentQuestion.id),
        { questionId: currentQuestion.id, value: "", skipped: true },
      ];
      loadAnswerForIndex(nextIndex, questions, updatedAnswers);
    } else {
      handleFinish([
        ...answers.filter((a) => a.questionId !== currentQuestion.id),
        { questionId: currentQuestion.id, value: "", skipped: true },
      ]);
    }
  };

  const handleFinish = async (finalAnswers: WizardAnswer[]) => {
    setIsSynthesizing(true);
    setErrorMessage("");
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
      } else {
        setErrorMessage(data.error || "Failed to synthesize report.");
      }
    } catch {
      setErrorMessage("Failed to connect to synthesis service.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleReset = () => {
    setQuestions([]);
    setAnswers([]);
    setCurrentIndex(0);
    setCurrentValue("");
    setHasStarted(false);
    setIsComplete(false);
    setErrorMessage("");
    setAnalysisResult(null);
  };

  const contextKey = `${loanType}:${selectedAgencies.join(",")}`;
  const prevContextRef = useRef(contextKey);

  useEffect(() => {
    if (hasStarted && prevContextRef.current !== contextKey) {
      handleReset();
    }
    prevContextRef.current = contextKey;
  }, [contextKey, hasStarted, setAnalysisResult]);

  const inputClass =
    "w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/30 transition-shadow";

  if (!hasStarted) {
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
              Walk through agency-specific underwriting questions one at a time, grounded in your
              selected rulebooks.
            </p>
            <ol className="text-left text-sm text-slate-600 space-y-2 max-w-xs mx-auto mb-8">
              {[
                "Questions tailored to your loan type and agencies",
                "Answer one field at a time with rulebook context",
                "Get a completeness report at the end",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <button
              onClick={fetchQuestions}
              disabled={isLoadingQuestions || selectedAgencies.length === 0}
              className="inline-flex items-center gap-2 bg-brand hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white px-7 py-3 rounded-xl font-medium text-sm transition-colors shadow-md shadow-brand/20"
            >
              {isLoadingQuestions ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating questions from rulebooks...
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4" />
                  Start Guided Review
                </>
              )}
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
        <AnalysisResults analysisResult={analysisResult} emptyMessage="No analysis available." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="relative rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/60 via-white to-sky-50/30 pointer-events-none" />
        <div className="relative bg-white/70 backdrop-blur-sm">
          <div className="px-6 py-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <ClipboardList className="w-4 h-4 text-brand" />
                <h3 className="font-semibold text-slate-800">Guided Review</h3>
                {currentQuestion && (
                  <span
                    className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${getCategoryStyle(currentQuestion.category)}`}
                  >
                    {currentQuestion.category}
                  </span>
                )}
              </div>
              <button
                onClick={handleReset}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Question {currentIndex + 1} of {questions.length}
            </p>
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden mt-3">
              <div
                className={`h-full ${accent.progress} rounded-full transition-all duration-500 ease-out`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <StepDots total={questions.length} current={currentIndex} progressClass={accent.progress} />
          </div>

          <div className="px-6 py-8">
            {isSynthesizing ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <span className="w-8 h-8 border-2 border-emerald-200 border-t-brand rounded-full animate-spin mb-4" />
                <p className="text-sm font-medium">Synthesizing completeness report...</p>
                <p className="text-xs text-slate-400 mt-1">Analyzing your answers against rulebooks</p>
              </div>
            ) : currentQuestion ? (
              <div className="max-w-2xl mx-auto">
                <p className="text-xl font-semibold text-slate-800 leading-snug mb-4">
                  {currentQuestion.question}
                </p>

                {currentQuestion.helpText && (
                  <div className="mb-5">
                    <button
                      type="button"
                      onClick={() => setHelpExpanded((v) => !v)}
                      className="flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand-hover transition-colors"
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${helpExpanded ? "rotate-180" : ""}`}
                      />
                      Why we ask this
                    </button>
                    {helpExpanded && (
                      <div className="mt-2 pl-3 border-l-2 border-brand/30 text-sm text-slate-600 leading-relaxed">
                        {currentQuestion.helpText}
                      </div>
                    )}
                  </div>
                )}

                {currentQuestion.inputType === "select" ? (
                  <select
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    className={inputClass}
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
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    rows={4}
                    placeholder="Enter your answer..."
                    className={`${inputClass} resize-none`}
                  />
                ) : (
                  <input
                    type={currentQuestion.inputType === "number" ? "number" : "text"}
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNext()}
                    placeholder="Enter your answer..."
                    className={inputClass}
                    autoFocus
                  />
                )}
              </div>
            ) : null}
          </div>

          {!isSynthesizing && (
            <div className="px-6 pb-6 flex items-center gap-3 max-w-2xl mx-auto">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentIndex === 0}
                className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-lg hover:bg-white/80 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <div className="flex-1" />
              {!currentQuestion?.required && (
                <button
                  type="button"
                  onClick={handleSkip}
                  className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-white/80 transition-colors"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-2 bg-brand hover:bg-brand-hover text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-md shadow-brand/20"
              >
                {currentIndex === questions.length - 1 ? "Finish & Analyze" : "Next"}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="px-6 pb-4 max-w-2xl mx-auto">
              <p className="text-sm text-red-500">{errorMessage}</p>
            </div>
          )}
        </div>
      </div>

      <AnalysisResults
        analysisResult={analysisResult}
        emptyMessage="Complete all questions to see results."
      />
    </div>
  );
}
