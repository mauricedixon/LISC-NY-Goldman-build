"use client";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  HelpCircle,
  SkipForward,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalysisResult, WizardAnswer, WizardQuestion } from "@/types/wizard";
import { AnalysisResults } from "./AnalysisResults";

interface GuidedReviewWizardProps {
  selectedAgencies: string[];
  loanType: string;
  analysisResult: AnalysisResult | null;
  setAnalysisResult: React.Dispatch<React.SetStateAction<AnalysisResult | null>>;
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
      setQuestions([]);
      setAnswers([]);
      setCurrentIndex(0);
      setCurrentValue("");
      setHasStarted(false);
      setIsComplete(false);
      setErrorMessage("");
      setAnalysisResult(null);
    }
    prevContextRef.current = contextKey;
  }, [contextKey, hasStarted, setAnalysisResult]);

  if (!hasStarted) {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-8 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-800 text-lg mb-2">Guided Review</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              Walk through agency-specific underwriting questions one at a time.
              Questions are generated from your selected rulebooks ({selectedAgencies.join(", ") || "none"})
              and loan type ({loanType}).
            </p>
            <button
              onClick={fetchQuestions}
              disabled={isLoadingQuestions || selectedAgencies.length === 0}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm"
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

        <AnalysisResults analysisResult={analysisResult} emptyMessage="Complete the guided review to see results." />
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="space-y-8">
        <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium text-green-800">
              Guided review complete — {answers.filter((a) => !a.skipped && a.value).length} of{" "}
              {questions.length} questions answered.
            </p>
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-green-700 hover:text-green-900 font-medium"
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-600" />
                Guided Review
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Question {currentIndex + 1} of {questions.length} · {currentQuestion?.category}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="p-6">
          {isSynthesizing ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <span className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
              <p className="text-sm font-medium">Synthesizing completeness report...</p>
              <p className="text-xs text-slate-400 mt-1">Analyzing your answers against rulebooks</p>
            </div>
          ) : currentQuestion ? (
            <div className="max-w-xl">
              <p className="text-lg font-medium text-slate-800 mb-2">{currentQuestion.question}</p>
              {currentQuestion.helpText && (
                <p className="text-sm text-slate-500 mb-4 flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                  {currentQuestion.helpText}
                </p>
              )}

              {currentQuestion.inputType === "select" ? (
                <select
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              ) : (
                <input
                  type={currentQuestion.inputType === "number" ? "number" : "text"}
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  placeholder="Enter your answer..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}
            </div>
          ) : null}
        </div>

        {!isSynthesizing && (
          <div className="px-6 pb-6 flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentIndex === 0}
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex-1" />

            {!currentQuestion?.required && (
              <button
                type="button"
                onClick={handleSkip}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <SkipForward className="w-4 h-4" />
                Skip
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm"
            >
              {currentIndex === questions.length - 1 ? "Finish & Analyze" : "Next"}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="px-6 pb-4">
            <p className="text-sm text-red-500">{errorMessage}</p>
          </div>
        )}
      </div>

      <AnalysisResults analysisResult={analysisResult} emptyMessage="Complete all questions to see results." />
    </div>
  );
}
