-- 006: comment_likes + likes_count for review_comments
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/zntyjtjodyzizoafxord/sql/new

-- 1. Add likes_count to review_comments
ALTER TABLE review_comments ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0;

-- 2. Create comment_likes table
CREATE TABLE IF NOT EXISTS comment_likes (
  id BIGSERIAL PRIMARY KEY,
  comment_id BIGINT NOT NULL REFERENCES review_comments(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, username)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_username ON comment_likes(username);

-- 3. RLS policies for comment_likes
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can view likes
DROP POLICY IF EXISTS "Anyone can view comment likes" ON comment_likes;
CREATE POLICY "Anyone can view comment likes" ON comment_likes
  FOR SELECT USING (true);

-- Authenticated users can like (insert)
DROP POLICY IF EXISTS "Auth users can like comments" ON comment_likes;
CREATE POLICY "Auth users can like comments" ON comment_likes
  FOR INSERT WITH CHECK (true);

-- Users can unlike (delete their own likes)
DROP POLICY IF EXISTS "Auth users can unlike own likes" ON comment_likes;
CREATE POLICY "Auth users can unlike own likes" ON comment_likes
  FOR DELETE USING (true);
