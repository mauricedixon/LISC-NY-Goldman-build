#!/usr/bin/env node
/**
 * Phase 2b/2c hardening smoke tests for POST /api/wizard/next-turn
 *
 * Usage: node scripts/test-wizard-hardening.mjs
 * Requires: WIZARD_NEXT_TURN=true, WIZARD_LLM_CONVERSATION=true (optional)
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";

const CONTEXT = {
  loanType: "New Construction",
  agencies: ["hpd", "hcr"],
  fundingPrograms: ["LIHTC", "HPD"],
};

function makeQuestions() {
  return [
    { id: "project_name", category: "Project Basics", field: "projectName", question: "Project name?", inputType: "text", required: true },
    { id: "developer_name", category: "Project Basics", field: "developerName", question: "Developer or sponsor?", inputType: "text", required: true },
    { id: "loan_type", category: "Project Basics", field: "loanType", question: "4% or 9% LIHTC?", inputType: "text", required: true },
    { id: "borough", category: "Project Basics", field: "borough", question: "Which borough?", inputType: "select", required: true },
    { id: "total_units", category: "Unit Mix", field: "totalUnits", question: "Total units?", inputType: "number", required: true },
    { id: "tdc", category: "Financials", field: "totalDevelopmentCost", question: "TDC?", inputType: "text", required: true },
    { id: "loan", category: "Financials", field: "requestedLoanAmount", question: "Loan amount?", inputType: "text", required: true },
    { id: "notes", category: "Additional", field: "additionalNotes", question: "Anything else?", inputType: "textarea", required: false },
  ];
}

async function postNextTurn(body) {
  const res = await fetch(`${BASE}/api/wizard/next-turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function main() {
  console.log("\nWizard hardening smoke tests");
  console.log(`Endpoint: ${BASE}/api/wizard/next-turn\n`);

  const questions = makeQuestions();
  let answers = [];
  let completedFollowUpKeys = [];
  let remainingQuestionIds = [];
  let currentIndex = 0;

  const t1 = await postNextTurn({
    ...CONTEXT,
    currentIndex: 0,
    triggerQuestion: questions[0],
    answerValue: "Riverside Commons",
    skipped: false,
    turnType: "main_answer",
    questions,
    answers,
    completedFollowUpKeys,
    remainingQuestionIds,
  });

  if (!t1.success) {
    console.log("❌ Turn 1 failed:", t1);
    process.exit(1);
  }
  answers = t1.workingAnswers;
  remainingQuestionIds = t1.remainingQuestionIds;
  console.log(`✅ Main turn 1: action=${t1.nextAction} remaining=${remainingQuestionIds.length}`);

  currentIndex = 1;
  const t2 = await postNextTurn({
    ...CONTEXT,
    currentIndex,
    triggerQuestion: questions[1],
    answerValue: "Lawrence Housing Development",
    skipped: false,
    turnType: "main_answer",
    questions,
    answers,
    completedFollowUpKeys,
    remainingQuestionIds,
  });
  if (!t2.success) {
    console.log("❌ Turn 2 failed:", t2);
    process.exit(1);
  }
  answers = t2.workingAnswers;
  remainingQuestionIds = t2.remainingQuestionIds;
  console.log(`✅ Main turn 2: action=${t2.nextAction} remaining=${remainingQuestionIds.length}`);

  currentIndex = 3;
  const t3 = await postNextTurn({
    ...CONTEXT,
    currentIndex,
    triggerQuestion: questions[3],
    answerValue: "The Bronx",
    skipped: false,
    turnType: "main_answer",
    questions,
    answers: [
      ...answers.filter((a) => a.questionId !== questions[3].id),
      { questionId: questions[3].id, value: "The Bronx", skipped: false },
    ],
    completedFollowUpKeys,
    remainingQuestionIds,
  });
  if (!t3.success) {
    console.log("❌ Borough turn failed:", t3);
    process.exit(1);
  }
  if (t3.nextAction !== "follow_up" || t3.followUp?.followUpKey !== "followup_hpd_setasides") {
    console.log("❌ Expected HPD follow-up, got:", t3.nextAction, t3.followUp?.followUpKey);
    process.exit(1);
  }
  console.log(`✅ Borough → rule follow-up: ${t3.followUp.followUpKey}`);

  const mainQ = questions[3];
  const fu = t3.followUp;
  const t4 = await postNextTurn({
    ...CONTEXT,
    currentIndex,
    triggerQuestion: fu,
    mainQuestion: mainQ,
    answeredFollowUp: fu,
    answerValue: "15% formerly homeless per HPD NCF",
    skipped: false,
    turnType: "follow_up_answer",
    questions,
    answers: t3.workingAnswers,
    completedFollowUpKeys: [...completedFollowUpKeys, fu.followUpKey],
    remainingQuestionIds: t3.remainingQuestionIds,
  });
  if (!t4.success) {
    console.log("❌ Follow-up answer turn failed:", t4);
    process.exit(1);
  }
  console.log(`✅ Follow-up answer: action=${t4.nextAction}`);
  if (t4.nextAction === "follow_up") {
    console.log(`   Chained follow-up: ${t4.followUp?.followUpKey}`);
  } else if (t4.nextAction === "main_question") {
    console.log(`   Next main: ${t4.mainQuestion?.field}`);
  }

  const t5 = await postNextTurn({
    ...CONTEXT,
    currentIndex: 4,
    triggerQuestion: questions[4],
    answerValue: "120",
    skipped: false,
    turnType: "main_answer",
    questions,
    answers: [
      ...t4.workingAnswers.filter((a) => a.questionId !== questions[4].id),
      { questionId: questions[4].id, value: "120", skipped: false },
    ],
    completedFollowUpKeys: [...completedFollowUpKeys, fu.followUpKey],
    remainingQuestionIds: t4.remainingQuestionIds,
  });
  if (!t5.success || t5.nextAction !== "follow_up") {
    console.log("❌ totalUnits should trigger LIHTC follow-up:", t5);
    process.exit(1);
  }
  console.log(`✅ totalUnits → ${t5.followUp?.followUpKey}`);

  console.log("\n✅ All hardening smoke tests passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
