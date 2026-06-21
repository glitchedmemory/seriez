-- Add sanction columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS sanction_type TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sanction_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sanction_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sanctioned_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sanctioned_by TEXT;

-- Add constraint: valid sanction types
ALTER TABLE users ADD CONSTRAINT valid_sanction_type CHECK (
  sanction_type IS NULL OR sanction_type IN ('warned', 'suspended', 'banned', 'comment_restricted')
);
