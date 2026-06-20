-- 015_anti_spam.sql — Rate limiting + Anti-spam protections
-- Run in Supabase SQL Editor

-- 1. Rate log table (tracks all review/comment POSTs for rate limiting)
CREATE TABLE IF NOT EXISTS rate_log (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('review', 'comment')),
  content_hash TEXT,  -- SHA256 first 16 chars for duplicate detection
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_log_lookup ON rate_log(username, action, created_at DESC);

-- 2. One review per title per user
-- Remove existing duplicates (keep most recent)
DELETE FROM reviews a USING reviews b
WHERE a.username = b.username 
  AND a.tmdb_id = b.tmdb_id 
  AND a.media_type = b.media_type 
  AND a.created_at < b.created_at;

-- Add UNIQUE constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'one_review_per_title' AND conrelid = 'reviews'::regclass
  ) THEN
    ALTER TABLE reviews ADD CONSTRAINT one_review_per_title UNIQUE (username, tmdb_id, media_type);
  END IF;
END $$;

-- 3. Content hash index for duplicate detection (optional, used in-app)
CREATE INDEX IF NOT EXISTS idx_reviews_content_hash ON reviews(username, created_at DESC);
