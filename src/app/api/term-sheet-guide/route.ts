import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { formatFundingPrograms } from "@/types/deal";
import { retrieveRulebookContext } from "@/utils/rag";
import { parseClaudeJson } from "@/utils/parse-claude-json";
import { normalizeGuideSections } from "@/lib/term-sheet-guide-utils";
import type { TermSheetGuideResult } from "@/types/term-sheet-guide";
import {
  getTermSheetGuidePromptParts,
  type TermSheetGuidePhase,
} from "@/lib/term-sheet-guide-schema";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const PHASE_MAX_TOKENS: Record<TermSheetGuidePhase, number> = {
  essential: 2500,
  extended: 3500,
};

function buildGuideQuery(
  loanType: string,
  fundingPrograms: string[],
  agencies: string[],
  phase: TermSheetGuidePhase
): string {
  const base = [
    `Term sheet and underwriting requirements for a ${loanType} affordable housing deal.`,
    `Funding programs in capital stack: ${formatFundingPrograms(fundingPrograms)}.`,
    `Target agencies / rulebooks: ${agencies.join(", ")}.`,
  ];

  if (phase === "extended") {
    base.push(
      "Environmental review, design and construction, sustainability, regulatory agreement,",
      "pre-closing approvals, monitoring, reserve detail, subordination, informational procedures."
    );
  } else {
    base.push(
      "LTV limits, DSCR minimums, equity requirements, loan terms, closing conditions,",
      "reserve requirements, program-specific eligibility, rate and amortization."
    );
  }

  return base.join(" ");
}

function buildPrompt(
  loanType: string,
  fundingPrograms: string[],
  agencies: string[],
  contextText: string,
  phase: TermSheetGuidePhase,
  essentialContext?: Pick<TermSheetGuideResult, "summary" | "keyThresholds">
): string {
  const { jsonSchema, fieldGuidance } = getTermSheetGuidePromptParts(phase);

  const essentialBlock =
    phase === "extended" && essentialContext
      ? `
Already covered in the essential tier (do NOT repeat):
Summary: ${essentialContext.summary}
Key thresholds: ${
          essentialContext.keyThresholds.length > 0
            ? essentialContext.keyThresholds
                .map((row) => `${row.label}: ${row.value}`)
                .join("; ")
            : "none"
        }
`
      : "";

  return `
You are an expert affordable housing underwriter assistant for LISC NY.
${
  phase === "essential"
    ? `Generate the essential-tier Term Sheet Guide for an underwriter preparing a ${loanType} deal.`
    : `Generate the extended-tier checklist items for the full term sheet guide on a ${loanType} deal.`
}

Funding programs in the capital stack: ${formatFundingPrograms(fundingPrograms)}
Target agency rulebooks: ${agencies.join(", ")}
${essentialBlock}
Use ONLY the rulebook excerpts below as the source of truth. Cite specific sources and page numbers.

<rulebooks>
${contextText}
</rulebooks>

Respond strictly in the following JSON format:
${jsonSchema}

${fieldGuidance}
`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      loanType: string;
      agencies: string[];
      fundingPrograms: string[];
      phase?: TermSheetGuidePhase;
      essentialContext?: Pick<TermSheetGuideResult, "summary" | "keyThresholds">;
    };

    const { loanType, agencies, fundingPrograms, essentialContext } = body;
    const phase: TermSheetGuidePhase =
      body.phase === "extended" ? "extended" : "essential";

    if (!loanType) {
      return NextResponse.json({ error: "loanType is required" }, { status: 400 });
    }

    if (!agencies?.length) {
      return NextResponse.json(
        { error: "At least one target agency must be selected" },
        { status: 400 }
      );
    }

    if (!fundingPrograms?.length) {
      return NextResponse.json(
        { error: "At least one funding program must be selected" },
        { status: 400 }
      );
    }

    if (phase === "extended" && !essentialContext?.summary) {
      return NextResponse.json(
        { error: "essentialContext.summary is required for extended phase" },
        { status: 400 }
      );
    }

    const startedAt = Date.now();
    const queryText = buildGuideQuery(loanType, fundingPrograms, agencies, phase);
    const ragStartedAt = Date.now();
    const { contextText } = await retrieveRulebookContext(queryText, agencies, 10);
    const ragMs = Date.now() - ragStartedAt;

    const prompt = buildPrompt(
      loanType,
      fundingPrograms,
      agencies,
      contextText,
      phase,
      essentialContext
    );

    const claudeStartedAt = Date.now();
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: PHASE_MAX_TOKENS[phase],
      temperature: 0,
      system:
        "You are a precise underwriting assistant. You only output valid JSON grounded in provided rulebooks.",
      messages: [{ role: "user", content: prompt }],
    });

    const claudeMs = Date.now() - claudeStartedAt;
    const responseText = msg.content[0].type === "text" ? msg.content[0].text : "{}";

    const timingMs = {
      rag: ragMs,
      claude: claudeMs,
      total: Date.now() - startedAt,
    };
    console.log(
      `[term-sheet-guide] phase=${phase} rag=${timingMs.rag}ms claude=${timingMs.claude}ms total=${timingMs.total}ms`
    );

    let guide: TermSheetGuideResult;
    try {
      const parsed = parseClaudeJson<Partial<TermSheetGuideResult>>(responseText);
      guide = {
        summary: phase === "essential" ? (parsed.summary ?? "") : "",
        keyThresholds:
          phase === "essential" ? (parsed.keyThresholds ?? []) : [],
        sections: normalizeGuideSections(parsed.sections ?? []),
      };
    } catch {
      console.error("JSON parse error — raw response:", responseText.slice(0, 500));
      return NextResponse.json(
        { error: "The AI returned a malformed response. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      guide,
      phase,
      timingMs,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Term sheet guide API error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
