import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables manually
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // Using anon key for PoC, ideally use service_role key for admin tasks
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_API_KEY) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// The markdown file we generated in the first PoC step
const MARKDOWN_PATH = path.join(__dirname, '../output/parsed_term_sheet.md');

// Simple chunking function (splits by double newline, roughly paragraph/table level)
function chunkText(text, maxChunkSize = 2000) {
  const paragraphs = text.split('\n\n');
  const chunks = [];
  let currentChunk = "";

  for (const p of paragraphs) {
    if ((currentChunk.length + p.length) > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
    currentChunk += p + "\n\n";
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function ingestRulebook() {
  console.log("Starting ingestion process...");

  if (!fs.existsSync(MARKDOWN_PATH)) {
    console.error(`Error: Parsed markdown not found at ${MARKDOWN_PATH}. Please run llamaparse-poc.mjs first.`);
    process.exit(1);
  }

  const markdownContent = fs.readFileSync(MARKDOWN_PATH, 'utf-8');
  
  // 1. Create the document record
  console.log("Creating document record in Supabase...");
  const { data: docData, error: docError } = await supabase
    .from('public_documents')
    .insert({
      title: 'HCR New Construction Capital Program (NCP) Term Sheet - Spring 2025',
      agency: 'hcr',
      loan_type: 'New Construction'
    })
    .select()
    .single();

  if (docError) {
    console.error("Failed to create document:", docError);
    process.exit(1);
  }

  const documentId = docData.id;
  console.log(`Created document with ID: ${documentId}`);

  // 2. Chunk the markdown
  console.log("Chunking markdown...");
  const chunks = chunkText(markdownContent);
  console.log(`Created ${chunks.length} chunks.`);

  // 3. Generate embeddings and insert chunks
  console.log("Generating embeddings and inserting into database...");
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    // Generate embedding using OpenAI
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunk,
      encoding_format: "float",
    });
    
    const embedding = embeddingResponse.data[0].embedding;

    // Insert into Supabase
    const { error: insertError } = await supabase
      .from('document_chunks')
      .insert({
        document_id: documentId,
        content: chunk,
        embedding: embedding,
        page_number: i + 1 // Rough approximation for PoC
      });

    if (insertError) {
      console.error(`Failed to insert chunk ${i}:`, insertError);
    } else {
      process.stdout.write(`\rInserted chunk ${i + 1}/${chunks.length}`);
    }
  }

  console.log("\n✅ Ingestion complete!");
}

ingestRulebook();
