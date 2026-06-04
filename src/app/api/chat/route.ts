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
        system: "Given a conversation history, rewrite the final user question into a single, self-contained search query that captures the full intent. Output ONLY the rewritten query as plain text, nothing else.",
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

    // 4. Combine retrieved chunks — track whether any data was actually found
    const hasResults = relevantChunks && relevantChunks.length > 0;
    const contextText = hasResults
      ? relevantChunks.map((chunk: any) => `[Source: ${chunk.agency} - ${chunk.title}, Page ${chunk.page_number}]\n${chunk.content}`).join('\n\n')
      : null;

    // If there are no results at all, short-circuit with a clear message before calling Claude
    if (!hasResults) {
      const agencyLabel = agencyNames && agencyNames.length > 0 ? agencyNames.join(', ') : 'the selected agencies';
      return NextResponse.json({
        success: true,
        response: {
          role: 'assistant',
          content: `No rulebook data has been ingested yet for ${agencyLabel}. Please contact your administrator to upload and ingest the relevant term sheets for this agency before using the chatbot.`
        }
      });
    }

    // 5. Build system prompt
    const agencyContext = agencyNames && agencyNames.length > 0
      ? `The user has selected the following target agencies: ${agencyNames.join(', ')}. Only reference these specific agencies in your responses. Never reference or mention any other agencies not listed here.`
      : 'The user has not selected any specific agencies.';

    const systemPrompt = `You are a professional policy research assistant for LISC NY, helping underwriters navigate affordable housing loan regulations.
${agencyContext}

Your job is to answer the user's questions strictly using the provided excerpts from public government rulebooks.

Here are the relevant excerpts (The "Source of Truth"):
<rulebooks>
${contextText}
</rulebooks>

Instructions:
- Only use information from the rulebook excerpts above. Do not reference any agencies, rules, or data outside of what is provided.
- Always cite the specific Source and Page Number when referencing the rulebooks, using the format [Source: Agency - Title, Page N].
- If the answer is not clearly present in the excerpts above, say so directly. Do not guess or supplement with outside knowledge.
- Write in a professional, formal tone suitable for financial underwriting professionals.
- Do NOT use markdown headers or bullet syntax. Write in plain text. Use [Source: ...] tags for citations so they can be highlighted.
- You may use numbered lists or dashed bullet points for clarity when listing multiple items.
- Do not use emojis or informal language.`;

    // 6. Call Anthropic with full conversation history for a coherent response
    const anthropicMessages = messages.map(
      (msg: { role: string; content: string }) => ({
        role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: msg.content,
      })
    );

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
