import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { generateEmbedding } from '@/utils/embeddings';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { markdown, agencies } = await request.json();

    if (!markdown) {
      return NextResponse.json({ error: 'No markdown content provided' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Generate an embedding for the uploaded draft memo to find similar rules
    // (In a real production app, we would chunk the draft memo and search for each chunk.
    // For this PoC, we will just embed the first 8000 characters to get the general "gist" of the deal)
    const queryEmbedding = await generateEmbedding(markdown.substring(0, 8000));

    // 2. Search the Supabase vector database for relevant public rulebooks
    // We filter by the agencies selected in the sidebar
    const { data: relevantChunks, error: searchError } = await supabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.1, // Lower threshold for PoC to ensure we get matches
      match_count: 10, // Get top 10 most relevant chunks
      filter_agencies: agencies // Pass the selected agencies to filter
    });

    if (searchError) {
      console.error('Vector search error:', searchError);
      // Fallback: If the database is empty or RPC fails, we just won't use RAG context
    }

    // Combine the retrieved chunks into a single context string
    const contextText = relevantChunks 
      ? relevantChunks.map((chunk: any) => `[Source: ${chunk.agency} - ${chunk.title}, Page ${chunk.page_number}]\n${chunk.content}`).join('\n\n')
      : "No relevant public rulebooks found in the database for the selected agencies.";

    // 3. Send the draft memo and the retrieved rules to Anthropic
    const prompt = `
You are an expert affordable housing underwriter assistant for LISC NY.
Your job is to review a draft deal memo and cross-reference it against public government regulations to find compliance issues.

Here are the relevant excerpts from the public government rulebooks (The "Source of Truth"):
<rulebooks>
${contextText}
</rulebooks>

Here is the draft deal memo uploaded by the underwriter:
<draft_memo>
${markdown}
</draft_memo>

Please perform two tasks:
1. Extract standard underwriting data points from the draft memo.
2. Flag any compliance violations where the draft memo contradicts the public rulebooks. If you flag something, you MUST cite the specific Source and Page Number from the <rulebooks> section. If there are no violations, state that.

Respond strictly in the following JSON format:
{
  "questionnaire": {
    "projectName": "string or null",
    "developerName": "string or null",
    "totalUnits": "number or null",
    "requestedLoanAmount": "string or null",
    "targetAMI": "string or null"
  },
  "complianceFlags": [
    {
      "issue": "Description of the violation",
      "citation": "Exact citation from the rulebook",
      "severity": "High" | "Medium" | "Low"
    }
  ]
}
`;

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      temperature: 0,
      system: "You are a precise, analytical underwriting assistant. You only output valid JSON.",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    // Parse the JSON response from Claude
    const responseText = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    
    // Clean up the response in case Claude added markdown formatting around the JSON
    const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
    
    const analysis = JSON.parse(cleanJson);

    return NextResponse.json({ success: true, analysis });

  } catch (error: any) {
    console.error('Analysis API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error during analysis' },
      { status: 500 }
    );
  }
}
