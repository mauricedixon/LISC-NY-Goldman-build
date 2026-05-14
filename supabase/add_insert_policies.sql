-- Add insert policies for the ingestion script to work with the anon key
-- In a real production app, you would use the service_role key for the script and not need these

create policy "Anyone can insert public documents"
  on public_documents for insert
  with check ( true );

create policy "Anyone can insert document chunks"
  on document_chunks for insert
  with check ( true );
