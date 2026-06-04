import type { WizardAnswer, WizardQuestion } from "@/types/wizard";

export function buildFallbackQuestions(loanType: string): WizardQuestion[] {
  return [
    {
      id: "project_name",
      category: "Project Basics",
      field: "projectName",
      question: "Project name?",
      required: true,
      inputType: "text",
    },
    {
      id: "developer_name",
      category: "Project Basics",
      field: "developerName",
      question: "Developer or sponsor?",
      required: true,
      inputType: "text",
    },
    {
      id: "loan_type",
      category: "Project Basics",
      field: "loanType",
      question: "Confirm loan type.",
      helpText: `Sidebar: ${loanType}`,
      required: true,
      inputType: "text",
    },
    {
      id: "borough",
      category: "Project Basics",
      field: "borough",
      question: "Which borough?",
      required: true,
      inputType: "select",
      options: ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"],
    },
    {
      id: "total_units",
      category: "Unit Mix",
      field: "totalUnits",
      question: "Total units?",
      required: true,
      inputType: "number",
    },
    {
      id: "affordable_units",
      category: "Unit Mix",
      field: "affordableUnits",
      question: "How many affordable units?",
      required: true,
      inputType: "number",
    },
    {
      id: "target_ami",
      category: "Unit Mix",
      field: "targetAMI",
      question: "AMI targets? (e.g. 30%, 60%)",
      required: true,
      inputType: "text",
    },
    {
      id: "total_development_cost",
      category: "Financials",
      field: "totalDevelopmentCost",
      question: "Total development cost (TDC)?",
      required: true,
      inputType: "text",
    },
    {
      id: "requested_loan_amount",
      category: "Financials",
      field: "requestedLoanAmount",
      question: "Requested LISC loan amount?",
      required: true,
      inputType: "text",
    },
    {
      id: "ltv",
      category: "Financials",
      field: "ltv",
      question: "Projected LTV (%)?",
      required: true,
      inputType: "number",
    },
    {
      id: "dscr",
      category: "Financials",
      field: "dscr",
      question: "Projected DSCR?",
      required: true,
      inputType: "number",
    },
    {
      id: "other_funding_sources",
      category: "Financials",
      field: "otherFundingSources",
      question: "Other funding in the stack?",
      required: false,
      inputType: "textarea",
    },
    {
      id: "additional_notes",
      category: "Additional",
      field: "additionalNotes",
      question: "Anything else we should know?",
      required: false,
      inputType: "textarea",
    },
  ];
}

export function remapAnswersByField(
  previousQuestions: WizardQuestion[],
  nextQuestions: WizardQuestion[],
  answers: WizardAnswer[]
): WizardAnswer[] {
  const valueByField = new Map<string, WizardAnswer>();

  for (const answer of answers) {
    const question = previousQuestions.find((q) => q.id === answer.questionId);
    if (question) {
      valueByField.set(question.field, answer);
    }
  }

  const remapped: WizardAnswer[] = [];
  for (const question of nextQuestions) {
    const existing = valueByField.get(question.field);
    if (existing) {
      remapped.push({
        questionId: question.id,
        value: existing.value,
        skipped: existing.skipped,
      });
    }
  }
  return remapped;
}

export function getQuestionIndexByField(questions: WizardQuestion[], field: string): number {
  return questions.findIndex((q) => q.field === field);
}
