import type { WizardAnswer, WizardQuestion } from "@/types/wizard";

export function buildFallbackQuestions(loanType: string): WizardQuestion[] {
  return [
    {
      id: "project_name",
      category: "Project Basics",
      field: "projectName",
      question: "What is the project name?",
      required: true,
      inputType: "text",
    },
    {
      id: "developer_name",
      category: "Project Basics",
      field: "developerName",
      question: "Who is the developer or sponsor?",
      required: true,
      inputType: "text",
    },
    {
      id: "loan_type",
      category: "Project Basics",
      field: "loanType",
      question: "Confirm the loan type for this deal.",
      helpText: `Sidebar selection: ${loanType}`,
      required: true,
      inputType: "text",
    },
    {
      id: "borough",
      category: "Project Basics",
      field: "borough",
      question: "Which NYC borough is the project located in?",
      required: true,
      inputType: "select",
      options: ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"],
    },
    {
      id: "total_units",
      category: "Unit Mix",
      field: "totalUnits",
      question: "How many total units does the project include?",
      required: true,
      inputType: "number",
    },
    {
      id: "affordable_units",
      category: "Unit Mix",
      field: "affordableUnits",
      question: "How many units will be affordable?",
      required: true,
      inputType: "number",
    },
    {
      id: "target_ami",
      category: "Unit Mix",
      field: "targetAMI",
      question: "What AMI targets apply (e.g. 30%, 60%, 80%)?",
      required: true,
      inputType: "text",
    },
    {
      id: "total_development_cost",
      category: "Financials",
      field: "totalDevelopmentCost",
      question: "What is the total development cost?",
      required: true,
      inputType: "text",
    },
    {
      id: "requested_loan_amount",
      category: "Financials",
      field: "requestedLoanAmount",
      question: "What loan amount is being requested from LISC?",
      required: true,
      inputType: "text",
    },
    {
      id: "ltv",
      category: "Financials",
      field: "ltv",
      question: "What is the projected loan-to-value (LTV) percentage?",
      required: true,
      inputType: "number",
    },
    {
      id: "dscr",
      category: "Financials",
      field: "dscr",
      question: "What is the projected debt service coverage ratio (DSCR)?",
      required: true,
      inputType: "number",
    },
    {
      id: "other_funding_sources",
      category: "Financials",
      field: "otherFundingSources",
      question: "What other funding sources are in the capital stack?",
      required: false,
      inputType: "textarea",
    },
    {
      id: "additional_notes",
      category: "Additional",
      field: "additionalNotes",
      question: "Any other deal characteristics or compliance considerations?",
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
