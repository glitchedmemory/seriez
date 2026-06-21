-- Run this in Supabase SQL Editor
-- Creates custom posters table for fallback when TMDB has no poster

CREATE TABLE IF NOT EXISTS custom_posters (
  tmdb_id INTEGER PRIMARY KEY,
  poster_url TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('tv', 'movie')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: allow authenticated users to insert/update, anon to read
ALTER TABLE custom_posters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON custom_posters
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert" ON custom_posters
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update" ON custom_posters
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Storage bucket for actual poster files
-- Note: needs service_role key to create. Do this in Supabase Dashboard > Storage
-- Bucket name: posters
-- Public bucket: yes
-- Allowed MIME types: image/jpeg, image/png, image/webp
-- File size limit: 10MB
