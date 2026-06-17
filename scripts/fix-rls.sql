-- ============================================
-- Seriez Security Fix — Run in Supabase SQL Editor
-- ============================================

-- 1. COLLECTION_LIKES — Enable RLS + restrict INSERT
ALTER TABLE collection_likes ENABLE ROW LEVEL SECURITY;

-- Drop any too-permissive policies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'collection_likes')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON collection_likes', r.policyname);
  END LOOP;
END $$;

-- SELECT: anyone can read
CREATE POLICY "collection_likes_select" ON collection_likes FOR SELECT USING (true);
-- INSERT/DELETE: authenticated users only
CREATE POLICY "collection_likes_insert" ON collection_likes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "collection_likes_delete" ON collection_likes FOR DELETE USING (auth.role() = 'authenticated');


-- 2. SEARCH_LOGS — Enable RLS + restrict INSERT
ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'search_logs')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON search_logs', r.policyname);
  END LOOP;
END $$;

-- SELECT: anyone can read (needed for trending searches)
CREATE POLICY "search_logs_select" ON search_logs FOR SELECT USING (true);
-- INSERT: authenticated only
CREATE POLICY "search_logs_insert" ON search_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- 3. COMMENT_LIKES — Enable RLS + restrict INSERT
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'comment_likes')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON comment_likes', r.policyname);
  END LOOP;
END $$;

-- SELECT: anyone can read
CREATE POLICY "comment_likes_select" ON comment_likes FOR SELECT USING (true);
-- INSERT/DELETE: authenticated only
CREATE POLICY "comment_likes_insert" ON comment_likes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "comment_likes_delete" ON comment_likes FOR DELETE USING (auth.role() = 'authenticated');


-- 4. VERIFY — Check which tables still have RLS disabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity, tablename;
