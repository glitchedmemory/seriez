-- ============================================================
-- seriez Full RLS Hardening — 2026-06-07
-- Run in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. reviews — Critical: anonymous INSERT allowed
-- ============================================================
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read reviews" ON reviews;
CREATE POLICY "Anyone can read reviews" ON reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth users can create reviews" ON reviews;
CREATE POLICY "Auth users can create reviews" ON reviews
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authors can update own reviews" ON reviews;
CREATE POLICY "Authors can update own reviews" ON reviews
  FOR UPDATE USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Authors can delete own reviews" ON reviews;
CREATE POLICY "Authors can delete own reviews" ON reviews
  FOR DELETE USING (auth.uid()::text = user_id);

-- ============================================================
-- 2. users — Email exposed to anonymous
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read public profile" ON users;
CREATE POLICY "Anyone can read public profile" ON users
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id);

-- ============================================================
-- 3. media_trackings — Watch history exposed
-- ============================================================
ALTER TABLE media_trackings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own trackings" ON media_trackings;
CREATE POLICY "Users can read own trackings" ON media_trackings
  FOR SELECT USING (auth.uid()::text = username);

DROP POLICY IF EXISTS "Auth users can create own trackings" ON media_trackings;
CREATE POLICY "Auth users can create own trackings" ON media_trackings
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid()::text = username
  );

DROP POLICY IF EXISTS "Users can update own trackings" ON media_trackings;
CREATE POLICY "Users can update own trackings" ON media_trackings
  FOR UPDATE USING (auth.uid()::text = username);

DROP POLICY IF EXISTS "Users can delete own trackings" ON media_trackings;
CREATE POLICY "Users can delete own trackings" ON media_trackings
  FOR DELETE USING (auth.uid()::text = username);

-- ============================================================
-- 4. review_likes — Anonymous like spam
-- ============================================================
ALTER TABLE review_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read likes" ON review_likes;
CREATE POLICY "Anyone can read likes" ON review_likes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth users can create likes" ON review_likes;
CREATE POLICY "Auth users can create likes" ON review_likes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete own likes" ON review_likes;
CREATE POLICY "Users can delete own likes" ON review_likes
  FOR DELETE USING (auth.uid()::text = username);

-- ============================================================
-- 5. episode_watches — Strengthen existing policies
-- ============================================================
DROP POLICY IF EXISTS "Users can read own watches" ON episode_watches;
CREATE POLICY "Users can read own watches" ON episode_watches
  FOR SELECT USING (auth.uid()::text = username);

DROP POLICY IF EXISTS "Users can create own watches" ON episode_watches;
CREATE POLICY "Users can create own watches" ON episode_watches
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid()::text = username
  );

DROP POLICY IF EXISTS "Users can delete own watches" ON episode_watches;
CREATE POLICY "Users can delete own watches" ON episode_watches
  FOR DELETE USING (auth.uid()::text = username);

-- ============================================================
-- 6. follows — Only involved parties can read
-- ============================================================
DROP POLICY IF EXISTS "Users can read own follows" ON follows;
CREATE POLICY "Users can read own follows" ON follows
  FOR SELECT USING (
    auth.uid()::text = follower_id
    OR auth.uid()::text = following_id
  );

-- ============================================================
-- 7. user_lists — Public lists readable, private only by owner
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read public lists" ON user_lists;
CREATE POLICY "Anyone can read public lists" ON user_lists
  FOR SELECT USING (is_public = true OR auth.uid()::text = user_id);

-- ============================================================
-- 8. list_items — Only visible through parent list
-- ============================================================
DROP POLICY IF EXISTS "Users can read list items via parent" ON list_items;
CREATE POLICY "Users can read list items via parent" ON list_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_lists
      WHERE user_lists.id = list_items.list_id
      AND (user_lists.is_public = true OR user_lists.user_id = auth.uid()::text)
    )
  );
