-- Supabase SQL Editor에서 실행하세요
-- https://zntyjtjodyzizoafxord.supabase.co → SQL Editor

CREATE TABLE IF NOT EXISTS episode_watches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username       TEXT NOT NULL,
  tmdb_id        INT NOT NULL,
  season_number  INT NOT NULL,
  episode_number INT NOT NULL,
  watched_at     TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(username, tmdb_id, season_number, episode_number)
);

CREATE INDEX IF NOT EXISTS idx_episode_watches_user_show 
  ON episode_watches(username, tmdb_id);
