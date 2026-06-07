-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/zntyjtjodyzizoafxord/sql/new

-- 1. Review Comments table
CREATE TABLE IF NOT EXISTS review_comments (
  id BIGSERIAL PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 1000),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_comments_review_id ON review_comments(review_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_created ON review_comments(created_at DESC);

-- 2. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'comment',
  actor_username TEXT NOT NULL,
  target_username TEXT NOT NULL,
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  title_name TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target_username, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- 3. Enable RLS with public access (same as other tables)
ALTER TABLE review_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read comments
CREATE POLICY "Anyone can read comments" ON review_comments FOR SELECT USING (true);
-- Authenticated users can insert comments
CREATE POLICY "Users can insert comments" ON review_comments FOR INSERT WITH CHECK (true);
-- Users can delete their own comments
CREATE POLICY "Users can delete own comments" ON review_comments FOR DELETE USING (username = current_setting('request.jwt.claims', true)::json->>'sub');

-- Notifications: users can only see their own
CREATE POLICY "Users see own notifications" ON notifications FOR SELECT USING (target_username = current_setting('request.jwt.claims', true)::json->>'sub' OR target_username = 'Anonymous');
-- Anyone can create notifications (for system use)
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (true);
-- Users can mark their own notifications as read
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (target_username = current_setting('request.jwt.claims', true)::json->>'sub');
