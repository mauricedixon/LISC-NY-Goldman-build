import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { retrieveRulebookContext } from "@/utils/rag";
import { parseClaudeJson } from "@/utils/parse-claude-json";
import type { DealStringFieldKey } from "@/lib/wizard-form-sync";
import { buildDealSummary, type DealFormData } from "@/types/deal";
import type { WizardAnswer, WizardQuestion, AnalysisResult } from "@/types/wizard";
import { ANALYSIS_JSON_SCHEMA, ANALYSIS_FIELD_GUIDANCE } from "@/lib/analysis-prompt-schema";
import {
  buildInterviewTranscript,
  type FollowUpTranscriptEntry,
} from "@/lib/wizard-interview-transcript";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function answersToFormData(
  loanType: string,
  questions: WizardQuestion[],
  answers: WizardAnswer[]
): DealFormData {
  const formData: DealFormData = {
    projectName: "",
    developerName: "",
    loanType,
    borough: "",
    totalUnits: "",
    totalDevelopmentCost: "",
    requestedLoanAmount: "",
    fundingPrograms: [],
    additionalNotes: "",
  };

  const answerMap = new Map(answers.map((a) => [a.questionId, a]));

  for (const q of questions) {
    const answer = answerMap.get(q.id);
    if (!answer || answer.skipped || !answer.value.trim()) continue;

    const key = q.field as DealStringFieldKey;
    formData[key] = answer.value.trim();
  }

  return formData;
}

export async function POST(request: NextRequest) {
  try {
    const {
      loanType,
      agencies,
      questions,
      answers,
      fundingPrograms,
      followUpTranscript,
      termSheetGuideContext,
    } = await request.json() as {
      loanType: string;
      agencies: string[];
      questions: WizardQuestion[];
      answers: WizardAnswer[];
      fundingPrograms?: string[];
      followUpTranscript?: FollowUpTranscriptEntry[];
      termSheetGuideContext?: string;
    };

    if (!loanType || !agencies?.length) {
      return NextResponse.json(
        { error: "loanType and agencies are required" },
        { status: 400 }
      );
    }

    if (!questions?.length) {
      return NextResponse.json({ error: "No interview questions provided" }, { status: 400 });
    }

    const formData = answersToFormData(loanType, questions, answers ?? []);
    if (fundingPrograms?.length) {
      formData.fundingPrograms = fundingPrograms;
    }
    const dealSummary = buildDealSummary(formData);
    const interviewSummary = buildInterviewTranscript(
      loanType,
      fundingPrograms,
      questions,
      answers ?? [],
      followUpTranscript ?? []
    );

    const queryText = `${dealSummary}\n\n${interviewSummary}`;
    const { contextText } = await retrieveRulebookContext(queryText, agencies, 10);

    const prompt = `
You are an expert affordable housing underwriter assistant for LISC NY.
An underwriter completed a guided interview about a deal. Review their responses and:
1. Assess completeness — which standard underwriting fields are present, missing, or need clarification.
2. Flag compliance violations where responses contradict public government regulations. Cite source and page.

Here are relevant excerpts from public government rulebooks (Source of Truth):
<rulebooks>
${contextText}
</rulebooks>

Here is the structured deal summary derived from interview answers:
<deal_data>
${dealSummary}
</deal_data>

Here is the full guided interview transcript:
<interview>
${interviewSummary}
</interview>
${
  termSheetGuideContext
    ? `
Here is the term sheet guide checklist context for this deal (essential tier):
<term_sheet_guide>
${termSheetGuideContext}
</term_sheet_guide>
Cross-check interview answers against these program checklist items where relevant.
`
    : ""
}

Respond strictly in the following JSON format:
${ANALYSIS_JSON_SCHEMA}

${ANALYSIS_FIELD_GUIDANCE}
A field is "missing" if blank, [Not provided], or [Skipped].
`;

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 5000,
      temperature: 0,
      system: "You are a precise, analytical underwriting assistant. You only output valid JSON.",
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = msg.content[0].type === "text" ? msg.content[0].text : "{}";

    let analysis: AnalysisResult;
    try {
      analysis = parseClaudeJson<AnalysisResult>(responseText);
    } catch {
      console.error("JSON parse error — raw response:", responseText.slice(0, 500));
      return NextResponse.json(
        { error: "The AI returned a malformed response. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analysis,
      formData,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Synthesize report API error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
