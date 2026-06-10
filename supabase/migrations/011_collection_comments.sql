-- Collection comments table
CREATE TABLE IF NOT EXISTS collection_comments (
  id SERIAL PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES user_lists(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 200),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collection_comments_collection ON collection_comments(collection_id, created_at DESC);
