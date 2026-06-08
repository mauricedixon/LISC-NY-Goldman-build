import {
  getFollowUpKeysSatisfiedByAnswers,
  isFieldSatisfiedByPriorAnswers,
} from "../src/lib/wizard-answer-informed-skip";
import {
  shouldPreferRuleFollowUpOverClarification,
  shouldSuppressLlmClarification,
} from "../src/lib/wizard-next-turn-dedup";

let failed = 0;

function assert(label: string, cond: boolean) {
  if (!cond) {
    console.log(`❌ ${label}`);
    failed++;
  } else {
    console.log(`✅ ${label}`);
  }
}

const questions = [
  {
    id: "notes",
    field: "additionalNotes",
    category: "Unit Mix",
    question: "What's the proposed bedroom mix?",
  },
  {
    id: "units",
    field: "totalUnits",
    category: "Unit Mix",
    question: "Total units?",
  },
  {
    id: "loan",
    field: "requestedLoanAmount",
    category: "Financials",
    question: "HPD subsidy amount?",
  },
  {
    id: "lihtc_loan",
    field: "loanType",
    category: "Basics",
    question: "Is this 4% or 9% LIHTC?",
  },
];

const answersWithSetAside = [
  {
    questionId: "notes",
    value: "LIHTC 40/60 set-aside; 15% formerly homeless per HPD NCF",
    skipped: false,
  },
];

assert(
  "skips bedroom-mix notes when set-aside already in notes",
  isFieldSatisfiedByPriorAnswers(
    questions[0] as import("@/types/wizard").WizardQuestion,
    answersWithSetAside,
    questions as import("@/types/wizard").WizardQuestion[],
    ["LIHTC", "HPD"]
  ).skip
);

const satisfiedKeys = getFollowUpKeysSatisfiedByAnswers(
  answersWithSetAside,
  questions as import("@/types/wizard").WizardQuestion[],
  ["LIHTC", "HPD"],
  "New Construction"
);
assert(
  "marks HPD + LIHTC follow-ups satisfied from notes",
  satisfiedKeys.includes("followup_hpd_setasides") &&
    satisfiedKeys.includes("followup_lihtc_setasides")
);

const boroughQ = {
  id: "borough",
  field: "borough",
  category: "Basics",
  question: "Which borough?",
};
const ruleFollowUp = {
  followUpKey: "followup_hpd_setasides",
  question: "Any HPD set-asides or program requirements to flag?",
} as import("@/lib/wizard-conversation").FollowUpQuestion;
const unitClarify = {
  clarificationKey: "unit_count_early",
  question: "What is the total number of units planned for Riverside Commons?",
  storeInField: "additionalNotes" as const,
};

const dedupCtx = {
  remainingQuestionIds: ["total_units"],
  questions: [
    {
      id: "total_units",
      field: "totalUnits",
      category: "Unit Mix",
      question: "Units?",
      inputType: "number" as const,
      required: true,
    },
  ],
};

assert(
  "suppresses early unit-count clarification when totalUnits still queued",
  shouldSuppressLlmClarification(
    boroughQ as import("@/types/wizard").WizardQuestion,
    "The Bronx",
    ruleFollowUp,
    unitClarify,
    dedupCtx
  )
);

assert(
  "prefers HPD rule follow-up over early unit-count clarification",
  shouldPreferRuleFollowUpOverClarification(
    boroughQ as import("@/types/wizard").WizardQuestion,
    "The Bronx",
    ruleFollowUp,
    unitClarify,
    dedupCtx
  )
);

const answersWithLihtc = [
  { questionId: "x", value: "9% LIHTC award expected", skipped: false },
];
assert(
  "skips 4%/9% loanType question when LIHTC credit in corpus",
  isFieldSatisfiedByPriorAnswers(
    questions[3] as import("@/types/wizard").WizardQuestion,
    answersWithLihtc,
    questions as import("@/types/wizard").WizardQuestion[],
    ["LIHTC"]
  ).skip
);

if (failed > 0) {
  console.log(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll quick-win logic tests passed.");
