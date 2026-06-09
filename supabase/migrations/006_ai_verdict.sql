-- Add AI verdict columns for report system
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ai_verdict TEXT;
ALTER TABLE review_comments ADD COLUMN IF NOT EXISTS ai_verdict TEXT;
