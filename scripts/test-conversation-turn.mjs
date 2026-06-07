#!/usr/bin/env node
/**
 * Smoke test for POST /api/wizard/conversation-turn
 *
 * Usage:
 *   node scripts/test-conversation-turn.mjs
 *   WIZARD_LLM_CONVERSATION=true node scripts/test-conversation-turn.mjs
 *
 * Requires dev server on localhost:3000
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const sampleQuestion = {
  id: "project_name",
  category: "Project Basics",
  field: "projectName",
  question: "What's the project name?",
  inputType: "text",
  required: true,
};

const ambiguousUnits = {
  id: "total_units",
  category: "Unit Mix",
  field: "totalUnits",
  question: "How many total units?",
  inputType: "number",
  required: true,
};

async function postTurn(body) {
  const start = Date.now();
  const response = await fetch(`${BASE_URL}/api/wizard/conversation-turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  return { response, data, elapsed };
}

async function main() {
  console.log("\nConversation-turn API smoke test");
  console.log(`Endpoint: ${BASE_URL}/api/wizard/conversation-turn\n`);

  const basePayload = {
    loanType: "New Construction",
    agencies: ["hcr", "hpd"],
    fundingPrograms: ["LIHTC", "HPD"],
    questions: [sampleQuestion, ambiguousUnits],
    answers: [
      { questionId: "project_name", value: "Riverside Commons", skipped: false },
    ],
    recentMessages: [
      { role: "assistant", content: "Quick context on your LIHTC + HPD New Construction deal." },
      { role: "assistant", content: "What's the project name?" },
      { role: "user", content: "Riverside Commons" },
    ],
  };

  // Flag-off / disabled behavior
  const disabled = await postTurn({
    ...basePayload,
    triggerQuestion: sampleQuestion,
    answerValue: "Riverside Commons",
    skipped: false,
  });

  if (disabled.response.status === 403) {
    console.log("✅ Flag off: API returns 403 (expected when WIZARD_LLM_CONVERSATION unset)");
  } else if (disabled.data.success) {
    console.log(`✅ Flag on: ack in ${disabled.elapsed}s — "${disabled.data.acknowledgment?.slice(0, 100)}..."`);
    if (disabled.data.needsClarification) {
      console.log(`   Clarification: ${disabled.data.clarification?.question}`);
    } else {
      console.log("   needsClarification: false");
    }
  } else {
    console.log(`⚠️  Unexpected response (${disabled.response.status}):`, disabled.data.error);
  }

  // Ambiguous answer case (only meaningful when flag is on)
  if (disabled.response.status !== 403) {
    const ambiguous = await postTurn({
      ...basePayload,
      triggerQuestion: ambiguousUnits,
      answerValue: "120",
      skipped: false,
    });

    if (ambiguous.data.success) {
      console.log(`\n✅ Ambiguous units ack in ${ambiguous.elapsed}s`);
      console.log(`   needsClarification: ${ambiguous.data.needsClarification}`);
      if (ambiguous.data.clarification) {
        console.log(`   Q: ${ambiguous.data.clarification.question}`);
      }
    }
  } else {
    console.log("\n⏭️  Skipping LLM ack/clarification checks — enable WIZARD_LLM_CONVERSATION=true to test");
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
