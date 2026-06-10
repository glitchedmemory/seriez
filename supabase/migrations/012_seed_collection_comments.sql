-- Seed 20 comments + replies across collections
-- Animated Magic — 6 comments
INSERT INTO collection_comments (collection_id, username, content, created_at) VALUES
  ('b0146988-894c-46c7-8d71-e1b4ecf2250c', 'alice_wonder', '이 컬렉션 정말 알차네요! 애니메이션 명작만 모았네요 ✨', now() - interval '3 hours'),
  ('b0146988-894c-46c7-8d71-e1b4ecf2250c', 'bob_movies', '토이스토리랑 코코가 같이 있다니 최고의 조합이에요', now() - interval '2 hours'),
  ('b0146988-894c-46c7-8d71-e1b4ecf2250c', 'charlie_flicks', '센과 치히로의 행방불명도 넣어주세요!', now() - interval '1 hour'),
  ('b0146988-894c-46c7-8d71-e1b4ecf2250c', 'diana_reels', '업이 없으면 섭섭했을 거예요 ㅎㅎ 벌써 들어있네요', now() - interval '45 minutes'),
  ('b0146988-894c-46c7-8d71-e1b4ecf2250c', 'elliott_frames', '주토피아도 추가하면 완벽할 것 같아요', now() - interval '30 minutes'),
  ('b0146988-894c-46c7-8d71-e1b4ecf2250c', 'alice_wonder', '모두 의견 감사합니다! 주토피아는 이미 들어있어요 😉', now() - interval '15 minutes');

-- Horror Nights — 4 comments
INSERT INTO collection_comments (collection_id, username, content, created_at) VALUES
  ('61f33a2e-916b-4f0e-9f86-f244ae8cfdac', 'charlie_flicks', '공포 영화 마니아를 위한 필수 컬렉션입니다 👻', now() - interval '5 hours'),
  ('61f33a2e-916b-4f0e-9f86-f244ae8cfdac', 'bob_movies', 'Get Out이랑 Hereditary 둘 다 명작이죠', now() - interval '4 hours'),
  ('61f33a2e-916b-4f0e-9f86-f244ae8cfdac', 'diana_reels', 'Talk to Me 진짜 소름돋았어요... 아직도 생각나요', now() - interval '3 hours'),
  ('61f33a2e-916b-4f0e-9f86-f244ae8cfdac', 'charlie_flicks', 'Midsommar는 공포의 새로운 지평을 열었죠 대낮에 무서운 영화라니!', now() - interval '2 hours');

-- Sci-Fi Essentials — 4 comments
INSERT INTO collection_comments (collection_id, username, content, created_at) VALUES
  ('fab38037-6d99-4bb0-a0bd-cb5602e23a89', 'bob_movies', 'SF 팬이라면 이 정도는 기본 소장해야죠 🚀', now() - interval '6 hours'),
  ('fab38037-6d99-4bb0-a0bd-cb5602e23a89', 'alice_wonder', '블레이드 러너 2049 영상미가 정말 예술이었어요', now() - interval '5 hours'),
  ('fab38037-6d99-4bb0-a0bd-cb5602e23a89', 'elliott_frames', '인터스텔라랑 마션은 우주 SF의 양대산맥', now() - interval '4 hours'),
  ('fab38037-6d99-4bb0-a0bd-cb5602e23a89', 'bob_movies', 'Her도 SF의 감성적인 면을 보여준 수작이에요', now() - interval '3 hours');

-- Cozy Sunday Films — 3 comments
INSERT INTO collection_comments (collection_id, username, content, created_at) VALUES
  ('ac4eed5d-1d97-4931-b6ce-c3030cc00686', 'alice_wonder', '일요일 오후에 딱 맞는 영화들이에요 ☕', now() - interval '4 hours'),
  ('ac4eed5d-1d97-4931-b6ce-c3030cc00686', 'diana_reels', '어바웃 타임은 볼 때마다 눈물나요 ㅠㅠ', now() - interval '3 hours'),
  ('ac4eed5d-1d97-4931-b6ce-c3030cc00686', 'charlie_flicks', '그랜드 부다페스트 호텔 색감 미쳤죠', now() - interval '2 hours');

-- Best of 2026 So Far — 3 comments
INSERT INTO collection_comments (collection_id, username, content, created_at) VALUES
  ('f5d10382-4723-461b-94b1-a325a65d8180', 'diana_reels', '2026년 상반기 베스트 정리했습니다 🏆', now() - interval '3 hours'),
  ('f5d10382-4723-461b-94b1-a325a65d8180', 'bob_movies', '듄 파트2는 진짜 레전드였어요', now() - interval '2 hours'),
  ('f5d10382-4723-461b-94b1-a325a65d8180', 'elliott_frames', 'Anora도 넣어주세요! 칸 황금종려상 수상작인데', now() - interval '1 hour');
