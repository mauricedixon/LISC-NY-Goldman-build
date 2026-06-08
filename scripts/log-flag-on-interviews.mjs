#!/usr/bin/env node
/**
 * Walk two full flag-on interview scenarios through conversation-turn,
 * logging Haiku acks, LLM clarifications, and expected rule follow-ups.
 *
 * Usage: node scripts/log-flag-on-interviews.mjs
 * Requires dev server + WIZARD_LLM_CONVERSATION=true
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
  },
];

function parseNumber(value) {
  const n = parseFloat(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseMoney(value) {
  return parseNumber(value);
}

/** Mirror of rule follow-ups in wizard-conversation.ts (subset for logging). */
function getRuleFollowUp(field, answerValue, answers, questions, completed, ctx) {
  const programs = ctx.fundingPrograms ?? [];
  const loanType = ctx.loanType ?? "";
  const value = answerValue.trim();

  const mk = (key, category, question) => ({
    source: "rule",
    key,
    category,
    question,
  });

  if (field === "borough" && programs.includes("HPD") && !completed.has("followup_hpd_setasides")) {
    return mk("followup_hpd_setasides", "Compliance", "Any HPD set-asides or program requirements to flag?");
  }
  if (field === "borough" && programs.includes("HCR") && !completed.has("followup_hcr_rent_restrictions")) {
    return mk("followup_hcr_rent_restrictions", "Compliance", "Any HCR rent restrictions or MBR requirements to note?");
  }
  if (field === "totalUnits" && programs.includes("LIHTC") && !completed.has("followup_lihtc_setasides")) {
    return mk("followup_lihtc_setasides", "Unit Mix", "What's the LIHTC set-aside breakdown (e.g. 20/50, 40/60, or 80% AMI bands)?");
  }
  if (field === "totalUnits" && loanType === "New Construction" && !completed.has("followup_construction_phasing")) {
    return mk("followup_construction_phasing", "Project Basics", "Any construction phasing, multiple buildings, or staged certificate of occupancy?");
  }
  if (field === "loanType" && loanType === "Preservation / Rehab" && !completed.has("followup_rehab_scope")) {
    return mk("followup_rehab_scope", "Project Basics", "What's the scope of rehab — moderate, substantial, or gut renovation?");
  }

  if (field === "requestedLoanAmount" || field === "totalDevelopmentCost") {
    const tdcField = questions.find((q) => q.field === "totalDevelopmentCost");
    const loanField = questions.find((q) => q.field === "requestedLoanAmount");
    const tdcAns = answers.find((a) => a.questionId === tdcField?.id);
    const loanAns = answers.find((a) => a.questionId === loanField?.id);
    const tdc = parseMoney(tdcAns?.value);
    const loan = parseMoney(loanAns?.value);
    if (tdc > 0 && loan > 0 && loan <= tdc) {
      const implied = Math.round((loan / tdc) * 1000) / 10;
      if (implied >= 80 && !completed.has("followup_leverage_implied")) {
        return mk("followup_leverage_implied", "Financials", `Loan ÷ TDC implies ~${implied}% leverage — anything we should note?`);
      }
    }
  }

  return null;
}

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

async function conversationTurn(payload) {
  const start = Date.now();
  const res = await fetch(`${BASE}/api/wizard/conversation-turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { status: res.status, data, ms: Date.now() - start };
}

async function runScenario(scenario) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(scenario.name);
  console.log("=".repeat(72));

  const { questions, usedFallback } = await fetchQuestions(scenario);
  console.log(`Questions: ${questions.length} (${usedFallback ? "fallback" : "enriched"})`);

  const answers = [];
  const completedFollowUpKeys = new Set();
  const messages = [];
  const turns = [];
  const ctx = {
    loanType: scenario.loanType,
    fundingPrograms: scenario.fundingPrograms,
  };

  const mainQuestions = questions.filter((q) =>
    Object.prototype.hasOwnProperty.call(scenario.answers, q.field)
  );

  for (const q of questions) {
    const answerValue = scenario.answers[q.field];
    if (answerValue === undefined) continue;

    messages.push({ role: "assistant", content: q.question });
    messages.push({ role: "user", content: answerValue });

    const updatedAnswers = [
      ...answers.filter((a) => a.questionId !== q.id),
      { questionId: q.id, value: answerValue, skipped: false },
    ];

    const turn = await conversationTurn({
      loanType: scenario.loanType,
      agencies: scenario.agencies,
      fundingPrograms: scenario.fundingPrograms,
      triggerQuestion: q,
      answerValue,
      skipped: false,
      questions,
      answers: updatedAnswers,
      recentMessages: messages.slice(-8),
    });

    if (turn.status === 403) {
      console.error("❌ Flag off — enable WIZARD_LLM_CONVERSATION=true");
      process.exit(1);
    }

    const ruleFollowUp = getRuleFollowUp(
      q.field,
      answerValue,
      updatedAnswers,
      questions,
      completedFollowUpKeys,
      ctx
    );

    const record = {
      field: q.field,
      question: q.question,
      answer: answerValue,
      ackMs: turn.ms,
      acknowledgment: turn.data.success ? turn.data.acknowledgment : turn.data.error,
      llmClarification: turn.data.success && turn.data.needsClarification
        ? turn.data.clarification
        : null,
      ruleFollowUp,
    };
    turns.push(record);

    console.log(`\n[${q.field}] ${q.question}`);
    console.log(`  Answer: ${answerValue}`);
    console.log(`  Haiku ack (${turn.ms}ms): ${record.acknowledgment?.slice(0, 120)}${(record.acknowledgment?.length ?? 0) > 120 ? "…" : ""}`);
    if (record.llmClarification) {
      console.log(`  ⚠️  LLM clarification: ${record.llmClarification.question}`);
    } else {
      console.log(`  LLM clarification: none`);
    }
    if (ruleFollowUp) {
      console.log(`  Rule follow-up: ${ruleFollowUp.question}`);
      completedFollowUpKeys.add(ruleFollowUp.key);
      const fuAnswer = scenario.followUpAnswers[ruleFollowUp.key] ?? "(answered in interview)";
      messages.push({ role: "assistant", content: ruleFollowUp.question });
      messages.push({ role: "user", content: fuAnswer });
    }

    answers.length = 0;
    answers.push(...updatedAnswers);
  }

  return { scenario, questions, turns, completedFollowUpKeys: [...completedFollowUpKeys] };
}

async function main() {
  console.log("Flag-on interview pattern log");
  console.log(`Server: ${BASE}`);

  const probe = await conversationTurn({
    loanType: "New Construction",
    agencies: ["hpd"],
    fundingPrograms: ["LIHTC"],
    triggerQuestion: { id: "x", field: "projectName", category: "Basics", question: "Name?" },
    answerValue: "test",
    skipped: false,
    questions: [{ id: "x", field: "projectName", category: "Basics", question: "Name?" }],
    answers: [{ questionId: "x", value: "test", skipped: false }],
  });
  if (probe.status === 403) {
    console.error("\n❌ conversation-turn returned 403. Set both env flags true and restart dev server.");
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
    r.turns.filter((t) => t.llmClarification).map((t) => ({
      scenario: r.scenario.id,
      field: t.field,
      q: t.llmClarification.question,
    }))
  );

  const ruleFollowUps = results.flatMap((r) =>
    r.turns.filter((t) => t.ruleFollowUp).map((t) => ({
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
    console.log("  (none — clear answers did not trigger Haiku clarifications)");
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

  const avgMs =
    results.flatMap((r) => r.turns.map((t) => t.ackMs)).reduce((a, b) => a + b, 0) /
    results.flatMap((r) => r.turns).length;
  console.log(`\nAvg ack latency: ${Math.round(avgMs)}ms`);

  const outPath = new URL("../output/interview-pattern-log.json", import.meta.url);
  const fs = await import("fs");
  const path = await import("path");
  const dir = path.dirname(fileURLToPath(outPath));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "interview-pattern-log.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)
  );
  console.log(`\nFull log written to output/interview-pattern-log.json`);
}

import { fileURLToPath } from "url";
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
