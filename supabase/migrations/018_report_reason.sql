-- Add reason column to reports table for tracking why content was reported
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reason TEXT;
