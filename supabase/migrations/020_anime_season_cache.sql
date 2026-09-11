-- Permanent page cache for anime detail pages. Keyed by anilist_id, stores the
-- full getAnimeDetail result (detail), the getAnimeEpisodes result (episodes),
-- and the enriched season chain (chain). These are effectively immutable, so once
-- fetched they are served from here and the AniList/ani.zip/Kitsu/YouTube calls
-- are skipped entirely on subsequent visits.
CREATE TABLE IF NOT EXISTS anime_season_cache (
  anilist_id INTEGER PRIMARY KEY,
  chain JSONB,
  detail JSONB,
  episodes JSONB,
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
