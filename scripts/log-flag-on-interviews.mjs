#!/usr/bin/env node
/**
 * Walk two full flag-on interview scenarios through next-turn,
 * logging Haiku acks, LLM clarifications, and rule follow-ups.
 *
 * Usage: node scripts/log-flag-on-interviews.mjs
 * Requires dev server + WIZARD_NEXT_TURN=true (+ WIZARD_LLM_CONVERSATION=true for LLM acks)
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";

const SCENARIOS = [
  {
    id: "riverside",
    name: "Scenario A — Riverside Commons (New Construction · LIHTC + HPD)",
    loanType: "New Construction",
    agencies: ["hpd", "hcr"],
    fundingPrograms: ["LIHTC", "HPD"],
    answers: {
      projectName: "Riverside Commons",
      developerName: "Lawrence Housing Development",
      loanType: "New Construction",
      borough: "The Bronx",
      totalUnits: "120",
      totalDevelopmentCost: "45000000",
      requestedLoanAmount: "35000000",
      additionalNotes:
        "LIHTC 40/60 set-aside; 15% formerly homeless per HPD NCF",
    },
    followUpAnswers: {
      followup_hpd_setasides: "15% formerly homeless per HPD NCF",
      followup_lihtc_setasides: "40/60 LIHTC set-aside",
      followup_construction_phasing: "Single building, one CO",
      followup_leverage_implied:
        "HPD loan plus LIHTC equity; standard construction financing stack",
    },
    clarificationAnswers: {
      lihtc_percentage: "9% LIHTC",
      lihtc_40_60_unit_split: "Split per 40/60 election — details TBD",
    },
  },
  {
    id: "harlem",
    name: "Scenario B — Harlem Heights Rehab (Preservation · LIHTC + HCR)",
    loanType: "Preservation / Rehab",
    agencies: ["hcr"],
    fundingPrograms: ["LIHTC", "HCR"],
    answers: {
      projectName: "Harlem Heights Rehab",
      developerName: "Uptown Community Partners",
      loanType: "Preservation / Rehab",
      borough: "Brooklyn",
      totalUnits: "85",
      totalDevelopmentCost: "28000000",
      requestedLoanAmount: "18000000",
      additionalNotes: "Moderate rehab; 100% affordable at 60% AMI",
    },
    followUpAnswers: {
      followup_hcr_rent_restrictions: "HCR MBR schedule; no market units",
      followup_lihtc_setasides: "40/60 LIHTC",
      followup_rehab_scope: "Moderate rehab — systems + envelope, not gut",
    },
    clarificationAnswers: {},
  },
];

async function fetchQuestions(scenario) {
  const res = await fetch(`${BASE}/api/wizard/generate-questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      loanType: scenario.loanType,
      agencies: scenario.agencies,
      fundingPrograms: scenario.fundingPrograms,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.questions?.length) {
    throw new Error(data.error || "generate-questions failed");
  }
  return { questions: data.questions, usedFallback: data.usedFallback };
}

async function nextTurn(payload) {
  const start = Date.now();
  const res = await fetch(`${BASE}/api/wizard/next-turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { status: res.status, data, ms: Date.now() - start };
}

function upsertAnswer(answers, questionId, value, skipped = false) {
  return [
    ...answers.filter((a) => a.questionId !== questionId),
    { questionId, value, skipped },
  ];
}

async function drainFollowUps(scenario, state, mainQuestion, firstTurn) {
  let turn = firstTurn;
  let mainQ = mainQuestion;

  while (turn.data.success && turn.data.nextAction === "follow_up" && turn.data.followUp) {
    const fu = turn.data.followUp;
    const fuAnswer =
      scenario.followUpAnswers[fu.followUpKey] ?? "(answered in interview)";

    state.messages.push({ role: "assistant", content: fu.question });
    state.messages.push({ role: "user", content: fuAnswer });
    state.completedFollowUpKeys.add(fu.followUpKey);

    turn = await nextTurn({
      loanType: scenario.loanType,
      agencies: scenario.agencies,
      fundingPrograms: scenario.fundingPrograms,
      currentIndex: state.currentIndex,
      triggerQuestion: fu,
      mainQuestion: mainQ,
      answeredFollowUp: fu,
      answerValue: fuAnswer,
      skipped: false,
      turnType: "follow_up_answer",
      questions: state.questions,
      answers: turn.data.workingAnswers,
      completedFollowUpKeys: [...state.completedFollowUpKeys],
      remainingQuestionIds: turn.data.remainingQuestionIds ?? state.remainingQuestionIds,
      recentMessages: state.messages.slice(-8),
    });

    state.turns.push({
      type: "follow_up_answer",
      key: fu.followUpKey,
      question: fu.question,
      answer: fuAnswer,
      ackMs: turn.ms,
      acknowledgment: turn.data.success ? turn.data.acknowledgment : turn.data.error,
      nextAction: turn.data.success ? turn.data.nextAction : "error",
      chainedFollowUp: turn.data.success && turn.data.followUp ? turn.data.followUp : null,
    });

    if (!turn.data.success) break;
    state.answers = turn.data.workingAnswers;
    state.remainingQuestionIds = turn.data.remainingQuestionIds ?? [];
  }

  return turn;
}

async function answerClarification(scenario, state, mainQuestion, clarifyTurn) {
  const clarification = clarifyTurn.data.clarification;
  if (!clarification) return clarifyTurn;

  const clarifyAnswer =
    scenario.clarificationAnswers[clarification.clarificationKey] ??
    "See additional notes";

  const fu = {
    id: clarification.clarificationKey,
    followUpKey: clarification.clarificationKey,
    category: mainQuestion.category,
    field: clarification.storeInField,
    storeInField: clarification.storeInField,
    mergeMode: "append",
    question: clarification.question,
    helpText: clarification.helpText,
    inputType: "textarea",
    required: false,
    source: "llm",
  };

  state.messages.push({ role: "assistant", content: clarification.question });
  state.messages.push({ role: "user", content: clarifyAnswer });
  state.completedFollowUpKeys.add(clarification.clarificationKey);

  const turn = await nextTurn({
    loanType: scenario.loanType,
    agencies: scenario.agencies,
    fundingPrograms: scenario.fundingPrograms,
    currentIndex: state.currentIndex,
    triggerQuestion: fu,
    mainQuestion,
    answeredFollowUp: fu,
    answerValue: clarifyAnswer,
    skipped: false,
    turnType: "clarification_answer",
    questions: state.questions,
    answers: clarifyTurn.data.workingAnswers,
    completedFollowUpKeys: [...state.completedFollowUpKeys],
    remainingQuestionIds: clarifyTurn.data.remainingQuestionIds ?? state.remainingQuestionIds,
    recentMessages: state.messages.slice(-8),
  });

  state.turns.push({
    type: "clarification_answer",
    key: clarification.clarificationKey,
    question: clarification.question,
    answer: clarifyAnswer,
    ackMs: turn.ms,
    acknowledgment: turn.data.success ? turn.data.acknowledgment : turn.data.error,
    nextAction: turn.data.success ? turn.data.nextAction : "error",
  });

  if (turn.data.success) {
    state.answers = turn.data.workingAnswers;
    state.remainingQuestionIds = turn.data.remainingQuestionIds ?? [];
    return drainFollowUps(scenario, state, mainQuestion, turn);
  }

  return turn;
}

async function runScenario(scenario) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(scenario.name);
  console.log("=".repeat(72));

  const { questions, usedFallback } = await fetchQuestions(scenario);
  console.log(`Questions: ${questions.length} (${usedFallback ? "fallback" : "enriched"})`);

  const state = {
    questions,
    answers: [],
    completedFollowUpKeys: new Set(),
    remainingQuestionIds: [],
    currentIndex: 0,
    messages: [],
    turns: [],
  };

  const fieldsInOrder = [
    "projectName",
    "developerName",
    "loanType",
    "borough",
    "totalUnits",
    "totalDevelopmentCost",
    "requestedLoanAmount",
    "additionalNotes",
  ];

  for (const field of fieldsInOrder) {
    const answerValue = scenario.answers[field];
    if (answerValue === undefined) continue;

    const q = questions.find((x) => x.field === field);
    if (!q) continue;

    const currentIndex = questions.findIndex((x) => x.id === q.id);
    state.currentIndex = currentIndex >= 0 ? currentIndex : state.currentIndex;
    state.answers = upsertAnswer(state.answers, q.id, answerValue);

    state.messages.push({ role: "assistant", content: q.question });
    state.messages.push({ role: "user", content: answerValue });

    let turn = await nextTurn({
      loanType: scenario.loanType,
      agencies: scenario.agencies,
      fundingPrograms: scenario.fundingPrograms,
      currentIndex: state.currentIndex,
      triggerQuestion: q,
      answerValue,
      skipped: false,
      turnType: "main_answer",
      questions: state.questions,
      answers: state.answers,
      completedFollowUpKeys: [...state.completedFollowUpKeys],
      remainingQuestionIds: state.remainingQuestionIds,
      recentMessages: state.messages.slice(-8),
    });

    if (turn.status === 403) {
      console.error("❌ Flag off — enable WIZARD_NEXT_TURN=true");
      process.exit(1);
    }

    const record = {
      field,
      question: q.question,
      answer: answerValue,
      ackMs: turn.ms,
      acknowledgment: turn.data.success ? turn.data.acknowledgment : turn.data.error,
      llmClarification:
        turn.data.success && turn.data.nextAction === "clarification"
          ? turn.data.clarification
          : null,
      ruleFollowUp:
        turn.data.success && turn.data.nextAction === "follow_up" && turn.data.followUp?.source === "rule"
          ? {
              source: "rule",
              key: turn.data.followUp.followUpKey,
              category: turn.data.followUp.category,
              question: turn.data.followUp.question,
            }
          : null,
      nextAction: turn.data.success ? turn.data.nextAction : "error",
      remainingAfter: turn.data.success ? turn.data.remainingQuestionIds?.length : null,
    };
    state.turns.push(record);

    console.log(`\n[${field}] ${q.question}`);
    console.log(`  Answer: ${answerValue}`);
    console.log(
      `  Haiku ack (${turn.ms}ms): ${record.acknowledgment?.slice(0, 120)}${(record.acknowledgment?.length ?? 0) > 120 ? "…" : ""}`
    );
    console.log(`  next-turn action: ${record.nextAction}`);
    if (record.llmClarification) {
      console.log(`  ⚠️  LLM clarification: ${record.llmClarification.question}`);
    } else {
      console.log(`  LLM clarification: none`);
    }
    if (record.ruleFollowUp) {
      console.log(`  Rule follow-up: ${record.ruleFollowUp.question}`);
    }

    if (!turn.data.success) continue;

    state.answers = turn.data.workingAnswers;
    state.remainingQuestionIds = turn.data.remainingQuestionIds ?? [];

    if (turn.data.nextAction === "follow_up") {
      turn = await drainFollowUps(scenario, state, q, turn);
    } else if (turn.data.nextAction === "clarification") {
      turn = await answerClarification(scenario, state, q, turn);
      if (turn.data.success && turn.data.nextAction === "follow_up") {
        turn = await drainFollowUps(scenario, state, q, turn);
      }
    }

    if (turn.data?.success && turn.data.nextAction === "finish") {
      console.log("\n  Interview queue finished early.");
      break;
    }
  }

  return {
    scenario,
    questions,
    turns: state.turns,
    completedFollowUpKeys: [...state.completedFollowUpKeys],
  };
}

async function main() {
  console.log("Flag-on interview pattern log (next-turn)");
  console.log(`Server: ${BASE}`);

  const probe = await nextTurn({
    loanType: "New Construction",
    agencies: ["hpd"],
    fundingPrograms: ["LIHTC"],
    currentIndex: 0,
    triggerQuestion: {
      id: "x",
      field: "projectName",
      category: "Basics",
      question: "Name?",
      inputType: "text",
      required: true,
    },
    answerValue: "test",
    skipped: false,
    turnType: "main_answer",
    questions: [
      {
        id: "x",
        field: "projectName",
        category: "Basics",
        question: "Name?",
        inputType: "text",
        required: true,
      },
    ],
    answers: [{ questionId: "x", value: "test", skipped: false }],
    completedFollowUpKeys: [],
    remainingQuestionIds: [],
  });

  if (probe.status === 403) {
    console.error("\n❌ next-turn returned 403. Set WIZARD_NEXT_TURN=true and restart dev server.");
    process.exit(1);
  }

  const results = [];
  for (const scenario of SCENARIOS) {
    results.push(await runScenario(scenario));
  }

  console.log(`\n${"=".repeat(72)}`);
  console.log("PATTERN SUMMARY");
  console.log("=".repeat(72));

  const llmClarifications = results.flatMap((r) =>
    r.turns
      .filter((t) => t.llmClarification)
      .map((t) => ({
        scenario: r.scenario.id,
        field: t.field,
        q: t.llmClarification.question,
      }))
  );

  const ruleFollowUps = results.flatMap((r) =>
    r.turns
      .filter((t) => t.ruleFollowUp)
      .map((t) => ({
        scenario: r.scenario.id,
        field: t.field,
        key: t.ruleFollowUp.key,
        q: t.ruleFollowUp.question,
      }))
  );

  console.log(`\nLLM clarifications fired: ${llmClarifications.length}`);
  for (const c of llmClarifications) {
    console.log(`  [${c.scenario}/${c.field}] ${c.q}`);
  }
  if (llmClarifications.length === 0) {
    console.log("  (none — clear answers or dedup suppressed overlapping clarifications)");
  }

  console.log(`\nRule follow-ups fired: ${ruleFollowUps.length}`);
  const byKey = new Map();
  for (const f of ruleFollowUps) {
    if (!byKey.has(f.key)) byKey.set(f.key, []);
    byKey.get(f.key).push(f.scenario);
  }
  for (const [key, scenarios] of byKey) {
    const sample = ruleFollowUps.find((f) => f.key === key);
    console.log(`  ${key} (${scenarios.join(", ")}): ${sample.q}`);
  }

  const mainTurns = results.flatMap((r) => r.turns.filter((t) => t.field && t.ackMs));
  const avgMs =
    mainTurns.reduce((a, t) => a + t.ackMs, 0) / Math.max(mainTurns.length, 1);
  console.log(`\nAvg main-turn ack latency: ${Math.round(avgMs)}ms`);

  const outPath = new URL("../output/interview-pattern-log.json", import.meta.url);
  const fs = await import("fs");
  const path = await import("path");
  const dir = path.dirname(fileURLToPath(outPath));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "interview-pattern-log.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), api: "next-turn", results }, null, 2)
  );
  console.log(`\nFull log written to output/interview-pattern-log.json`);
}

import { fileURLToPath } from "url";
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
