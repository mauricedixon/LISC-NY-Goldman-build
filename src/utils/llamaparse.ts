export async function parseDocument(file: File): Promise<string> {
  const apiKey = process.env.LLAMAPARSE_API_KEY;
  
  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error("LlamaParse API key is not configured in .env.local");
  }

  const formData = new FormData();
  formData.append('file', file);
  // Custom prompting to ensure tables are parsed perfectly
  formData.append('parsing_instruction', 'Pay strict attention to the financial tables, AMI limits, and LTV caps. Ensure row and column headers align perfectly. Output clean markdown.');

  console.log(`[LlamaParse] Uploading ${file.name}...`);
  
  // 1. Upload to LlamaParse
  const uploadResponse = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
  }

  const uploadData = await uploadResponse.json();
  const jobId = uploadData.id;
  console.log(`[LlamaParse] Upload successful! Job ID: ${jobId}. Polling for completion...`);

  // 2. Poll for completion
  let isDone = false;
  let attempts = 0;
  const maxAttempts = 60; // 2 minutes max (60 * 2s)

  while (!isDone && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // wait 2 seconds
    attempts++;
    
    const statusResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!statusResponse.ok) {
      throw new Error(`Status check failed: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();

    if (statusData.status === 'SUCCESS') {
      isDone = true;
    } else if (statusData.status === 'ERROR' || statusData.status === 'FAILED') {
      throw new Error(`Parsing job failed: ${JSON.stringify(statusData)}`);
    }
  }

  if (!isDone) {
    throw new Error("LlamaParse job timed out after 2 minutes.");
  }

  // 3. Download the markdown result
  console.log(`[LlamaParse] Job ${jobId} complete. Downloading markdown...`);
  const resultResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  if (!resultResponse.ok) {
    throw new Error(`Failed to download result: ${resultResponse.status}`);
  }

  const resultData = await resultResponse.json();
  console.log(`[LlamaParse] Markdown downloaded successfully (${resultData.markdown.length} characters).`);
  
  return resultData.markdown;
}
