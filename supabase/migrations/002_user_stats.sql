-- Run in Supabase SQL Editor
-- Adds stats-related columns for user taste analysis

-- Add watched_at to media_trackings
ALTER TABLE media_trackings 
ADD COLUMN IF NOT EXISTS watched_at TIMESTAMPTZ;

-- Update existing completed items to use updated_at as watched_at
UPDATE media_trackings 
SET watched_at = updated_at 
WHERE status = 'completed' AND watched_at IS NULL;

-- Index for stats queries
CREATE INDEX IF NOT EXISTS idx_media_trackings_user_status 
ON media_trackings(username, status);

CREATE INDEX IF NOT EXISTS idx_media_trackings_watched_at 
ON media_trackings(username, watched_at DESC);

-- Index for reviews stats
CREATE INDEX IF NOT EXISTS idx_reviews_user_rating 
ON reviews(username, rating);
