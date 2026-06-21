-- Add season_number column to media_trackings for per-season independent tracking
ALTER TABLE media_trackings ADD COLUMN IF NOT EXISTS season_number INTEGER NOT NULL DEFAULT 0;

-- Update unique constraint to include season_number
-- First drop the old constraint, then add the new one
ALTER TABLE media_trackings DROP CONSTRAINT IF EXISTS media_trackings_username_tmdb_id_media_type_key;
ALTER TABLE media_trackings ADD CONSTRAINT media_trackings_username_tmdb_id_media_type_season_number_key UNIQUE (username, tmdb_id, media_type, season_number);
