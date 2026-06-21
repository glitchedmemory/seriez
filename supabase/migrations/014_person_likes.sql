-- person_likes: user-curated favorite actors/directors
CREATE TABLE IF NOT EXISTS person_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  person_source TEXT NOT NULL CHECK (person_source IN ('tmdb', 'anilist')),
  person_id INTEGER NOT NULL,
  person_name TEXT NOT NULL,
  person_image TEXT,
  person_role TEXT NOT NULL CHECK (person_role IN ('director', 'actor', 'both')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(username, person_source, person_id)
);

ALTER TABLE person_likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can read own likes" ON person_likes
    FOR SELECT USING (auth.uid()::text = username);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own likes" ON person_likes
    FOR INSERT WITH CHECK (auth.uid()::text = username);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own likes" ON person_likes
    FOR DELETE USING (auth.uid()::text = username);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
