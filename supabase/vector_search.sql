-- Drop existing function if it exists
drop function if exists match_document_chunks;

-- Create the vector search function
create or replace function match_document_chunks (
  query_embedding vector(1024),
  match_threshold float,
  match_count int,
  filter_agencies text[]
)
returns table (
  id bigint,
  document_id bigint,
  content text,
  page_number integer,
  similarity float,
  title text,
  agency text
)
language sql stable
as $$
  select
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    document_chunks.page_number,
    1 - (document_chunks.embedding <=> query_embedding) as similarity,
    public_documents.title,
    public_documents.agency
  from document_chunks
  join public_documents on document_chunks.document_id = public_documents.id
  where 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
    -- Only filter by agency if the array is provided and not empty
    and (
      filter_agencies is null 
      or array_length(filter_agencies, 1) is null 
      or public_documents.agency = any(filter_agencies)
    )
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;
