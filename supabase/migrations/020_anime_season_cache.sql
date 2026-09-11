-- Cache the full season chain for an anime (anilist_id) so the anime
-- detail page doesn't re-walk the AniList relations graph on every visit.
-- Populated lazily by enrichAnimeRelations; read-first, write on miss.
CREATE TABLE IF NOT EXISTS anime_season_cache (
  anilist_id INTEGER PRIMARY KEY,
  chain JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Service role writes; public reads only need this if we exposed it, but it's
-- read via SUPABASE_SERVICE_ROLE_KEY on the server, so no RLS policy needed for
-- anon. Keep RLS off to avoid auth complications in server-side reads.
ALTER TABLE anime_season_cache ENABLE ROW LEVEL SECURITY;
