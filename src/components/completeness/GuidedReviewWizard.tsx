"use client";

import {
  Building2,
  CheckCircle2,
  ChevronDown,
  Send,
  SkipForward,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildAnalysisInputFingerprint } from "@/lib/compliance-snapshot";
import { EMPTY_DEAL_FORM, formatFundingPrograms } from "@/types/deal";
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
  clearGuidedReviewSession,
  GUIDED_REVIEW_SESSION_VERSION,
  loadGuidedReviewSession,
  saveGuidedReviewSession,
  type GuidedReviewSession,
} from "@/lib/guided-review-session";
import type { FollowUpTranscriptEntry } from "@/lib/wizard-interview-transcript";
import {
  getTermSheetGuideContextKey,
  seedTermSheetGuideCache,
} from "@/lib/term-sheet-guide-cache";
import {
  buildGuideContextForSynthesize,
  buildGuideOpeningSuffix,
  resolveTermSheetGuide,
} from "@/lib/term-sheet-guide-bridge";
import {
  applyFollowUpAnswer,
  buildAcknowledgment,
  buildCategoryTransition,
  buildFollowUpAcknowledgment,
  buildOpeningMessage,
  getAnswerByField,
  getFollowUpQuestion,
  isRedundantLoanTypeQuestion,
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
  onAnalysisRestore?: (analysis: AnalysisResult) => void;
  onAnalysisBaselineRestore?: (baseline: string) => void;
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
  onAnalysisRestore,
  onAnalysisBaselineRestore,
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
  const [followUpTranscript, setFollowUpTranscript] = useState<FollowUpTranscriptEntry[]>(
    []
  );
  const [savedSession, setSavedSession] = useState<GuidedReviewSession | null>(null);
  const [sessionPromptOpen, setSessionPromptOpen] = useState(false);
  const [sessionAnalysis, setSessionAnalysis] = useState<AnalysisResult | null>(null);
  const [sessionAnalysisBaseline, setSessionAnalysisBaseline] = useState<string | null>(
    null
  );
  const [resumedContextMismatch, setResumedContextMismatch] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const questionsLockedRef = useRef(false);
  const conversationContext = useMemo(
    () => ({ fundingPrograms, loanType }),
    [fundingPrograms, loanType]
  );
  const contextKey = getWizardContextKey(loanType, selectedAgencies, fundingPrograms);
  const accent = getAccentStyle(selectedAgencies);
  const mainQuestion = questions[currentIndex];
  const currentQuestion = activeFollowUp ?? mainQuestion;
  const mainQuestionIds = useMemo(
    () => new Set(questions.map((q) => q.id)),
    [questions]
  );
  const { mainAnsweredCount, followUpAnsweredCount } = useMemo(() => {
    let main = 0;
    let followUp = 0;
    for (const a of answers) {
      if (a.skipped || !a.value.trim()) continue;
      if (mainQuestionIds.has(a.questionId)) main++;
      else followUp++;
    }
    return { mainAnsweredCount: main, followUpAnsweredCount: followUp };
  }, [answers, mainQuestionIds]);
  const completionSummary = useMemo(() => {
    const base = `${mainAnsweredCount} of ${questions.length} questions answered`;
    if (followUpAnsweredCount === 0) return base;
    const suffix =
      followUpAnsweredCount === 1
        ? "1 follow-up"
        : `${followUpAnsweredCount} follow-ups`;
    return `${base} · ${suffix}`;
  }, [mainAnsweredCount, followUpAnsweredCount, questions.length]);
  const progress = isComplete
    ? 100
    : questions.length > 0
      ? ((currentIndex + 1) / questions.length) * 100
      : 0;

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

  useEffect(() => {
    const session = loadGuidedReviewSession();
    if (session?.hasStarted) {
      setSavedSession(session);
      setSessionPromptOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!hasStarted) return;

    const guide = resolveTermSheetGuide(loanType, selectedAgencies, fundingPrograms);
    const guideKey = guide
      ? getTermSheetGuideContextKey(loanType, selectedAgencies, fundingPrograms)
      : undefined;

    saveGuidedReviewSession({
      version: GUIDED_REVIEW_SESSION_VERSION,
      contextKey,
      savedAt: new Date().toISOString(),
      questions,
      answers,
      messages,
      currentIndex,
      hasStarted,
      isComplete,
      completedFollowUpKeys: [...completedFollowUpKeys],
      followUpTranscript,
      questionsLocked: questionsLockedRef.current,
      analysisResult: isComplete ? sessionAnalysis : null,
      analysisBaseline: isComplete ? sessionAnalysisBaseline : null,
      termSheetGuideKey: guideKey,
      termSheetGuide: guide ?? undefined,
    });
  }, [
    hasStarted,
    isComplete,
    contextKey,
    loanType,
    selectedAgencies,
    fundingPrograms,
    questions,
    answers,
    messages,
    currentIndex,
    completedFollowUpKeys,
    followUpTranscript,
    sessionAnalysis,
    sessionAnalysisBaseline,
  ]);

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

        if (questionsChanged && !questionsLockedRef.current) {
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

    clearGuidedReviewSession();
    setSavedSession(null);
    setSessionPromptOpen(false);
    setSessionAnalysis(null);
    setSessionAnalysisBaseline(null);
    setResumedContextMismatch(false);
    setErrorMessage("");
    setIsComplete(false);
    setEnrichedApplied(false);
    setHelpExpanded(false);
    setActiveFollowUp(null);
    setCompletedFollowUpKeys(new Set());
    setFollowUpTranscript([]);
    questionsLockedRef.current = false;

    const cached = getCachedWizardQuestions(
      loanType,
      selectedAgencies,
      fundingPrograms
    );
    const initialQuestions = cached ?? buildFallbackQuestions(loanType);
    let initialAnswers = prefillLoanTypeAnswer(initialQuestions, loanType);
    const guide = resolveTermSheetGuide(loanType, selectedAgencies, fundingPrograms);
    const openingBase = buildOpeningMessage(conversationContext);
    const openingWithGuide = guide
      ? openingBase + buildGuideOpeningSuffix(guide)
      : openingBase;
    const opening = plainAcknowledgment(openingWithGuide);
    const openingMessages: ChatMessage[] = opening
      ? [{ role: "assistant", content: opening }]
      : [];

    let startIndex = 0;
    let pendingFollowUp: FollowUpQuestion | null = null;
    const initialFollowUpKeys = new Set<string>();

    while (
      startIndex < initialQuestions.length &&
      isRedundantLoanTypeQuestion(initialQuestions[startIndex], loanType)
    ) {
      const skippedQ = initialQuestions[startIndex];
      initialAnswers = [
        ...initialAnswers.filter((a) => a.questionId !== skippedQ.id),
        { questionId: skippedQ.id, value: loanType, skipped: false },
      ];
      openingMessages.push({
        role: "assistant",
        content: plainAcknowledgment(
          buildAcknowledgment(
            skippedQ,
            loanType,
            initialAnswers,
            initialQuestions,
            conversationContext
          )
        ),
        isAcknowledgment: true,
      });

      const followUp = getFollowUpQuestion(
        skippedQ,
        loanType,
        initialAnswers,
        initialQuestions,
        initialFollowUpKeys,
        conversationContext
      );
      if (followUp) {
        pendingFollowUp = followUp;
        initialFollowUpKeys.add(followUp.followUpKey);
        startIndex++;
        break;
      }

      startIndex++;
    }

    const firstQuestion = initialQuestions[startIndex];
    if (pendingFollowUp) {
      openingMessages.push({
        role: "assistant",
        content: pendingFollowUp.question,
        questionId: pendingFollowUp.id,
        helpText: pendingFollowUp.helpText,
        category: pendingFollowUp.category,
      });
    } else if (firstQuestion) {
      openingMessages.push({
        role: "assistant",
        content: firstQuestion.question,
        questionId: firstQuestion.id,
        helpText: firstQuestion.helpText,
        category: firstQuestion.category,
      });
    }

    setQuestions(initialQuestions);
    setAnswers(initialAnswers);
    setCurrentIndex(startIndex);
    setCompletedFollowUpKeys(initialFollowUpKeys);
    setActiveFollowUp(pendingFollowUp);
    setInputValue("");
    setMessages(openingMessages);
    setHasStarted(true);

    if (!pendingFollowUp && !firstQuestion) {
      handleFinish(initialAnswers);
      return;
    }
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
    setFollowUpTranscript([]);
    setSessionAnalysis(null);
    setSessionAnalysisBaseline(null);
    setResumedContextMismatch(false);
    setSessionPromptOpen(false);
    setSavedSession(null);
    questionsLockedRef.current = false;
    clearGuidedReviewSession();
    setAnalysisResult(null);
    onAnalysisCleared?.();
    onWizardReset?.();
  };

  const discardSavedSession = () => {
    clearGuidedReviewSession();
    setSavedSession(null);
    setSessionPromptOpen(false);
  };

  const resumeSavedSession = () => {
    if (!savedSession) return;

    if (savedSession.termSheetGuide && savedSession.termSheetGuideKey) {
      seedTermSheetGuideCache(
        savedSession.termSheetGuideKey,
        savedSession.termSheetGuide
      );
    }

    setResumedContextMismatch(savedSession.contextKey !== contextKey);

    setQuestions(savedSession.questions);
    setAnswers(savedSession.answers);
    setMessages(savedSession.messages);
    setCurrentIndex(savedSession.currentIndex);
    setHasStarted(savedSession.hasStarted);
    setIsComplete(savedSession.isComplete);
    setCompletedFollowUpKeys(new Set(savedSession.completedFollowUpKeys));
    setFollowUpTranscript(savedSession.followUpTranscript);
    setSessionAnalysis(savedSession.analysisResult ?? null);
    questionsLockedRef.current = savedSession.questionsLocked;
    setActiveFollowUp(null);
    setInputValue("");
    setErrorMessage("");
    setEnrichedApplied(true);
    setSessionPromptOpen(false);

    syncAllAnswers(savedSession.questions, savedSession.answers);

    if (savedSession.analysisResult) {
      setAnalysisResult(savedSession.analysisResult);
      onAnalysisRestore?.(savedSession.analysisResult);

      if (savedSession.analysisBaseline) {
        setSessionAnalysisBaseline(savedSession.analysisBaseline);
        onAnalysisBaselineRestore?.(savedSession.analysisBaseline);
      } else if (savedSession.isComplete && savedSession.contextKey === contextKey) {
        onAnalysisComplete?.();
      }
    }
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

    const prevCategory = questions[currentIndex]?.category;
    let nextIndex = currentIndex + 1;
    let workingAnswers = updatedAnswers;

    const batch: Array<{
      content: string;
      questionId?: string;
      helpText?: string;
      category?: string;
      isAcknowledgment?: boolean;
    }> = [];

    while (
      nextIndex < questions.length &&
      isRedundantLoanTypeQuestion(questions[nextIndex], loanType)
    ) {
      const skippedQ = questions[nextIndex];
      workingAnswers = [
        ...workingAnswers.filter((a) => a.questionId !== skippedQ.id),
        { questionId: skippedQ.id, value: loanType, skipped: false },
      ];
      setAnswers(workingAnswers);
      syncField("loanType", loanType);

      batch.push({
        content: buildAcknowledgment(
          skippedQ,
          loanType,
          workingAnswers,
          questions,
          conversationContext
        ),
        isAcknowledgment: true,
      });

      const followUp = getFollowUpQuestion(
        skippedQ,
        loanType,
        workingAnswers,
        questions,
        completedFollowUpKeys,
        conversationContext
      );

      if (followUp) {
        setCurrentIndex(nextIndex);
        setHelpExpanded(false);
        setActiveFollowUp(followUp);
        setInputValue("");
        batch.push({
          content: followUp.question,
          questionId: followUp.id,
          helpText: followUp.helpText,
          category: followUp.category,
        });
        appendAssistantMessages(batch);
        return;
      }

      nextIndex++;
    }

    if (nextIndex >= questions.length) {
      setAnswers(workingAnswers);
      handleFinish(workingAnswers);
      return;
    }

    const nextQuestion = questions[nextIndex];
    setCurrentIndex(nextIndex);
    setHelpExpanded(false);
    setActiveFollowUp(null);
    setAnswers(workingAnswers);
    setInputValue(nextQuestion.field === "loanType" ? loanType : "");

    const transition = buildCategoryTransition(prevCategory, nextQuestion.category);
    if (transition) {
      batch.push({ content: transition, isAcknowledgment: true });
    }

    batch.push({
      content: nextQuestion.question,
      questionId: nextQuestion.id,
      helpText: nextQuestion.helpText,
      category: nextQuestion.category,
    });

    appendAssistantMessages(batch);
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
      questions,
      conversationContext
    );

    appendAssistantMessages([{ content: ack, isAcknowledgment: true }]);

    const followUp = getFollowUpQuestion(
      triggerQuestion,
      answerValue,
      updatedAnswers,
      questions,
      completedFollowUpKeys,
      conversationContext
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

  const handleSend = () => {
    if (!currentQuestion || isSynthesizing) return;

    const trimmed = inputValue.trim();
    if (!trimmed && currentQuestion.required) {
      setErrorMessage("This field is required. Enter a value or skip if optional.");
      return;
    }

    setErrorMessage("");
    questionsLockedRef.current = true;
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
      setFollowUpTranscript((prev) => [
        ...prev,
        {
          questionId: activeFollowUp.id,
          category: activeFollowUp.category,
          question: activeFollowUp.question,
          answer: trimmed,
          skipped: false,
        },
      ]);
      setActiveFollowUp(null);

      appendAssistantMessages([
        { content: buildFollowUpAcknowledgment(trimmed), isAcknowledgment: true },
      ]);
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
    questionsLockedRef.current = true;
    setMessages((prev) => [...prev, { role: "user", content: "Skipped", skipped: true }]);

    if (activeFollowUp) {
      setCompletedFollowUpKeys((prev) => new Set(prev).add(activeFollowUp.followUpKey));
      setFollowUpTranscript((prev) => [
        ...prev,
        {
          questionId: activeFollowUp.id,
          category: activeFollowUp.category,
          question: activeFollowUp.question,
          answer: "",
          skipped: true,
        },
      ]);
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
          followUpTranscript,
          termSheetGuideContext: (() => {
            const guide = resolveTermSheetGuide(
              loanType,
              selectedAgencies,
              fundingPrograms
            );
            return guide ? buildGuideContextForSynthesize(guide) : undefined;
          })(),
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        const formPatch = applyWizardAnswersToFormData(
          questions,
          finalAnswers,
          loanType
        );
        const baseline = buildAnalysisInputFingerprint(
          {
            ...EMPTY_DEAL_FORM,
            fundingPrograms,
            loanType,
            ...formPatch,
          },
          loanType,
          selectedAgencies
        );
        setAnalysisResult(data.analysis);
        setSessionAnalysis(data.analysis);
        setSessionAnalysisBaseline(baseline);
        setResumedContextMismatch(false);
        syncAllAnswers(questions, finalAnswers);
        onAnalysisBaselineRestore?.(baseline);
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
    const contextMatchesSaved = savedSession?.contextKey === contextKey;

    return (
      <div className="relative bg-white rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 via-white to-sky-50/40 pointer-events-none" />
          <div className="relative px-8 py-10 text-center">
            {sessionPromptOpen && savedSession && (
              <div className="max-w-md mx-auto mb-6 text-left rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-3">
                <p className="text-sm font-medium text-amber-900">
                  Resume your guided review?
                </p>
                <p className="text-xs text-amber-800/90 leading-relaxed">
                  {contextMatchesSaved
                    ? savedSession.isComplete
                      ? "A completed review is saved from this session."
                      : "An in-progress review is saved for this deal context."
                    : "Saved review used a different sidebar context — resume anyway or start fresh."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={resumeSavedSession}
                    className="inline-flex items-center gap-1.5 bg-[#0d6e52] hover:bg-[#0a5a43] text-white px-4 py-2 rounded-lg text-xs font-medium"
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={discardSavedSession}
                    className="inline-flex items-center gap-1.5 border border-amber-300 text-amber-900 hover:bg-amber-100/80 px-4 py-2 rounded-lg text-xs font-medium"
                  >
                    Start fresh
                  </button>
                </div>
              </div>
            )}
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

  return (
    <div className="max-w-4xl mx-auto flex flex-col bg-white rounded-xl border border-border-subtle shadow-sm overflow-hidden min-h-[520px]">
        <div
          className={`px-6 py-4 border-b ${
            isComplete
              ? "border-emerald-200 bg-gradient-to-r from-emerald-50 to-white"
              : "border-slate-100 bg-gradient-to-r from-slate-50 to-white"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-800">Guided Review</h3>
              {isComplete ? (
                <p className="text-xs text-emerald-700 mt-0.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Complete — {completionSummary}
                </p>
              ) : (
                <p className="text-xs text-slate-500 mt-0.5">
                  Question {currentIndex + 1} of {questions.length}
                  {activeFollowUp && (
                    <span className="ml-2 text-brand">· follow-up</span>
                  )}
                  {isEnriching && !enrichedApplied && (
                    <span className="ml-2 text-brand">· tailoring questions to rulebooks...</span>
                  )}
                </p>
              )}
            </div>
            <button
              onClick={handleReset}
              className={`text-xs transition-colors shrink-0 ${
                isComplete
                  ? "text-emerald-700 hover:text-emerald-900 font-medium"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {isComplete ? "Start over" : "Cancel"}
            </button>
          </div>
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden mt-3">
            <div
              className={`h-full ${isComplete ? "bg-emerald-500" : accent.progress} rounded-full transition-all duration-500 ease-out`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {resumedContextMismatch && (
            <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
              Sidebar context differs from the saved session — interview answers were
              restored, but results may not match current rulebooks or programs.
            </p>
          )}
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

        {isComplete && (
          <div className="p-4 border-t border-emerald-100 bg-emerald-50/50">
            <p className="text-xs text-emerald-800 text-center">
              Conversation saved below — deal snapshot is in the results section.
            </p>
          </div>
        )}

        {!isComplete && !isSynthesizing && currentQuestion && (
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
