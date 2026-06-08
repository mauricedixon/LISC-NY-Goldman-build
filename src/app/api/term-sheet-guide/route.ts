import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { formatFundingPrograms } from "@/types/deal";
import { retrieveRulebookContext } from "@/utils/rag";
import { parseClaudeJson } from "@/utils/parse-claude-json";
import { normalizeGuideSections } from "@/lib/term-sheet-guide-utils";
import type { TermSheetGuideResult } from "@/types/term-sheet-guide";
import {
  TERM_SHEET_GUIDE_FIELD_GUIDANCE,
  TERM_SHEET_GUIDE_JSON_SCHEMA,
} from "@/lib/term-sheet-guide-schema";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function buildGuideQuery(
  loanType: string,
  fundingPrograms: string[],
  agencies: string[]
): string {
  return [
    `Term sheet and underwriting requirements for a ${loanType} affordable housing deal.`,
    `Funding programs in capital stack: ${formatFundingPrograms(fundingPrograms)}.`,
    `Target agencies / rulebooks: ${agencies.join(", ")}.`,
    "LTV limits, DSCR minimums, equity requirements, loan terms, closing conditions,",
    "reserve requirements, program-specific eligibility, environmental review, design and sustainability,",
    "regulatory agreement, pre-closing approvals, subordination, rate and amortization.",
  ].join(" ");
}

export async function POST(request: NextRequest) {
  try {
    const { loanType, agencies, fundingPrograms } = (await request.json()) as {
      loanType: string;
      agencies: string[];
      fundingPrograms: string[];
    };

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

    const startedAt = Date.now();
    const queryText = buildGuideQuery(loanType, fundingPrograms, agencies);
    const ragStartedAt = Date.now();
    const { contextText } = await retrieveRulebookContext(queryText, agencies, 10);
    const ragMs = Date.now() - ragStartedAt;

    const prompt = `
You are an expert affordable housing underwriter assistant for LISC NY.
Generate a structured Term Sheet Guide checklist for an underwriter preparing a ${loanType} deal.

Funding programs in the capital stack: ${formatFundingPrograms(fundingPrograms)}
Target agency rulebooks: ${agencies.join(", ")}

Use ONLY the rulebook excerpts below as the source of truth. Cite specific sources and page numbers.

<rulebooks>
${contextText}
</rulebooks>

Respond strictly in the following JSON format:
${TERM_SHEET_GUIDE_JSON_SCHEMA}

${TERM_SHEET_GUIDE_FIELD_GUIDANCE}
`;

    const claudeStartedAt = Date.now();
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 5000,
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
      `[term-sheet-guide] rag=${timingMs.rag}ms claude=${timingMs.claude}ms total=${timingMs.total}ms`
    );

    let guide: TermSheetGuideResult;
    try {
      const parsed = parseClaudeJson<TermSheetGuideResult>(responseText);
      guide = {
        summary: parsed.summary ?? "",
        keyThresholds: parsed.keyThresholds ?? [],
        sections: normalizeGuideSections(parsed.sections ?? []),
      };
    } catch {
      console.error("JSON parse error — raw response:", responseText.slice(0, 500));
      return NextResponse.json(
        { error: "The AI returned a malformed response. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, guide, timingMs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Term sheet guide API error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
