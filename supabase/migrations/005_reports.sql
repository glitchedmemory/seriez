-- ============================================================
-- seriez Report System + Hidden Content — 2026-06-09
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add is_hidden to reviews
ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;

-- 2. Add is_hidden to review_comments
ALTER TABLE review_comments 
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;

-- 3. Reports table (unified for reviews + comments)
CREATE TABLE IF NOT EXISTS reports (
  id BIGSERIAL PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('review', 'comment')),
  target_id TEXT NOT NULL,
  reporter_username TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One report per user per target
  UNIQUE(target_type, target_id, reporter_username)
);

CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_username);

-- 4. RLS for reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Anyone can read report counts (to show status)
CREATE POLICY "Anyone can read reports" ON reports
  FOR SELECT USING (true);

-- Auth users can create reports (one per target)
CREATE POLICY "Auth users can report" ON reports
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid()::text = reporter_username
  );

-- Users can delete their own reports (un-report)
CREATE POLICY "Users can delete own reports" ON reports
  FOR DELETE USING (auth.uid()::text = reporter_username);

-- 5. Admin can unhide content
-- (handled via service_role API route, not RLS)
