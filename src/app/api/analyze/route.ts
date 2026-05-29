import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildDealSummary, type DealFormData } from '@/types/deal';
import { retrieveRulebookContext } from '@/utils/rag';
import { parseClaudeJson } from '@/utils/parse-claude-json';
import type { AnalysisResult } from '@/types/wizard';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { formData, agencies } = await request.json() as { formData: DealFormData; agencies: string[] };

    if (!formData) {
      return NextResponse.json({ error: 'No deal data provided' }, { status: 400 });
    }

    const dealSummary = buildDealSummary(formData);
    const { contextText } = await retrieveRulebookContext(dealSummary, agencies, 10);

    // 3. Ask Claude to run a completeness check and flag compliance issues
    const prompt = `
You are an expert affordable housing underwriter assistant for LISC NY.
Your job is to review structured deal data entered by an underwriter and:
1. Assess the completeness of the submission — identify which standard underwriting fields are present, missing, or need clarification.
2. Flag any compliance violations where the deal data contradicts public government regulations. Cite the specific source and page number.

Here are the relevant excerpts from public government rulebooks (Source of Truth):
<rulebooks>
${contextText}
</rulebooks>

Here is the structured deal data entered by the underwriter:
<deal_data>
${dealSummary}
</deal_data>

Respond strictly in the following JSON format:
{
  "completenessChecklist": [
    {
      "field": "Human-readable field name",
      "status": "provided" | "missing" | "needs_clarification",
      "note": "Optional short note, especially for needs_clarification items"
    }
  ],
  "complianceFlags": [
    {
      "issue": "Description of the violation or concern",
      "citation": "Exact citation from the rulebook including source and page number",
      "severity": "High" | "Medium" | "Low"
    }
  ]
}

For the completenessChecklist, evaluate these standard fields: Project Name, Developer/Sponsor, Loan Type, Borough/Location, Total Units, Affordable Units, AMI Targets, Total Development Cost, Requested Loan Amount, LTV, DSCR, Other Funding Sources.
A field is "provided" if a real value was given, "missing" if it was left blank or says [Not provided], and "needs_clarification" if the value seems incomplete, inconsistent, or unusual.
`;

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      temperature: 0,
      system: 'You are a precise, analytical underwriting assistant. You only output valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = msg.content[0].type === 'text' ? msg.content[0].text : '{}';

    let analysis: AnalysisResult;
    try {
      analysis = parseClaudeJson<AnalysisResult>(responseText);
    } catch {
      console.error('JSON parse error — raw response:', responseText.slice(0, 500));
      return NextResponse.json(
        { error: 'The AI returned a malformed response. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, analysis });

  } catch (error: any) {
    console.error('Analysis API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error during analysis' },
      { status: 500 }
    );
  }
}
