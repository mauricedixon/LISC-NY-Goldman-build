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

// --- Parse command-line arguments ---
// Usage: node scripts/ingest-rulebook.mjs --pdf <path> --agency <id> --title <"title"> [--loan-type <type>]
// Example: node scripts/ingest-rulebook.mjs --pdf ~/Downloads/hpd-term-sheet.pdf --agency hpd --title "HPD New Construction Term Sheet 2025" --loan-type "New Construction"
const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
}

const PDF_PATH_ARG = getArg('--pdf');
const AGENCY_ARG = getArg('--agency');
const TITLE_ARG = getArg('--title');
const LOAN_TYPE_ARG = getArg('--loan-type') || 'New Construction';

const VALID_AGENCIES = ['hpd', 'hdc', 'hcr', 'esd', 'hud', 'fannie'];

if (!PDF_PATH_ARG || !AGENCY_ARG || !TITLE_ARG) {
  console.error(`
Usage: node scripts/ingest-rulebook.mjs --pdf <path-to-pdf> --agency <agency-id> --title "<document title>" [--loan-type "<type>"]

Required:
  --pdf         Path to the PDF file to ingest (e.g. ~/Downloads/hpd-term-sheet.pdf)
  --agency      Agency ID — must be one of: ${VALID_AGENCIES.join(', ')}
  --title       Full document title (e.g. "HPD New Construction Term Sheet 2025")

Optional:
  --loan-type   Loan type (default: "New Construction")

Examples:
  node scripts/ingest-rulebook.mjs --pdf ~/Downloads/hpd-term-sheet.pdf --agency hpd --title "HPD New Construction Term Sheet 2025"
  node scripts/ingest-rulebook.mjs --pdf ~/Downloads/hud-221d4.pdf --agency hud --title "HUD 221(d)(4) Program Guide 2025" --loan-type "Rehabilitation"
`);
  process.exit(1);
}

if (!VALID_AGENCIES.includes(AGENCY_ARG.toLowerCase())) {
  console.error(`Invalid agency "${AGENCY_ARG}". Must be one of: ${VALID_AGENCIES.join(', ')}`);
  process.exit(1);
}

// Resolve the PDF path (handles ~ for home directory)
const resolvedPdfPath = PDF_PATH_ARG.replace(/^~/, process.env.HOME);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const LLAMAPARSE_API_KEY = process.env.LLAMAPARSE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_API_KEY) {
  console.error("Missing required environment variables (check .env.local).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Chunking function — splits by double newline at paragraph/table level
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

// Parse PDF using LlamaParse and return markdown string
async function parsePdfWithLlamaParse(pdfPath) {
  if (!LLAMAPARSE_API_KEY) {
    throw new Error("LLAMAPARSE_API_KEY is not set in .env.local");
  }

  console.log("Uploading PDF to LlamaParse...");
  const fileBuffer = fs.readFileSync(pdfPath);
  const fileBlob = new Blob([fileBuffer], { type: 'application/pdf' });

  const formData = new FormData();
  formData.append('file', fileBlob, path.basename(pdfPath));
  formData.append('parsing_instruction', 'Pay strict attention to financial tables, AMI limits, LTV caps, and loan terms. Ensure row and column headers align perfectly. Output clean markdown.');

  const uploadResponse = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${LLAMAPARSE_API_KEY}` },
    body: formData
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`LlamaParse upload failed: ${uploadResponse.status} - ${errorText}`);
  }

  const { id: jobId } = await uploadResponse.json();
  console.log(`LlamaParse job started (ID: ${jobId}). Waiting for completion...`);

  // Poll until done
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 3000));

    const statusResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
      headers: { 'Authorization': `Bearer ${LLAMAPARSE_API_KEY}` }
    });

    const { status } = await statusResponse.json();
    process.stdout.write(`\rStatus: ${status}...`);

    if (status === 'SUCCESS') break;
    if (status === 'ERROR' || status === 'FAILED') {
      throw new Error(`LlamaParse job failed with status: ${status}`);
    }
  }

  console.log("\nParsing complete. Downloading markdown...");
  const resultResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`, {
    headers: { 'Authorization': `Bearer ${LLAMAPARSE_API_KEY}` }
  });

  if (!resultResponse.ok) {
    throw new Error(`Failed to download LlamaParse result: ${resultResponse.status}`);
  }

  const { markdown } = await resultResponse.json();
  return markdown;
}

async function ingestRulebook() {
  console.log(`\nStarting ingestion for: ${TITLE_ARG}`);
  console.log(`Agency: ${AGENCY_ARG.toUpperCase()} | Loan Type: ${LOAN_TYPE_ARG}`);
  console.log(`PDF: ${resolvedPdfPath}\n`);

  if (!fs.existsSync(resolvedPdfPath)) {
    console.error(`Error: PDF not found at ${resolvedPdfPath}`);
    process.exit(1);
  }

  // Step 1: Parse the PDF via LlamaParse
  const markdownContent = await parsePdfWithLlamaParse(resolvedPdfPath);

  // Save a local copy of the parsed markdown for reference
  const outputDir = path.join(__dirname, '../output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, `parsed_${AGENCY_ARG.toLowerCase()}_${Date.now()}.md`);
  fs.writeFileSync(outputFile, markdownContent);
  console.log(`Parsed markdown saved to: ${outputFile}`);

  // Step 2: Create the document record in Supabase
  console.log("\nCreating document record in Supabase...");
  const { data: docData, error: docError } = await supabase
    .from('public_documents')
    .insert({
      title: TITLE_ARG,
      agency: AGENCY_ARG.toLowerCase(),
      loan_type: LOAN_TYPE_ARG
    })
    .select()
    .single();

  if (docError) {
    console.error("Failed to create document record:", docError);
    process.exit(1);
  }

  const documentId = docData.id;
  console.log(`Document record created with ID: ${documentId}`);

  // Step 3: Chunk the markdown
  console.log("Chunking markdown...");
  const chunks = chunkText(markdownContent);
  console.log(`Created ${chunks.length} chunks.`);

  // Step 4: Generate embeddings and insert chunks
  console.log("Generating embeddings and uploading to Supabase...\n");
  let successCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunk,
      encoding_format: "float",
      dimensions: 1536,
    });

    const embedding = embeddingResponse.data[0].embedding;

    const { error: insertError } = await supabase
      .from('document_chunks')
      .insert({
        document_id: documentId,
        content: chunk,
        embedding: embedding,
        page_number: i + 1
      });

    if (insertError) {
      console.error(`\nFailed to insert chunk ${i + 1}:`, insertError.message);
    } else {
      successCount++;
      process.stdout.write(`\rInserted chunk ${i + 1}/${chunks.length}`);
    }
  }

  console.log(`\n\n✅ Ingestion complete! ${successCount}/${chunks.length} chunks uploaded for "${TITLE_ARG}".`);
}

ingestRulebook().catch(err => {
  console.error("\n❌ Fatal error:", err.message);
  process.exit(1);
});
