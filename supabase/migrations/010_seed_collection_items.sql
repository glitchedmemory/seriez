-- Seed 10 items per published collection
-- Run with: supabase db push

-- Animated Magic (alice_wonder)
INSERT INTO list_items (list_id, tmdb_id, media_type)
VALUES
  ('b0146988-894c-46c7-8d71-e1b4ecf2250c', 862, 'movie'),      -- Toy Story
  ('b0146988-894c-46c7-8d71-e1b4ecf2250c', 12, 'movie'),       -- Finding Nemo
  ('b0146988-894c-46c7-8d71-e1b4ecf2250c', 150540, 'movie'),   -- Inside Out
  ('b0146988-894c-46c7-8d71-e1b4ecf2250c', 808, 'movie'),      -- Shrek
  ('b0146988-894c-46c7-8d71-e1b4ecf2250c', 9806, 'movie'),     -- The Incredibles
  ('b0146988-894c-46c7-8d71-e1b4ecf2250c', 354912, 'movie'),   -- Coco
  ('b0146988-894c-46c7-8d71-e1b4ecf2250c', 14160, 'movie'),    -- Up
  ('b0146988-894c-46c7-8d71-e1b4ecf2250c', 129, 'movie'),      -- Spirited Away
  ('b0146988-894c-46c7-8d71-e1b4ecf2250c', 269149, 'movie'),   -- Zootopia
  ('b0146988-894c-46c7-8d71-e1b4ecf2250c', 38757, 'movie')     -- Tangled
ON CONFLICT (list_id, tmdb_id, media_type) DO NOTHING;

-- Horror Nights (charlie_flicks)
INSERT INTO list_items (list_id, tmdb_id, media_type)
VALUES
  ('61f33a2e-916b-4f0e-9f86-f244ae8cfdac', 419430, 'movie'),   -- Get Out
  ('61f33a2e-916b-4f0e-9f86-f244ae8cfdac', 493922, 'movie'),   -- Hereditary
  ('61f33a2e-916b-4f0e-9f86-f244ae8cfdac', 138843, 'movie'),   -- The Conjuring
  ('61f33a2e-916b-4f0e-9f86-f244ae8cfdac', 447332, 'movie'),   -- A Quiet Place
  ('61f33a2e-916b-4f0e-9f86-f244ae8cfdac', 346364, 'movie'),   -- It
  ('61f33a2e-916b-4f0e-9f86-f244ae8cfdac', 242224, 'movie'),   -- The Babadook
  ('61f33a2e-916b-4f0e-9f86-f244ae8cfdac', 530385, 'movie'),   -- Midsommar
  ('61f33a2e-916b-4f0e-9f86-f244ae8cfdac', 1008042, 'movie'),  -- Talk to Me
  ('61f33a2e-916b-4f0e-9f86-f244ae8cfdac', 882598, 'movie'),   -- Smile
  ('61f33a2e-916b-4f0e-9f86-f244ae8cfdac', 310131, 'movie')    -- The Witch
ON CONFLICT (list_id, tmdb_id, media_type) DO NOTHING;

-- Mind-Bending Thrillers (charlie_flicks)
INSERT INTO list_items (list_id, tmdb_id, media_type)
VALUES
  ('8fcfeda6-5005-4d51-86df-e7b4e908c585', 27205, 'movie'),    -- Inception
  ('8fcfeda6-5005-4d51-86df-e7b4e908c585', 157336, 'movie'),   -- Interstellar
  ('8fcfeda6-5005-4d51-86df-e7b4e908c585', 77, 'movie'),       -- Memento
  ('8fcfeda6-5005-4d51-86df-e7b4e908c585', 11324, 'movie'),    -- Shutter Island
  ('8fcfeda6-5005-4d51-86df-e7b4e908c585', 550, 'movie'),      -- Fight Club
  ('8fcfeda6-5005-4d51-86df-e7b4e908c585', 11283, 'movie'),    -- The Prestige
  ('8fcfeda6-5005-4d51-86df-e7b4e908c585', 146233, 'movie'),   -- Prisoners
  ('8fcfeda6-5005-4d51-86df-e7b4e908c585', 807, 'movie'),      -- Se7en
  ('8fcfeda6-5005-4d51-86df-e7b4e908c585', 210577, 'movie'),   -- Gone Girl
  ('8fcfeda6-5005-4d51-86df-e7b4e908c585', 496243, 'movie')    -- Parasite
ON CONFLICT (list_id, tmdb_id, media_type) DO NOTHING;

-- Sci-Fi Essentials (bob_movies)
INSERT INTO list_items (list_id, tmdb_id, media_type)
VALUES
  ('fab38037-6d99-4bb0-a0bd-cb5602e23a89', 335984, 'movie'),   -- Blade Runner 2049
  ('fab38037-6d99-4bb0-a0bd-cb5602e23a89', 329865, 'movie'),   -- Arrival
  ('fab38037-6d99-4bb0-a0bd-cb5602e23a89', 603, 'movie'),      -- The Matrix
  ('fab38037-6d99-4bb0-a0bd-cb5602e23a89', 438631, 'movie'),   -- Dune
  ('fab38037-6d99-4bb0-a0bd-cb5602e23a89', 264660, 'movie'),   -- Ex Machina
  ('fab38037-6d99-4bb0-a0bd-cb5602e23a89', 152601, 'movie'),   -- Her
  ('fab38037-6d99-4bb0-a0bd-cb5602e23a89', 49047, 'movie'),    -- Gravity
  ('fab38037-6d99-4bb0-a0bd-cb5602e23a89', 545611, 'movie'),   -- Everything Everywhere All at Once
  ('fab38037-6d99-4bb0-a0bd-cb5602e23a89', 286217, 'movie'),   -- The Martian
  ('fab38037-6d99-4bb0-a0bd-cb5602e23a89', 62, 'movie')        -- 2001: A Space Odyssey
ON CONFLICT (list_id, tmdb_id, media_type) DO NOTHING;

-- Best of 2026 So Far (diana_reels)
INSERT INTO list_items (list_id, tmdb_id, media_type)
VALUES
  ('f5d10382-4723-461b-94b1-a325a65d8180', 693134, 'movie'),   -- Dune: Part Two (2024)
  ('f5d10382-4723-461b-94b1-a325a65d8180', 792307, 'movie'),   -- Poor Things
  ('f5d10382-4723-461b-94b1-a325a65d8180', 840705, 'movie'),   -- The Substance
  ('f5d10382-4723-461b-94b1-a325a65d8180', 974576, 'movie'),   -- Conclave
  ('f5d10382-4723-461b-94b1-a325a65d8180', 1064213, 'movie'),  -- Anora
  ('f5d10382-4723-461b-94b1-a325a65d8180', 845781, 'movie'),   -- Wicked
  ('f5d10382-4723-461b-94b1-a325a65d8180', 533535, 'movie'),   -- Deadpool & Wolverine
  ('f5d10382-4723-461b-94b1-a325a65d8180', 917496, 'movie'),   -- Alien: Romulus
  ('f5d10382-4723-461b-94b1-a325a65d8180', 558449, 'movie'),   -- Gladiator II
  ('f5d10382-4723-461b-94b1-a325a65d8180', 872585, 'movie')    -- Oppenheimer
ON CONFLICT (list_id, tmdb_id, media_type) DO NOTHING;

-- Cozy Sunday Films (alice_wonder)
INSERT INTO list_items (list_id, tmdb_id, media_type)
VALUES
  ('ac4eed5d-1d97-4931-b6ce-c3030cc00686', 120467, 'movie'),   -- The Grand Budapest Hotel
  ('ac4eed5d-1d97-4931-b6ce-c3030cc00686', 331482, 'movie'),   -- Little Women
  ('ac4eed5d-1d97-4931-b6ce-c3030cc00686', 194, 'movie'),      -- Amélie
  ('ac4eed5d-1d97-4931-b6ce-c3030cc00686', 116745, 'movie'),   -- The Secret Life of Walter Mitty
  ('ac4eed5d-1d97-4931-b6ce-c3030cc00686', 39451, 'movie'),    -- Paddington 2
  ('ac4eed5d-1d97-4931-b6ce-c3030cc00686', 212778, 'movie'),   -- Chef
  ('ac4eed5d-1d97-4931-b6ce-c3030cc00686', 228066, 'movie'),   -- The Hundred-Foot Journey
  ('ac4eed5d-1d97-4931-b6ce-c3030cc00686', 122906, 'movie'),   -- About Time
  ('ac4eed5d-1d97-4931-b6ce-c3030cc00686', 82693, 'movie'),    -- Silver Linings Playbook
  ('ac4eed5d-1d97-4931-b6ce-c3030cc00686', 24803, 'movie')     -- Julie & Julia
ON CONFLICT (list_id, tmdb_id, media_type) DO NOTHING;
