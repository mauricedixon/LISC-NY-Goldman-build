import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { retrieveRulebookContext } from "@/utils/rag";
import { parseClaudeJson } from "@/utils/parse-claude-json";
import type { WizardQuestion } from "@/types/wizard";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const STANDARD_FIELDS = [
  "projectName",
  "developerName",
  "loanType",
  "borough",
  "totalUnits",
  "affordableUnits",
  "targetAMI",
  "totalDevelopmentCost",
  "requestedLoanAmount",
  "ltv",
  "dscr",
  "otherFundingSources",
  "additionalNotes",
] as const;

function buildQuestionQuery(loanType: string, agencies: string[]): string {
  return [
    `Affordable housing underwriting interview for ${loanType} loan.`,
    `Target agencies: ${agencies.join(", ")}.`,
    "Required submission fields, eligibility requirements, AMI limits, LTV caps,",
    "DSCR minimums, unit mix requirements, funding stack, compliance documentation.",
  ].join(" ");
}

export async function POST(request: NextRequest) {
  try {
    const { loanType, agencies } = await request.json() as {
      loanType: string;
      agencies: string[];
    };

    if (!loanType) {
      return NextResponse.json({ error: "loanType is required" }, { status: 400 });
    }

    if (!agencies || agencies.length === 0) {
      return NextResponse.json(
        { error: "At least one agency must be selected" },
        { status: 400 }
      );
    }

    const queryText = buildQuestionQuery(loanType, agencies);
    const { chunks, contextText } = await retrieveRulebookContext(queryText, agencies, 12);

    if (chunks.length === 0) {
      return NextResponse.json({
        success: true,
        questions: buildFallbackQuestions(loanType),
        usedFallback: true,
      });
    }

    const prompt = `
You are an expert affordable housing underwriter assistant for LISC NY.
Generate a guided interview question list for an underwriter reviewing a ${loanType} deal
targeting these agencies: ${agencies.join(", ")}.

Use the rulebook excerpts below as the source of truth. Prioritize questions that uncover
information required by these agencies and common compliance gaps for this loan type.

<rulebooks>
${contextText}
</rulebooks>

Generate 10–14 interview questions, one per standard underwriting field where applicable.
Each question should be conversational but precise — something an underwriter would ask a developer.

Respond strictly in this JSON format:
{
  "questions": [
    {
      "id": "unique_snake_case_id",
      "category": "Project Basics | Unit Mix | Financials | Compliance | Additional",
      "field": "one of: ${STANDARD_FIELDS.join(", ")}",
      "question": "The interview question text",
      "helpText": "Optional brief context citing why this matters per the rulebooks",
      "inputType": "text" | "number" | "select" | "textarea",
      "options": ["only for select inputs, e.g. borough names or AMI bands"],
      "required": true | false
    }
  ]
}

Rules:
- Cover all standard fields at least once across the question list.
- For borough, use inputType "select" with NYC borough options.
- Ground helpText in the rulebook excerpts when possible.
- Order questions logically: basics → unit mix → financials → compliance → additional.
- Do not duplicate fields — one primary question per field.
`;

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      temperature: 0,
      system: "You are a precise underwriting assistant. You only output valid JSON.",
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = msg.content[0].type === "text" ? msg.content[0].text : "{}";

    let parsed: { questions: WizardQuestion[] };
    try {
      parsed = parseClaudeJson<{ questions: WizardQuestion[] }>(responseText);
    } catch {
      console.error("JSON parse error — raw response:", responseText.slice(0, 500));
      return NextResponse.json({
        success: true,
        questions: buildFallbackQuestions(loanType),
        usedFallback: true,
      });
    }

    const questions = normalizeQuestions(parsed.questions, loanType);

    return NextResponse.json({ success: true, questions, usedFallback: false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Generate questions API error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizeQuestions(questions: WizardQuestion[], loanType: string): WizardQuestion[] {
  const seenFields = new Set<string>();
  const normalized: WizardQuestion[] = [];

  for (const q of questions ?? []) {
    if (!q.id || !q.question || !q.field) continue;
    if (seenFields.has(q.field)) continue;
    seenFields.add(q.field);

    normalized.push({
      id: q.id,
      category: q.category || "General",
      field: q.field,
      question: q.question,
      helpText: q.helpText,
      inputType: q.inputType || "text",
      options: q.options,
      required: q.required ?? true,
    });
  }

  if (normalized.length < 5) {
    return buildFallbackQuestions(loanType);
  }

  return normalized;
}

function buildFallbackQuestions(loanType: string): WizardQuestion[] {
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
