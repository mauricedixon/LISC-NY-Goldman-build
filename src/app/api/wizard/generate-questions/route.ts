import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildFallbackQuestions } from "@/lib/wizard-fallback";
import { formatFundingPrograms } from "@/types/deal";
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
  "totalDevelopmentCost",
  "requestedLoanAmount",
  "additionalNotes",
] as const;

function buildQuestionQuery(
  loanType: string,
  agencies: string[],
  fundingPrograms: string[]
): string {
  return [
    `Affordable housing underwriting interview for ${loanType} loan.`,
    `Funding programs in capital stack: ${formatFundingPrograms(fundingPrograms)}.`,
    `Target agencies: ${agencies.join(", ")}.`,
    "Required submission fields, eligibility requirements, unit count,",
    "development cost, loan amount, compliance documentation.",
  ].join(" ");
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

export async function POST(request: NextRequest) {
  try {
    const { loanType, agencies, fundingPrograms } = await request.json() as {
      loanType: string;
      agencies: string[];
      fundingPrograms?: string[];
    };
    const programs = fundingPrograms ?? [];

    if (!loanType) {
      return NextResponse.json({ error: "loanType is required" }, { status: 400 });
    }

    if (!agencies || agencies.length === 0) {
      return NextResponse.json(
        { error: "At least one agency must be selected" },
        { status: 400 }
      );
    }

    const queryText = buildQuestionQuery(loanType, agencies, programs);
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
Generate a guided interview question list for an underwriter reviewing a ${loanType} deal.

Funding programs in the capital stack: ${formatFundingPrograms(programs)}
Target agency rulebooks: ${agencies.join(", ")}

Use the rulebook excerpts below as the source of truth. Prioritize questions that uncover
information required by these funding programs and agencies for this loan type.

<rulebooks>
${contextText}
</rulebooks>

Generate 10–14 interview questions, one per standard underwriting field where applicable.
Each question must be SHORT (under 12 words), conversational, and direct — like a quick chat, not a form label.

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
- Keep each question under 12 words (one short sentence max).
- Avoid filler phrases like "Please provide" or "Can you tell me about".
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
