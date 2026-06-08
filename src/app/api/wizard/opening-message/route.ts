import { NextRequest, NextResponse } from "next/server";
import { generateWizardOpening } from "@/lib/wizard-conversation-llm";
import { isWizardLlmOpeningEnabledServer } from "@/lib/wizard-llm-opening-config";

export async function POST(request: NextRequest) {
  if (!isWizardLlmOpeningEnabledServer()) {
    return NextResponse.json(
      { success: false, error: "LLM opening is disabled." },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as {
      loanType?: string;
      agencies?: string[];
      fundingPrograms?: string[];
      termSheetGuideSummary?: string;
    };

    if (!body.loanType) {
      return NextResponse.json(
        { success: false, error: "loanType is required." },
        { status: 400 }
      );
    }

    const startedAt = Date.now();
    const result = await generateWizardOpening({
      loanType: body.loanType,
      agencies: body.agencies ?? [],
      fundingPrograms: body.fundingPrograms ?? [],
      termSheetGuideSummary: body.termSheetGuideSummary,
    });

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[opening-message] claude=${result.claudeMs}ms total=${Date.now() - startedAt}ms`
      );
    }

    return NextResponse.json({ success: true, opening: result.opening });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Opening message API error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
