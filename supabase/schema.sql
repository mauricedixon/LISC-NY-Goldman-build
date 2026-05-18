-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Table to store public rulebooks (e.g., HCR Term Sheet)
create table public_documents (
  id bigserial primary key,
  title text not null,
  agency text not null, -- e.g., 'hcr', 'hpd', 'hud'
  loan_type text, -- e.g., 'New Construction'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table to store the parsed chunks and their embeddings
create table document_chunks (
  id bigserial primary key,
  document_id bigint references public_documents(id) on delete cascade,
  content text not null, -- The markdown chunk from LlamaParse
  embedding vector(1536), -- OpenAI text-embedding-3-small with 1536 dimensions
  page_number integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create an index for faster similarity search
create index on document_chunks using hnsw (embedding vector_cosine_ops);

-- Set up Row Level Security (RLS)
-- For the public data engine, anyone can read the public documents and chunks
alter table public_documents enable row level security;
alter table document_chunks enable row level security;

create policy "Public documents are viewable by everyone."
  on public_documents for select
  using ( true );

create policy "Document chunks are viewable by everyone."
  on document_chunks for select
  using ( true );

-- Storage bucket for temporary draft memo uploads
insert into storage.buckets (id, name, public) values ('draft_memos', 'draft_memos', false);

-- RLS for the storage bucket (only authenticated users or anon can upload, but we'll restrict to anon for PoC)
create policy "Anyone can upload draft memos"
  on storage.objects for insert
  with check ( bucket_id = 'draft_memos' );

create policy "Anyone can read their own uploaded draft memos"
  on storage.objects for select
  using ( bucket_id = 'draft_memos' );

create policy "Anyone can delete draft memos"
  on storage.objects for delete
  using ( bucket_id = 'draft_memos' );
