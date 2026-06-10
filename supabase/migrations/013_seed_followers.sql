-- Seed followers: 8 virtual users
-- Note: media_trackings need special handling, ratings seeded via API

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

-- Make them follow glitchedmemory
INSERT INTO follows (follower_id, following_id, created_at)
SELECT f.id, t.id, now()
FROM users f, users t
WHERE f.username IN ('JailynMorales', 'samryan2526', 'FentyKylie', 'AizulMansor', 'jonasmour33')
  AND t.username = 'glitchedmemory'
ON CONFLICT DO NOTHING;

-- glitchedmemory follows some of them back
INSERT INTO follows (follower_id, following_id, created_at)
SELECT f.id, t.id, now()
FROM users f, users t
WHERE f.username = 'glitchedmemory'
  AND t.username IN ('JailynMorales', 'samryan2526', 'FentyKylie')
ON CONFLICT DO NOTHING;
