import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local manually for this simple script
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

const LLAMAPARSE_API_KEY = process.env.LLAMAPARSE_API_KEY;

if (!LLAMAPARSE_API_KEY) {
  console.error("Error: LLAMAPARSE_API_KEY is not set in .env.local");
  process.exit(1);
}

// The target PDF provided by the user
const PDF_PATH = '/Users/moe/Downloads/hfa-term-sheet-and-financing-guide_standalone-term-sheet_spring-2025.pdf';
const OUTPUT_DIR = path.join(__dirname, '../output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'parsed_term_sheet.md');

async function runLlamaParse() {
  console.log(`Starting LlamaParse PoC...`);
  console.log(`Target PDF: ${PDF_PATH}`);

  if (!fs.existsSync(PDF_PATH)) {
    console.error(`Error: File not found at ${PDF_PATH}`);
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    // 1. Upload the file to LlamaParse
    console.log("Uploading file to LlamaParse...");
    const fileBuffer = fs.readFileSync(PDF_PATH);
    const fileBlob = new Blob([fileBuffer], { type: 'application/pdf' });
    
    const formData = new FormData();
    formData.append('file', fileBlob, path.basename(PDF_PATH));
    // Custom prompting to ensure tables are parsed perfectly
    formData.append('parsing_instruction', 'Pay strict attention to the financial tables, AMI limits, and LTV caps. Ensure row and column headers align perfectly. Output clean markdown.');

    const uploadResponse = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LLAMAPARSE_API_KEY}`
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
    }

    const uploadData = await uploadResponse.json();
    const jobId = uploadData.id;
    console.log(`Upload successful! Job ID: ${jobId}`);

    // 2. Poll for completion
    console.log("Polling for job completion...");
    let isDone = false;
    while (!isDone) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // wait 2 seconds
      
      const statusResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${LLAMAPARSE_API_KEY}`
        }
      });

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();
      console.log(`Status: ${statusData.status}`);

      if (statusData.status === 'SUCCESS') {
        isDone = true;
      } else if (statusData.status === 'ERROR' || statusData.status === 'FAILED') {
        throw new Error(`Parsing job failed: ${JSON.stringify(statusData)}`);
      }
    }

    // 3. Download the markdown result
    console.log("Downloading parsed markdown...");
    const resultResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`, {
      headers: {
        'Authorization': `Bearer ${LLAMAPARSE_API_KEY}`
      }
    });

    if (!resultResponse.ok) {
      throw new Error(`Failed to download result: ${resultResponse.status}`);
    }

    const resultData = await resultResponse.json();
    const markdownContent = resultData.markdown;

    // 4. Save to file
    fs.writeFileSync(OUTPUT_FILE, markdownContent);
    console.log(`\n✅ Success! Parsed markdown saved to: ${OUTPUT_FILE}`);

  } catch (error) {
    console.error("\n❌ Error during LlamaParse execution:");
    console.error(error);
  }
}

runLlamaParse();
