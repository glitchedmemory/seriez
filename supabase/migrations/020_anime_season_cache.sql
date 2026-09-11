-- Cache the full season chain for an anime (anilist_id) so the anime
-- detail page doesn't re-walk the AniList relations graph on every visit.
-- Populated lazily by enrichAnimeRelations; read-first, write on miss.
CREATE TABLE IF NOT EXISTS anime_season_cache (
  anilist_id INTEGER PRIMARY KEY,
  chain JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Security: RLS ON, service_role-only access. anon/authenticated get nothing
-- (read returns 0 rows, write is rejected with 401). Reads/writes happen
-- server-side via SUPABASE_SERVICE_ROLE_KEY, never exposed to the client.
ALTER TABLE anime_season_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON anime_season_cache;
CREATE POLICY "service_role_all" ON anime_season_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
