-- Fix 1: Strengthen review_comments RLS
DROP POLICY IF EXISTS "Users can insert comments" ON review_comments;
CREATE POLICY "Auth users can insert comments" ON review_comments 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete own comments" ON review_comments;
CREATE POLICY "Comment author can delete" ON review_comments 
  FOR DELETE USING (auth.uid()::text = username);

-- Fix 2: Strengthen notifications RLS
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "Server creates notifications" ON notifications 
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users see own notifications" ON notifications;
CREATE POLICY "Users see own notifications" ON notifications 
  FOR SELECT USING (
    target_username = auth.uid()::text 
    OR target_username = 'Anonymous'
  );

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users update own notifications" ON notifications 
  FOR UPDATE USING (target_username = auth.uid()::text);
