import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { generateEmbedding } from '@/utils/embeddings';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { messages, agencies, agencyNames } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    // Get the latest user message
    const lastUserMessage = messages[messages.length - 1];

    const supabase = await createClient();

    // 1. If there is conversation history, condense it into a standalone search query
    // so follow-up questions like "does that apply to senior loans?" still search correctly
    let searchQuery = lastUserMessage.content;
    if (messages.length > 1) {
      const condensingResult = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 200,
        system: "Given a conversation history, rewrite the final user question into a single, self-contained search query that captures the full intent. Output ONLY the rewritten query, nothing else.",
        messages: [
          {
            role: "user",
            content: `Conversation history:\n${messages.slice(0, -1).map(m => `${m.role}: ${m.content}`).join('\n')}\n\nFinal question: ${lastUserMessage.content}\n\nRewrite the final question as a standalone search query:`
          }
        ]
      });
      searchQuery = condensingResult.content[0].type === 'text' ? condensingResult.content[0].text.trim() : lastUserMessage.content;
    }

    // 2. Generate embedding using the condensed standalone query
    const queryEmbedding = await generateEmbedding(searchQuery);

    // 3. Search Supabase for relevant chunks
    const { data: relevantChunks, error: searchError } = await supabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.1, // Lower threshold for PoC
      match_count: 5, // Top 5 chunks for chat context
      filter_agencies: agencies
    });

    if (searchError) {
      console.error('Vector search error:', searchError);
    }

    // 4. Combine retrieved chunks
    const contextText = relevantChunks && relevantChunks.length > 0
      ? relevantChunks.map((chunk: any) => `[Source: ${chunk.agency} - ${chunk.title}, Page ${chunk.page_number}]\n${chunk.content}`).join('\n\n')
      : "No relevant public rulebooks found in the database for the selected agencies.";

    // 5. Build system prompt
    const agencyContext = agencyNames && agencyNames.length > 0
      ? `The user has selected the following target agencies: ${agencyNames.join(', ')}. Refer to these agencies by name when relevant in your responses.`
      : 'The user has not selected any specific agencies.';

    const systemPrompt = `You are a professional policy research assistant for LISC NY, helping underwriters navigate affordable housing loan regulations.
${agencyContext}

Your job is to answer the user's questions strictly using the provided excerpts from public government rulebooks.

Here are the relevant excerpts (The "Source of Truth"):
<rulebooks>
${contextText}
</rulebooks>

Instructions:
- Always reference the selected agency/agencies by name in your response when applicable (e.g. "According to the HCR guidelines...").
- If the answer is in the rulebooks, answer the question and cite the specific Source and Page Number.
- If the answer is NOT in the rulebooks, state clearly that you cannot find the answer in the provided documents for the selected agencies. Do not guess or make up answers.
- Write in a professional, formal tone suitable for financial underwriting professionals.
- Do not use emojis, bullet symbols, or informal language. Use plain markdown formatting only (bold, headers, numbered lists).`;

    // 6. Call Anthropic with full conversation history for a coherent response
    const anthropicMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      temperature: 0.2,
      system: systemPrompt,
      messages: anthropicMessages
    });

    // 7. Return response
    const responseText = msg.content[0].type === 'text' ? msg.content[0].text : 'Sorry, I could not generate a response.';

    return NextResponse.json({ 
      success: true, 
      response: {
        role: 'assistant',
        content: responseText
      } 
    });

  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error during chat' },
      { status: 500 }
    );
  }
}
