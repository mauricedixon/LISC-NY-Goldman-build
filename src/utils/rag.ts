import { createClient } from "@/utils/supabase/server";
import { generateEmbedding } from "@/utils/embeddings";

export interface RulebookChunk {
  agency: string;
  title: string;
  page_number: number;
  content: string;
}

export async function retrieveRulebookContext(
  queryText: string,
  agencies: string[],
  matchCount = 10
): Promise<{ chunks: RulebookChunk[]; contextText: string }> {
  const supabase = await createClient();
  const queryEmbedding = await generateEmbedding(queryText);

  const { data: relevantChunks, error: searchError } = await supabase.rpc(
    "match_document_chunks",
    {
      query_embedding: queryEmbedding,
      match_threshold: 0.1,
      match_count: matchCount,
      filter_agencies: agencies,
    }
  );

  if (searchError) {
    console.error("Vector search error:", searchError);
  }

  const chunks: RulebookChunk[] = relevantChunks ?? [];
  const contextText =
    chunks.length > 0
      ? chunks
          .map(
            (chunk) =>
              `[Source: ${chunk.agency} - ${chunk.title}, Page ${chunk.page_number}]\n${chunk.content}`
          )
          .join("\n\n")
      : "No relevant public rulebooks found in the database for the selected agencies.";

  return { chunks, contextText };
}
