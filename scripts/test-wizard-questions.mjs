#!/usr/bin/env node
/**
 * Test question-generation prompt against HCR rulebook data.
 *
 * Usage:
 *   node scripts/test-wizard-questions.mjs
 *   node scripts/test-wizard-questions.mjs --agency hpd --loan-type "Preservation / Rehab"
 *
 * Requires: dev server running on localhost:3000 (or set BASE_URL)
 * Env: ANTHROPIC_API_KEY, OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_* (via Next.js)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    agency: "hcr",
    loanType: "New Construction",
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--agency" && args[i + 1]) opts.agency = args[++i];
    if (args[i] === "--loan-type" && args[i + 1]) opts.loanType = args[++i];
  }

  return opts;
}

async function main() {
  const { agency, loanType } = parseArgs();

  console.log(`\nTesting wizard question generation`);
  console.log(`  Agency:    ${agency}`);
  console.log(`  Loan type: ${loanType}`);
  console.log(`  Endpoint:  ${BASE_URL}/api/wizard/generate-questions\n`);

  const start = Date.now();

  const response = await fetch(`${BASE_URL}/api/wizard/generate-questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loanType, agencies: [agency] }),
  });

  const data = await response.json();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (!response.ok) {
    console.error(`❌ Request failed (${response.status}):`, data.error);
    process.exit(1);
  }

  console.log(`✅ Generated ${data.questions?.length ?? 0} questions in ${elapsed}s`);
  if (data.usedFallback) {
    console.log("⚠️  Used fallback question set (no RAG chunks or parse failure)\n");
  } else {
    console.log("📚 Questions grounded in ingested rulebook data\n");
  }

  for (const [i, q] of (data.questions ?? []).entries()) {
    console.log(`${i + 1}. [${q.category}] ${q.question}`);
    console.log(`   field: ${q.field} | type: ${q.inputType} | required: ${q.required}`);
    if (q.helpText) console.log(`   help:  ${q.helpText}`);
    console.log();
  }

  const fields = new Set((data.questions ?? []).map((q) => q.field));
  const expected = [
    "projectName", "developerName", "loanType", "borough",
    "totalUnits", "affordableUnits", "targetAMI",
    "totalDevelopmentCost", "requestedLoanAmount", "ltv", "dscr",
  ];
  const missing = expected.filter((f) => !fields.has(f));

  if (missing.length === 0) {
    console.log("✅ All core underwriting fields covered");
  } else {
    console.log(`⚠️  Missing fields: ${missing.join(", ")}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
