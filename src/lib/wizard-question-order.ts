import { isFieldSatisfiedByPriorAnswers } from "@/lib/wizard-answer-informed-skip";
import {
  getAnswerByField,
  isRedundantLoanTypeQuestion,
  type WizardConversationContext,
} from "@/lib/wizard-conversation";
import type { WizardAnswer, WizardQuestion } from "@/types/wizard";

const CANONICAL_FIELD_ORDER = [
  "projectName",
  "developerName",
  "loanType",
  "borough",
  "totalUnits",
  "totalDevelopmentCost",
  "requestedLoanAmount",
  "additionalNotes",
] as const;

export function computeProgramAwareFieldOrder(
  fundingPrograms: string[],
  loanType: string
): string[] {
  const order = [...CANONICAL_FIELD_ORDER];

  if (fundingPrograms.includes("LIHTC")) {
    // Unit mix before financials — ensure totalUnits precedes TDC/loan.
    const unitsIdx = order.indexOf("totalUnits");
    const tdcIdx = order.indexOf("totalDevelopmentCost");
    if (unitsIdx > -1 && tdcIdx > -1 && unitsIdx > tdcIdx) {
      order.splice(unitsIdx, 1);
      order.splice(tdcIdx, 0, "totalUnits");
    }
    // Borough before financials for NYC program context.
    const boroughIdx = order.indexOf("borough");
    if (boroughIdx > -1 && tdcIdx > -1 && boroughIdx > tdcIdx) {
      order.splice(boroughIdx, 1);
      order.splice(tdcIdx, 0, "borough");
    }
  }

  if (fundingPrograms.includes("HPD")) {
    // Location early for HPD set-aside follow-ups.
    const boroughIdx = order.indexOf("borough");
    const devIdx = order.indexOf("developerName");
    if (boroughIdx > -1 && devIdx > -1 && boroughIdx > devIdx + 2) {
      order.splice(boroughIdx, 1);
      order.splice(devIdx + 1, 0, "borough");
    }
  }

  if (loanType === "Preservation / Rehab") {
    // Loan type / scope context before unit count.
    const loanIdx = order.indexOf("loanType");
    const unitsIdx = order.indexOf("totalUnits");
    if (loanIdx > -1 && unitsIdx > -1 && loanIdx > unitsIdx) {
      order.splice(loanIdx, 1);
      order.splice(unitsIdx, 0, "loanType");
    }
  }

  return order;
}

function questionByField(questions: WizardQuestion[]): Map<string, WizardQuestion> {
  const map = new Map<string, WizardQuestion>();
  for (const q of questions) {
    if (!map.has(q.field)) map.set(q.field, q);
  }
  return map;
}

function isMainFieldAnswered(
  field: string,
  questions: WizardQuestion[],
  answers: WizardAnswer[]
): boolean {
  const q = questions.find((x) => x.field === field);
  if (!q) return true;
  const ans = answers.find((a) => a.questionId === q.id);
  return Boolean(ans && !ans.skipped && ans.value.trim());
}

export interface BuildRemainingOptions {
  questions: WizardQuestion[];
  loanType: string;
  fundingPrograms: string[];
  answers: WizardAnswer[];
  dynamicEnabled: boolean;
}

/** Ordered question ids still to ask (one id per standard field). */
export function buildRemainingQuestionIds(options: BuildRemainingOptions): string[] {
  const { questions, loanType, fundingPrograms, answers, dynamicEnabled } = options;
  const byField = questionByField(questions);
  const fieldOrder = dynamicEnabled
    ? computeProgramAwareFieldOrder(fundingPrograms, loanType)
    : [...CANONICAL_FIELD_ORDER];

  const ids: string[] = [];
  for (const field of fieldOrder) {
    const q = byField.get(field);
    if (!q) continue;
    if (isRedundantLoanTypeQuestion(q, loanType)) continue;
    if (isMainFieldAnswered(field, questions, answers)) continue;
    if (
      isFieldSatisfiedByPriorAnswers(q, answers, questions, fundingPrograms).skip
    ) {
      continue;
    }
    ids.push(q.id);
  }
  return ids;
}

export interface AdvanceQueueResult {
  remainingQuestionIds: string[];
  skippedQuestionIds: string[];
  workingAnswers: WizardAnswer[];
  nextQuestion: WizardQuestion | null;
  nextIndex: number;
}

/** Skip answered/redundant heads, auto-fill sidebar loan type when skipped. */
export function advanceQuestionQueue(
  remainingIds: string[],
  questions: WizardQuestion[],
  answers: WizardAnswer[],
  loanType: string,
  ctx: WizardConversationContext
): AdvanceQueueResult {
  const queue = [...remainingIds];
  const skippedQuestionIds: string[] = [];
  let workingAnswers = [...answers];

  while (queue.length > 0) {
    const headId = queue[0];
    const head = questions.find((q) => q.id === headId);
    if (!head) {
      queue.shift();
      continue;
    }

    if (isRedundantLoanTypeQuestion(head, loanType)) {
      queue.shift();
      skippedQuestionIds.push(headId);
      workingAnswers = [
        ...workingAnswers.filter((a) => a.questionId !== head.id),
        { questionId: head.id, value: loanType, skipped: false },
      ];
      continue;
    }

    if (isMainFieldAnswered(head.field, questions, workingAnswers)) {
      queue.shift();
      skippedQuestionIds.push(headId);
      continue;
    }

    const informed = isFieldSatisfiedByPriorAnswers(
      head,
      workingAnswers,
      questions,
      ctx.fundingPrograms ?? []
    );
    if (informed.skip) {
      queue.shift();
      skippedQuestionIds.push(headId);
      if (informed.inferredValue) {
        workingAnswers = [
          ...workingAnswers.filter((a) => a.questionId !== head.id),
          { questionId: head.id, value: informed.inferredValue, skipped: false },
        ];
      }
      continue;
    }

    const nextIndex = questions.findIndex((q) => q.id === headId);
    return {
      remainingQuestionIds: queue,
      skippedQuestionIds,
      workingAnswers,
      nextQuestion: head,
      nextIndex: nextIndex >= 0 ? nextIndex : 0,
    };
  }

  return {
    remainingQuestionIds: [],
    skippedQuestionIds,
    workingAnswers,
    nextQuestion: null,
    nextIndex: questions.length,
  };
}

export function removeQuestionFromRemaining(
  remainingIds: string[],
  questionId: string
): string[] {
  return remainingIds.filter((id) => id !== questionId);
}

export function getMainAnswerValue(
  mainQuestion: WizardQuestion,
  answers: WizardAnswer[]
): string {
  return answers.find((a) => a.questionId === mainQuestion.id)?.value ?? "";
}
