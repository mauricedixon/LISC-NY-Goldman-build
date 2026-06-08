#!/usr/bin/env node
/**
 * Smoke test for POST /api/wizard/next-turn (Phase 2b)
 * Requires WIZARD_NEXT_TURN=true and WIZARD_LLM_CONVERSATION=true
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";

const questions = [
  {
    id: "project_name",
    category: "Project Basics",
    field: "projectName",
    question: "What's the project name?",
    inputType: "text",
    required: true,
  },
  {
    id: "developer_name",
    category: "Project Basics",
    field: "developerName",
    question: "Who is the sponsor?",
    inputType: "text",
    required: true,
  },
  {
    id: "borough",
    category: "Project Basics",
    field: "borough",
    question: "Which borough?",
    inputType: "select",
    required: true,
  },
  {
    id: "total_units",
    category: "Unit Mix",
    field: "totalUnits",
    question: "Total units?",
    inputType: "number",
    required: true,
  },
];

async function postNextTurn(body) {
  const start = Date.now();
  const res = await fetch(`${BASE}/api/wizard/next-turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data, ms: Date.now() - start };
}

async function main() {
  console.log("\nNext-turn API smoke test");
  console.log(`Endpoint: ${BASE}/api/wizard/next-turn\n`);

  const base = {
    loanType: "New Construction",
    agencies: ["hpd", "hcr"],
    fundingPrograms: ["LIHTC", "HPD"],
    questions,
    completedFollowUpKeys: [],
    recentMessages: [],
  };

  const disabled = await postNextTurn({
    ...base,
    currentIndex: 0,
    triggerQuestion: questions[0],
    answerValue: "Riverside Commons",
    skipped: false,
    answers: [{ questionId: "project_name", value: "Riverside Commons", skipped: false }],
  });

  if (disabled.status === 403) {
    console.log("✅ Flag off: API returns 403");
    console.log("   Enable WIZARD_NEXT_TURN=true to test orchestration");
    return;
  }

  if (!disabled.data.success) {
    console.log("❌ Unexpected:", disabled.data);
    process.exit(1);
  }

  console.log(`✅ Turn 1 (${disabled.ms}ms): action=${disabled.data.nextAction}`);
  console.log(`   Ack: ${disabled.data.acknowledgment?.slice(0, 90)}...`);

  const answers = [
    { questionId: "project_name", value: "Riverside Commons", skipped: false },
    { questionId: "developer_name", value: "Lawrence Housing Development", skipped: false },
  ];

  const turn2 = await postNextTurn({
    ...base,
    currentIndex: 1,
    triggerQuestion: questions[1],
    answerValue: "Lawrence Housing Development",
    skipped: false,
    answers,
  });

  console.log(`✅ Turn 2 (${turn2.ms}ms): action=${turn2.data.nextAction}`);

  const answers3 = [
    ...answers,
    { questionId: "borough", value: "The Bronx", skipped: false },
  ];

  const turn3 = await postNextTurn({
    ...base,
    currentIndex: 2,
    triggerQuestion: questions[2],
    answerValue: "The Bronx",
    skipped: false,
    answers: answers3,
  });

  console.log(`✅ Turn 3 (${turn3.ms}ms): action=${turn3.data.nextAction}`);
  if (turn3.data.followUp) {
    console.log(`   Rule follow-up: ${turn3.data.followUp.followUpKey}`);
  }
  if (turn3.data.clarification) {
    console.log(`   LLM clarify: ${turn3.data.clarification.question}`);
  }
  if (turn3.data.remainingQuestionIds) {
    console.log(`   Remaining queue: ${turn3.data.remainingQuestionIds.length} ids`);
  }

  console.log("\nRun node scripts/test-wizard-hardening.mjs for follow-up chain tests.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
