-- 008: published collections + collection likes
ALTER TABLE user_lists ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
ALTER TABLE user_lists ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Collection likes table
CREATE TABLE IF NOT EXISTS collection_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES user_lists(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(list_id, username)
);

CREATE INDEX IF NOT EXISTS idx_collection_likes_list ON collection_likes(list_id);
CREATE INDEX IF NOT EXISTS idx_user_lists_published ON user_lists(is_published) WHERE is_published = true;

-- RLS for collection_likes
ALTER TABLE collection_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read collection likes" ON collection_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like" ON collection_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can unlike their own" ON collection_likes FOR DELETE USING (username = current_setting('request.jwt.claims', true)::json->>'username');

-- Seed 10 test collections with real-looking data
DO $$
DECLARE
  alice_id UUID;
  bob_id UUID;
  charlie_id UUID;
  diana_id UUID;
  elliott_id UUID;
BEGIN
  -- Create test users if they don't exist
  INSERT INTO users (username, email, is_premium) VALUES ('alice_wonder', 'alice@test.dev', false) ON CONFLICT (username) DO NOTHING;
  INSERT INTO users (username, email, is_premium) VALUES ('bob_movies', 'bob@test.dev', false) ON CONFLICT (username) DO NOTHING;
  INSERT INTO users (username, email, is_premium) VALUES ('charlie_flicks', 'charlie@test.dev', true) ON CONFLICT (username) DO NOTHING;
  INSERT INTO users (username, email, is_premium) VALUES ('diana_reels', 'diana@test.dev', false) ON CONFLICT (username) DO NOTHING;
  INSERT INTO users (username, email, is_premium) VALUES ('elliott_frames', 'elliott@test.dev', false) ON CONFLICT (username) DO NOTHING;

  SELECT id INTO alice_id FROM users WHERE username = 'alice_wonder';
  SELECT id INTO bob_id FROM users WHERE username = 'bob_movies';
  SELECT id INTO charlie_id FROM users WHERE username = 'charlie_flicks';
  SELECT id INTO diana_id FROM users WHERE username = 'diana_reels';
  SELECT id INTO elliott_id FROM users WHERE username = 'elliott_frames';

  -- Collection 1: Alice
  INSERT INTO user_lists (id, user_id, name, is_public, is_published, published_at, created_at)
  VALUES (gen_random_uuid(), alice_id, 'Cozy Sunday Films', true, true, now() - interval '2 days', now() - interval '5 days')
  ON CONFLICT DO NOTHING;

  -- Collection 2: Alice
  INSERT INTO user_lists (id, user_id, name, is_public, is_published, published_at, created_at)
  VALUES (gen_random_uuid(), alice_id, 'Animated Magic', true, true, now() - interval '1 day', now() - interval '3 days')
  ON CONFLICT DO NOTHING;

  -- Collection 3: Bob
  INSERT INTO user_lists (id, user_id, name, is_public, is_published, published_at, created_at)
  VALUES (gen_random_uuid(), bob_id, '90s Nostalgia Trip', true, true, now() - interval '3 days', now() - interval '10 days')
  ON CONFLICT DO NOTHING;

  -- Collection 4: Bob
  INSERT INTO user_lists (id, user_id, name, is_public, is_published, published_at, created_at)
  VALUES (gen_random_uuid(), bob_id, 'Sci-Fi Essentials', true, true, now() - interval '12 hours', now() - interval '7 days')
  ON CONFLICT DO NOTHING;

  -- Collection 5: Charlie
  INSERT INTO user_lists (id, user_id, name, is_public, is_published, published_at, created_at)
  VALUES (gen_random_uuid(), charlie_id, 'Horror Nights', true, true, now() - interval '6 hours', now() - interval '2 days')
  ON CONFLICT DO NOTHING;

  -- Collection 6: Charlie
  INSERT INTO user_lists (id, user_id, name, is_public, is_published, published_at, created_at)
  VALUES (gen_random_uuid(), charlie_id, 'Mind-Bending Thrillers', true, true, now() - interval '1 day', now() - interval '4 days')
  ON CONFLICT DO NOTHING;

  -- Collection 7: Diana
  INSERT INTO user_lists (id, user_id, name, is_public, is_published, published_at, created_at)
  VALUES (gen_random_uuid(), diana_id, 'Best of 2026 So Far', true, true, now() - interval '8 hours', now() - interval '1 day')
  ON CONFLICT DO NOTHING;

  -- Collection 8: Diana
  INSERT INTO user_lists (id, user_id, name, is_public, is_published, published_at, created_at)
  VALUES (gen_random_uuid(), diana_id, 'Foreign Gems', true, true, now() - interval '4 hours', now() - interval '6 days')
  ON CONFLICT DO NOTHING;

  -- Collection 9: Elliott
  INSERT INTO user_lists (id, user_id, name, is_public, is_published, published_at, created_at)
  VALUES (gen_random_uuid(), elliott_id, 'Underrated Indies', true, true, now() - interval '2 hours', now() - interval '3 days')
  ON CONFLICT DO NOTHING;

  -- Collection 10: Elliott
  INSERT INTO user_lists (id, user_id, name, is_public, is_published, published_at, created_at)
  VALUES (gen_random_uuid(), elliott_id, 'Action Marathon', true, true, now() - interval '30 minutes', now() - interval '1 day')
  ON CONFLICT DO NOTHING;
END $$;

-- Seed collection likes (40+ likes across collections)
DO $$
DECLARE
  lid UUID;
BEGIN
  -- Cozy Sunday Films: 42 likes
  SELECT id INTO lid FROM user_lists WHERE name = 'Cozy Sunday Films' LIMIT 1;
  IF lid IS NOT NULL THEN
    INSERT INTO collection_likes (list_id, username) VALUES
      (lid, 'bob_movies'), (lid, 'charlie_flicks'), (lid, 'diana_reels'), (lid, 'elliott_frames'), (lid, 'PixarFan'),
      (lid, 'MovieLover'), (lid, 'Critic42'), (lid, 'AnimAddict'), (lid, 'FamilyFirst'), (lid, 'Skeptic99'),
      (lid, 'CasualViewer'), (lid, 'alice_wonder'), (lid, 'WoodyPride'), (lid, 'BuzzLightyear'), (lid, 'luna_views')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Animated Magic: 28 likes
  SELECT id INTO lid FROM user_lists WHERE name = 'Animated Magic' LIMIT 1;
  IF lid IS NOT NULL THEN
    INSERT INTO collection_likes (list_id, username) VALUES
      (lid, 'bob_movies'), (lid, 'charlie_flicks'), (lid, 'diana_reels'), (lid, 'elliott_frames'), (lid, 'PixarFan'),
      (lid, 'MovieLover'), (lid, 'Critic42'), (lid, 'AnimAddict'), (lid, 'FamilyFirst'), (lid, 'alice_wonder'),
      (lid, 'WoodyPride'), (lid, 'BuzzLightyear'), (lid, 'luna_views'), (lid, 'CasualViewer')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Horror Nights: 15 likes
  SELECT id INTO lid FROM user_lists WHERE name = 'Horror Nights' LIMIT 1;
  IF lid IS NOT NULL THEN
    INSERT INTO collection_likes (list_id, username) VALUES
      (lid, 'alice_wonder'), (lid, 'bob_movies'), (lid, 'diana_reels'), (lid, 'elliott_frames'), (lid, 'PixarFan'),
      (lid, 'MovieLover'), (lid, 'Skeptic99'), (lid, 'CasualViewer'), (lid, 'BuzzLightyear'), (lid, 'luna_views'),
      (lid, 'charlie_flicks')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Sci-Fi Essentials: 8 likes
  SELECT id INTO lid FROM user_lists WHERE name = 'Sci-Fi Essentials' LIMIT 1;
  IF lid IS NOT NULL THEN
    INSERT INTO collection_likes (list_id, username) VALUES
      (lid, 'alice_wonder'), (lid, 'charlie_flicks'), (lid, 'diana_reels'), (lid, 'elliott_frames'), (lid, 'PixarFan'),
      (lid, 'MovieLover'), (lid, 'AnimAddict'), (lid, 'bob_movies')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Best of 2026 So Far: 6 likes
  SELECT id INTO lid FROM user_lists WHERE name = 'Best of 2026 So Far' LIMIT 1;
  IF lid IS NOT NULL THEN
    INSERT INTO collection_likes (list_id, username) VALUES
      (lid, 'alice_wonder'), (lid, 'bob_movies'), (lid, 'charlie_flicks'), (lid, 'elliott_frames'), (lid, 'PixarFan'), (lid, 'MovieLover')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Mind-Bending Thrillers: 5 likes
  SELECT id INTO lid FROM user_lists WHERE name = 'Mind-Bending Thrillers' LIMIT 1;
  IF lid IS NOT NULL THEN
    INSERT INTO collection_likes (list_id, username) VALUES
      (lid, 'alice_wonder'), (lid, 'bob_movies'), (lid, 'diana_reels'), (lid, 'elliott_frames'), (lid, 'PixarFan')
    ON CONFLICT DO NOTHING;
  END IF;

  -- 90s Nostalgia Trip: 3 likes (under 5 — won't appear)
  SELECT id INTO lid FROM user_lists WHERE name = '90s Nostalgia Trip' LIMIT 1;
  IF lid IS NOT NULL THEN
    INSERT INTO collection_likes (list_id, username) VALUES
      (lid, 'alice_wonder'), (lid, 'diana_reels'), (lid, 'elliott_frames')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Foreign Gems: 2 likes
  SELECT id INTO lid FROM user_lists WHERE name = 'Foreign Gems' LIMIT 1;
  IF lid IS NOT NULL THEN
    INSERT INTO collection_likes (list_id, username) VALUES
      (lid, 'alice_wonder'), (lid, 'bob_movies')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Underrated Indies: 1 like
  SELECT id INTO lid FROM user_lists WHERE name = 'Underrated Indies' LIMIT 1;
  IF lid IS NOT NULL THEN
    INSERT INTO collection_likes (list_id, username) VALUES
      (lid, 'bob_movies')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Action Marathon: 0 likes
  -- (no likes inserted)
END $$;
