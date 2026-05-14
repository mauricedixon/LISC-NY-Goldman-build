import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { parseDocument } from '@/utils/llamaparse';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Generate a unique filename to prevent collisions
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `${fileName}`;

    // 1. Upload the file to Supabase Storage
    const { data, error } = await supabase.storage
      .from('draft_memos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return NextResponse.json(
        { error: 'Failed to upload file to storage' },
        { status: 500 }
      );
    }

    // 2. Send the file to LlamaParse to extract structured Markdown
    let markdown = "";
    try {
      markdown = await parseDocument(file);
    } catch (parseError: any) {
      console.error('LlamaParse error:', parseError);
      return NextResponse.json({ 
        success: true, 
        path: data.path,
        originalName: file.name,
        warning: `File uploaded to Supabase, but parsing failed: ${parseError.message}`
      });
    }

    // Return the path and the parsed markdown so the frontend can trigger the RAG pipeline next
    return NextResponse.json({ 
      success: true, 
      path: data.path,
      originalName: file.name,
      markdownLength: markdown.length,
      markdown: markdown,
      message: "File uploaded and parsed successfully!"
    });

  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during upload' },
      { status: 500 }
    );
  }
}
