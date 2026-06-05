# Media Tracker — 통합 기획서
2026-06-04

## 제품 개요

- **이름**: 미정 (추후 확정)
- **타겟**: 글로벌 (영어 1차, 추후 다국어)
- **플랫폼**: PWA (웹 + 모바일 동시 지원)
- **카테고리**: 영화 + TV쇼 + 애니 통합 트래킹 & 추천

## MVP 기능 (v1.0)

### 핵심 — 시청 트래킹
- **시청 상태**: Watching / Completed / On Hold / Dropped / Plan to Watch
- **별점**: 5점 만점 (0.5점 단위, 반 개 별 가능) — Letterboxd 방식
- **리뷰**: 짧은 리뷰 (좋아요 가능), 스포일러 태그
- **리스트**: Watchlist / Favorites / 커스텀 리스트

### 핵심 — 추천
- **장르 기반**: "이 장르에서 평점 높은 작품"
- **감독·배우 기반**: "같은 감독의 다른 작품"
- **유사 작품**: TMDB Similar API 활용
- **인기 급상승**: 트렌딩 섹션

### 핵심 — 검색
- 통합 검색 (영화 / TV / 애니 동시 검색)
- 카테고리 필터
- 장르·연도·평점 필터

### 소셜 (MVP 범위)
- 친구 팔로우
- 활동 피드 (친구가 본 것, 평점, 리뷰)
- 프로필 페이지 (통계 포함)

---

## UI 설계

### 디자인 시스템
- **컬러 팔레트**:
  - 배경: 다크 (#0f0f1a) — Letterboxd/AniList 스타일
  - 카드: #1a1a2e
  - 액센트: 그라데이션 (#6366f1 → #a855f7, 인디고-퍼플)
  - 강조: #f59e0b (별점 골드)
  - 텍스트: #ffffff (주), #9ca3af (부)
- **타이포그래피**: Inter (본문), system-ui (Fallback)
- **둥근 모서리**: 카드 12px, 버튼 8px

### 네비게이션 구조
```
하단 탭바 (모바일) / 상단 네비 (데스크탑)
[Home] [Search] [Library] [Profile]
```

### 페이지별 레이아웃

#### 1. Home (홈)
```
┌─────────────────────────────────┐
│  🔍 Search...         [프로필] │  상단바
├─────────────────────────────────┤
│  📊 Trending This Week          │  가로 스크롤 카드
│  [포스터] [포스터] [포스터]    │  포스터 + 제목 + 평점
├─────────────────────────────────┤
│  🎯 Recommended For You         │  세로 스크롤
│  [포스터] [포스터]             │
│  [포스터] [포스터]             │
├─────────────────────────────────┤
│  👥 Friends' Activity           │
│  X님 rated ★★★★½ Inception     │
│  Y님 added to Watchlist: Dune 3│
└─────────────────────────────────┘
```

#### 2. Search (검색)
```
┌─────────────────────────────────┐
│  [🔍 Search movies, TV, anime] │
├─────────────────────────────────┤
│  Filters: [All] [Movie] [TV] [Anime] │
├─────────────────────────────────┤
│  Results                        │
│  ┌──────┐ ┌──────┐ ┌──────┐   │
│  │포스터│ │포스터│ │포스터│   │
│  │제목  │ │제목  │ │제목  │   │
│  │★★★★ │ │★★★   │ │★★★★★│   │
│  └──────┘ └──────┘ └──────┘   │
└─────────────────────────────────┘
```

#### 3. Media Detail (작품 상세)
```
┌─────────────────────────────────┐
│ [뒤로]                    [공유]│
├─────────────────────────────────┤
│  ┌─────────────────┐           │
│  │                 │ Interstellar │
│  │    포스터       │ 2014 • Sci-Fi • 2h 49m │
│  │                 │ ⭐ 4.7/5 (12K ratings) │
│  └─────────────────┘           │
│  [★ Rate] [📋 Add to List] [Watching] │
├─────────────────────────────────┤
│  Overview                      │
│  When Earth becomes           │
│  uninhabitable, a group...    │
│  [Read more]                  │
├─────────────────────────────────┤
│  Cast & Crew                   │
│  [매튜] [앤] [제시카]         │ 가로 스크롤
├─────────────────────────────────┤
│  Similar Titles                │
│  [포스터] [포스터] [포스터]   │
├─────────────────────────────────┤
│  Reviews (12)                  │
│  ⭐⭐⭐⭐⭐ user123              │
│  "A masterpiece that..."      │
│  ❤ 234  💬 12                 │
└─────────────────────────────────┘
```

#### 4. Library (내 서재)
```
┌─────────────────────────────────┐
│  My Library                     │
│  [Watching] [Completed] [PTW] [Dropped] │ 탭
├─────────────────────────────────┤
│  Watching (3)                   │
│  ┌──────┐ ┌──────┐ ┌──────┐   │
│  │포스터│ │포스터│ │포스터│   │ 포스터 그리드
│  │ Ep 5 │ │ 45%  │ │ Ep 12│   │ 진행도 표시
│  └──────┘ └──────┘ └──────┘   │
├─────────────────────────────────┤
│  Completed (47)                 │
│  ┌──────┐ ┌──────┐ ┌──────┐   │
│  │★★★★│ │★★★   │ │★★★★★│   │ 별점 오버레이
│  └──────┘ └──────┘ └──────┘   │
└─────────────────────────────────┘
```

#### 5. Profile (프로필)
```
┌─────────────────────────────────┐
│  [아바타]                       │
│  Username                       │
│  47 films • 12 reviews • 3 lists│
│  [Edit Profile]                 │
├─────────────────────────────────┤
│  📊 Stats                       │
│  Most Watched: Sci-Fi (34%)     │
│  Avg Rating: 3.8/5              │
│  This Year: 12 films            │
├─────────────────────────────────┤
│  🎬 Genre Breakdown             │
│  ████████░░ Sci-Fi   34%       │ 막대 바
│  ██████░░░░ Drama    22%       │
│  ████░░░░░░ Action   15%       │
├─────────────────────────────────┤
│  Recent Activity                │
│  Rated Dune: Part Two ★★★★½    │
│  Completed Severance S2        │
│  Added to PTW: Oppenheimer     │
└─────────────────────────────────┘
```

### 핵심 인터랙션

**별점**: 포스터 호버/탭 → 별 5개 펼쳐짐 → 터치 드래그로 0.5~5.0 선택

**시청 상태 변경**: 상세 페이지에서 드롭다운: Watching / Completed / On Hold / Dropped / PTW

**리뷰 작성**: 별점 선택 → 텍스트 입력 → 스포일러 체크박스 → Post

---

## 기술 스택

| 계층 | 선택 | 이유 |
|------|------|------|
| 프레임워크 | Next.js 16 (App Router) | PWA 지원, SSR, Vercel 배포 |
| DB | Supabase (PostgreSQL) | 무료 티어, Realtime, Auth 내장 |
| 인증 | Supabase Auth | 소셜 로그인 (Google, GitHub) |
| ORM | Prisma | 타입 안전, 마이그레이션 |
| 스타일링 | Tailwind CSS | 빠른 프로토타이핑 |
| API 연동 | TMDB API + AniList GraphQL | 영화/TV + 애니 DB |
| PWA | next-pwa | 오프라인, 설치 가능 |
| 배포 | Vercel (무료 티어) | Next.js 최적화 |
| 이미지 | TMDB 이미지 CDN | 포스터, 배경 |

**월 운영비**: $0 (Vercel 무료 + Supabase 무료 + TMDB 무료)

---

## API 연동 설계

### TMDB API (영화 + TV)
- `/movie/popular` — 인기 영화
- `/tv/popular` — 인기 TV쇼
- `/search/multi` — 통합 검색
- `/movie/{id}/similar` — 유사 영화
- `/movie/{id}/credits` — 출연진·제작진
- `/genre/movie/list` — 장르 목록
- `/trending/all/week` — 주간 트렌딩

### AniList GraphQL API (애니)
- `query Page { media(type: ANIME, sort: POPULARITY_DESC) }` — 인기 애니
- `query Media { Media(id: X) { title, genres, averageScore } }` — 상세 정보
- `query Page { media(search: "query") }` — 검색

---

## DB 스키마 (초안)

```
users
  id, username, email, avatar_url, created_at

media_trackings
  id, user_id, tmdb_id, anilist_id (nullable), 
  media_type (movie/tv/anime), status (watching/completed/etc),
  rating (0-5 float), progress, updated_at

reviews
  id, user_id, media_id, content, has_spoiler, 
  likes_count, created_at

lists
  id, user_id, name, is_public, created_at

list_items
  id, list_id, media_id, added_at

follows
  follower_id, following_id, created_at
```

---

## MVP 개발 단계

### Phase 1: 기초 (Week 1-2)
- Next.js 프로젝트 세팅 + Tailwind + PWA
- Supabase 연동 + Prisma 스키마
- TMDB / AniList API 연동 모듈

### Phase 2: 트래킹 (Week 3-4)
- 검색 + 작품 상세 페이지
- 시청 상태 저장/변경
- 별점 시스템

### Phase 3: 소셜 + 추천 (Week 5-6)
- 리뷰 작성/보기
- 프로필 + 통계
- 추천 알고리즘 (장르·감독 기반)
- 팔로우 + 피드

### Phase 4: 마무리 (Week 7)
- PWA 오프라인 모드
- UI 폴리싱
- 배포

---

## 다음 단계

다음은 **서비스명 확정** → 질문 없이 바로 UI 프로토타입(첫 페이지) 제작으로 넘어갈지, 먼저 X님께 전체 기획서 검토를 받을지 결정하시면 됩니다.
