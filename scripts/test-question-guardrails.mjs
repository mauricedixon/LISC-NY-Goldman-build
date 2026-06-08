#!/usr/bin/env node
/**
 * Smoke test for question enrichment guardrails (field ↔ question semantics).
 * Run: node scripts/test-question-guardrails.mjs
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Guardrails are TS — exercise via generate-questions API when server is up,
// or inline the same regex checks here for offline validation.

const MISUSE = {
  loanType: [/4\s*%|9\s*%|lihtc/i],
  totalUnits: [/set-aside/i, /40\s*\/\s*60/i],
};

function wouldGuardrail(field, question) {
  const patterns = MISUSE[field];
  if (!patterns) return false;
  return patterns.some((p) => p.test(question));
}

const bad = [
  { field: "loanType", question: "4% or 9% LIHTC?" },
  { field: "totalUnits", question: "What's the LIHTC set-aside breakdown?" },
];

const good = [
  { field: "loanType", question: "Confirm loan type." },
  { field: "totalUnits", question: "Total units?" },
];

let failed = false;
for (const q of bad) {
  if (!wouldGuardrail(q.field, q.question)) {
    console.log(`❌ Expected guardrail for ${q.field}: "${q.question}"`);
    failed = true;
  }
}
for (const q of good) {
  if (wouldGuardrail(q.field, q.question)) {
    console.log(`❌ False positive for ${q.field}: "${q.question}"`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("✅ Question guardrail pattern checks passed.");
