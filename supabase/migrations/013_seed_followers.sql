-- Seed followers: 8 virtual users following each other in a cluster
-- Creates a realistic follow graph

-- Insert 8 users if not exist
INSERT INTO users (id, username, email, created_at, updated_at, role, is_premium)
VALUES
  ('fd000001-0001-4000-a000-000000000001', 'JailynMorales', 'jailyn@seriez.test', now(), now(), 'user', false),
  ('fd000001-0001-4000-a000-000000000002', 'sagrl', 'sagrl@seriez.test', now(), now(), 'user', false),
  ('fd000001-0001-4000-a000-000000000003', 'EroldKassim', 'erold@seriez.test', now(), now(), 'user', false),
  ('fd000001-0001-4000-a000-000000000004', 'samryan2526', 'samryan@seriez.test', now(), now(), 'user', false),
  ('fd000001-0001-4000-a000-000000000005', 'AizulMansor', 'aizul@seriez.test', now(), now(), 'user', false),
  ('fd000001-0001-4000-a000-000000000006', 'FentyKylie', 'fenty@seriez.test', now(), now(), 'user', false),
  ('fd000001-0001-4000-a000-000000000007', 'jonasmour33', 'jonas@seriez.test', now(), now(), 'user', false),
  ('fd000001-0001-4000-a000-000000000008', 'FaizanMohammad', 'faizan@seriez.test', now(), now(), 'user', false)
ON CONFLICT (id) DO NOTHING;

-- Give them some ratings so stats look real
INSERT INTO media_trackings (username, tmdb_id, media_type, status, rating, updated_at)
VALUES
  ('JailynMorales', 27205, 'movie', 'completed', 4.5, now()),
  ('JailynMorales', 603, 'movie', 'completed', 4.0, now()),
  ('JailynMorales', 550, 'movie', 'completed', 3.5, now()),
  ('JailynMorales', 157336, 'movie', 'completed', 5.0, now()),
  ('sagrl', 27205, 'movie', 'completed', 5.0, now()),
  ('sagrl', 550, 'movie', 'completed', 4.5, now()),
  ('EroldKassim', 603, 'movie', 'completed', 3.0, now()),
  ('EroldKassim', 27205, 'movie', 'completed', 4.0, now()),
  ('samryan2526', 335984, 'movie', 'completed', 4.5, now()),
  ('samryan2526', 438631, 'movie', 'completed', 5.0, now()),
  ('AizulMansor', 550, 'movie', 'completed', 2.0, now()),
  ('AizulMansor', 157336, 'movie', 'completed', 4.5, now()),
  ('FentyKylie', 27205, 'movie', 'completed', 4.0, now()),
  ('FentyKylie', 550, 'movie', 'completed', 2.0, now()),
  ('jonasmour33', 603, 'movie', 'completed', 4.5, now()),
  ('jonasmour33', 335984, 'movie', 'completed', 3.5, now()),
  ('FaizanMohammad', 438631, 'movie', 'completed', 4.0, now()),
  ('FaizanMohammad', 157336, 'movie', 'completed', 2.5, now())
ON CONFLICT DO NOTHING;

-- Make them follow the main user (glitchedmemory) from memory context
-- glitchedmemory follows: JailynMorales, samryan2526, FentyKylie, AizulMansor, jonasmour33
INSERT INTO follows (follower_id, following_id, created_at)
SELECT f.id, t.id, now()
FROM users f, users t
WHERE f.username = 'glitchedmemory'
  AND t.username IN ('JailynMorales', 'samryan2526', 'FentyKylie', 'AizulMansor', 'jonasmour33')
ON CONFLICT DO NOTHING;

-- These 5 follow glitchedmemory back
INSERT INTO follows (follower_id, following_id, created_at)
SELECT f.id, t.id, now()
FROM users f, users t
WHERE f.username IN ('JailynMorales', 'samryan2526', 'FentyKylie', 'AizulMansor', 'jonasmour33')
  AND t.username = 'glitchedmemory'
ON CONFLICT DO NOTHING;
