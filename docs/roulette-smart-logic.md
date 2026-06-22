# Roulette Smart Logic — 기획서 v2

**날짜:** 2026-06-22
**대상:** `/api/roulette` + `RouletteCard.tsx`
**상태:** Draft (구현 전)
**변경사항:** v1 "최근 3개 watched" → v2 "최근 3일 watched"

---

## 1. 요약

현재 룰렛은 완전 랜덤으로 작동한다. 사용자의 시청 기록(Watched)을 기반으로 **제외**, **장르 매칭**, **연도 매칭** 세 가지 로직을 추가하여 개인화된 추천을 제공한다.

v2 핵심 변경: 단순히 "최근 3개"가 아닌 **"최근 3일 동안 Watched 처리한 모든 작품"**을 기준으로 장르/연도를 분석한다. 3일은 연속일 필요 없으며, 그 기간 내에 시청 완료한 작품이면 모두 포함된다.

---

## 2. 현재 상태 분석

### 2.1 현재 룰렛 로직 (`app/api/roulette/route.ts`)

```
SPIN → 랜덤 타입(movie/tv/anime) 선택
     → 현재 반기(H1/H2)의 반대 시기에서 TMDB/AniList 인기작 Top 20 조회
     → 그 중 랜덤 1개 선택
     → 상세 정보 + 감독 정보 반환
```

**문제점:** 사용자가 이미 본 작품이 나올 수 있고, 취향과 무관한 작품이 추천된다.

### 2.2 관련 데이터 구조

**MediaTracking (`media_trackings`)**
| 필드 | 설명 |
|------|------|
| `username` | 사용자명 |
| `tmdb_id` | TMDB ID (Int) |
| `anilist_id` | AniList ID (Int, nullable) |
| `media_type` | movie / tv / anime |
| `status` | watching / completed / plan_to_watch / on_hold / dropped |
| `season_number` | 0=movie, 1+=TV/anime 시즌 |
| `updated_at` | 마지막 수정 시각 |

- **"Watched" = `status = 'completed'`**
- 사용자당 고유 제약: `[username, tmdb_id, media_type, season_number]`

### 2.3 ⚠️ `watched_at` 컬럼 이슈

- 마이그레이션 `002_user_stats.sql`에서 `watched_at TIMESTAMPTZ` 컬럼을 추가하고 `status='completed'`인 기존 레코드의 `watched_at`을 `updated_at`으로 채움
- **그러나 Prisma 스키마에는 `watched_at`이 반영되어 있지 않음** — Prisma Client로 접근 불가
- 해결책: Supabase raw SQL로 `watched_at` 조회 (`prisma.$queryRaw` 또는 Supabase client 직접 사용)

---

## 3. 목표

| # | 기능 | 설명 |
|---|------|------|
| 1 | **Watched 제외** | 사용자가 `completed` 처리한 작품은 절대 추천하지 않음 |
| 2 | **장르 매칭** | 최근 3일 동안 Watched한 모든 작품에서 가장 많이 등장한 Top 2 장르와 일치하는 작품 우선 추천 |
| 3 | **연도 매칭** | 최근 3일 Watched 작품들의 연도 범위(±2년) 내 작품 우선 추천 |

**"최근 3일"의 의미:** 오늘 기준 지난 3일(72시간) 동안 `status='completed'`로 변경된 모든 작품. 날짜가 연속적이지 않아도 무방하며, 예를 들어 1일 전 2작품 + 3일 전 1작품 = 총 3작품이 분석 대상이 됨.

---

## 4. 데이터 흐름

```
SPIN 요청 (사용자 username 포함)
  │
  ├── [Step 1] Supabase raw SQL: 최근 3일 completed 레코드 전부 조회
  │     SELECT tmdb_id, anilist_id, media_type FROM media_trackings
  │     WHERE username = ? AND status = 'completed'
  │       AND watched_at >= NOW() - INTERVAL '3 days'
  │     ORDER BY watched_at DESC
  │
  ├── [Step 2] Watched ID 목록 수집 (제외용 — 전체 기간)
  │     SELECT tmdb_id, anilist_id FROM media_trackings
  │     WHERE username = ? AND status = 'completed'
  │
  ├── [Step 3] 장르 분석 (최근 3일 Watched 기준)
  │     Step 1 결과의 각 작품 장르를 TMDB/AniList에서 조회 → 빈도수 집계 → Top 2 추출
  │
  ├── [Step 4] 연도 분석 (최근 3일 Watched 기준)
  │     Step 1 결과의 각 작품 release_year 수집 → min~max 범위 계산 → ±2년 확장
  │
  ├── [Step 5] TMDB/AniList 검색 (우선순위 fallback)
  │     Tier 1: 장르 매칭 + 연도 매칭 + watched 제외
  │     Tier 2: 장르 매칭만 + watched 제외
  │     Tier 3: 연도 매칭만 + watched 제외
  │     Tier 4: watched 제외만 (현재 로직 + 제외)
  │
  └── [Step 6] 랜덤 선택 → 상세 정보 → 응답
```

---

## 5. 단계별 구현 계획

### Phase 0 — Prisma 스키마에 `watched_at` 추가

```prisma
model MediaTracking {
  // ... 기존 필드
  watchedAt    DateTime? @map("watched_at")  // ← 추가
}
```

- `prisma db pull`로 기존 컬럼 동기화 (마이그레이션 생성 불필요 — 컬럼은 이미 존재)
- 또는 raw SQL로 직접 조회 (스키마 변경 없이)

**권장:** raw SQL 사용 (스키마 변경 없이 즉시 구현 가능). Prisma Client로는 `$queryRaw` 사용.

### Phase 1 — Supabase 쿼리 함수 (`lib/roulette-user.ts` 신규)

```typescript
// 1. 최근 N일 내 completed 레코드 전부 조회 (raw SQL)
getWatchedInLastDays(username: string, days: number = 3): Promise<RecentWatched[]>

// 2. 모든 completed ID 수집 (제외 목록)
getAllWatchedIds(username: string): Promise<{ tmdbIds: number[], anilistIds: number[] }>
```

### Phase 2 — 장르/연도 분석 함수

```typescript
// 3. watched 작품들의 장르 빈도 분석 → Top 2
analyzeTopGenres(recentWatched: RecentWatched[]): Promise<string[]>

// 4. watched 작품들의 연도 범위 추출 → ±2년
analyzeYearRange(recentWatched: RecentWatched[]): { minYear: number, maxYear: number } | null
```

**장르 조회 방법:**
- movie/tv: TMDB `/movie/{id}` 또는 `/tv/{id}` 에서 `genres[].name` 추출
- anime: AniList query에서 `genres` 필드 사용

**연도 조회 방법:**
- movie: `release_date` 앞 4자리
- tv: `first_air_date` 앞 4자리
- anime: `startDate.year`

### Phase 3 — TMDB/AniList 필터 검색

```typescript
// 5. 장르 + 연도 + 제외 필터로 TMDB 검색
searchTMDB(params: {
  mediaType: 'movie' | 'tv',
  genreIds?: number[],      // TMDB genre ID로 변환 필요
  yearGte?: number,
  yearLte?: number,
  excludeIds: number[],
  periodStart: string,      // 기존 H1/H2 로직
  periodEnd: string,
}): Promise<TMDBResult[]>

// 6. 장르 + 연도 + 제외 필터로 AniList 검색
searchAniList(params: {
  genres?: string[],
  yearGte?: number,
  yearLte?: number,
  excludeIds: number[],
  season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL',
  searchYear: number,
}): Promise<AniListResult[]>
```

**TMDB 장르 ID 매핑 (고정):**
TMDB는 장르명이 아닌 숫자 ID를 사용하므로 매핑 테이블 필요:
```
Action: 28, Comedy: 35, Drama: 18, Horror: 27, Sci-Fi: 878, ...
```

### Phase 4 — 우선순위 Fallback (API route 통합)

```
Tier 1: with_genres=TOP2_GENRE_IDS & date_range=YEAR±2 & exclude watched
  → 결과 5개 이상이면 pool로 사용
  
Tier 2: with_genres=TOP2_GENRE_IDS & exclude watched
  → 결과 5개 이상이면 pool로 사용
  
Tier 3: date_range=YEAR±2 & exclude watched
  → 결과 5개 이상이면 pool로 사용
  
Tier 4: exclude watched only (기존 로직 그대로)
  → 최후의 fallback
```

**pool 크기:** 최소 5개 이상일 때만 해당 tier 사용. 5개 미만이면 다음 tier로 fallback.

### Phase 5 — 응답에 추천 이유 추가

```typescript
// 응답에 추가되는 필드
{
  // ... 기존 필드
  reason: string  // "You've been into Action & Sci-Fi lately" | "From your era" | "Just something different"
}
```

### Phase 6 — 프론트엔드 (RouletteCard.tsx)

- `reason` 필드를 결과 카드 하단에 작게 표시
- "왜 이 작품이 추천됐는지" 한 줄로 노출
- 기존 UI/UX 변경 최소화

---

## 6. API 변경사항

### 요청
```
GET /api/roulette
```
→ 기존과 동일 (서버 세션에서 username 추출)

### 응답 (신규 필드)
```json
{
  "id": 123,
  "mediaType": "movie",
  "title": "...",
  "...": "...",
  "reason": "You've been into Action & Sci-Fi lately",
  "tier": 1
}
```

---

## 7. 우선순위 Fallback (상세)

| Tier | 장르 | 연도 | Watched 제외 | 최소 결과 |
|------|------|------|-------------|-----------|
| 1 | ✅ | ✅ | ✅ | 5개 |
| 2 | ✅ | ❌ | ✅ | 5개 |
| 3 | ❌ | ✅ | ✅ | 5개 |
| 4 | ❌ | ❌ | ✅ | 1개 (기존 로직) |

**최근 3일 Watched 0건:** Tier 4로 바로 진입 (장르/연도 분석 불가)

---

## 8. 엣지 케이스

| 상황 | 처리 |
|------|------|
| 최근 3일 Watched 0건 | Tier 4만 실행 |
| 최근 3일 Watched 1건 | 해당 1건의 장르 1위만 사용, 연도 ±2년 |
| 최근 3일 Watched 2건 이상 | 정상 분석 (장르 Top 2, 연도 min~max) |
| 장르 매칭 결과 0건 | 다음 tier로 fallback |
| 연도 범위 ±2년 결과 0건 | 다음 tier로 fallback |
| 모든 tier 실패 | "No recommendations found" 메시지 |
| 애니메 전용 watched | AniList 장르만 분석 |
| 영화+TV+애니메 섞인 watched | TMDB 장르 + AniList 장르 통합 분석 |
| 3일 내 같은 장르만 여러 번 | 해당 장르가 압도적 1위 → 정확한 추천 |

---

## 9. 테스트 계획

### 단위 테스트
- [ ] `getWatchedInLastDays()`: 최근 3일 watched_at 기준 조회 확인
- [ ] `getAllWatchedIds()`: 모든 completed ID 반환 확인
- [ ] `analyzeTopGenres()`: 장르 빈도 Top 2 추출
- [ ] `analyzeYearRange()`: 연도 범위 ±2년 계산
- [ ] TMDB 장르명→ID 매핑 정확성
- [ ] Fallback: 각 tier 전환 조건 확인

### 통합 테스트
- [ ] 최근 3일 Watched 3건 있는 사용자 → Tier 1 결과 확인
- [ ] 최근 3일 Watched 0건 사용자 → Tier 4 확인
- [ ] Watched 작품이 결과에서 제외되는지 확인
- [ ] 애니메 watched만 있는 사용자 → AniList 경로 확인
- [ ] 3일 내 1건만 watched → 1건 기준 분석 확인

---

## 10. 영향도 / 위험

| 위험 | 수준 | 대응 |
|------|------|------|
| TMDB API 호출 증가 (장르 조회 N회) | 중 | 최근 3일 Watched 건수만큼만 호출 (보통 1~10건) |
| 응답 속도 저하 | 중 | 장르/연도 분석 병렬 처리, 타임아웃 5초 |
| `watched_at` Prisma 미노출 | 중 | raw SQL로 우회 (`$queryRaw` 또는 supabase client) |
| Supabase 쿼리 부하 | 낮음 | completed 레코드는 인덱스 있음 |
| 장르명 매핑 불일치 (AniList vs TMDB) | 중 | 공통 장르명 정규화 맵 사용 |

---

## 11. 예상 소요 시간

| Phase | 내용 | 예상 |
|-------|------|------|
| Phase 0 | `watched_at` 확인 및 raw SQL 설정 | 10분 |
| Phase 1 | Supabase 쿼리 함수 | 20분 |
| Phase 2 | 장르/연도 분석 | 30분 |
| Phase 3 | TMDB/AniList 필터 검색 | 30분 |
| Phase 4 | API route 통합 + Fallback | 40분 |
| Phase 5 | 응답 reason 추가 | 10분 |
| Phase 6 | 프론트엔드 | 15분 |
| **계** | | **~2.5시간** |

---

## 12. 참고: TMDB 장르 ID 매핑

```typescript
const TMDB_GENRE_MAP: Record<string, number> = {
  "Action": 28, "Adventure": 12, "Animation": 16, "Comedy": 35,
  "Crime": 80, "Documentary": 99, "Drama": 18, "Family": 10751,
  "Fantasy": 14, "History": 36, "Horror": 27, "Music": 10402,
  "Mystery": 9648, "Romance": 10749, "Science Fiction": 878,
  "TV Movie": 10770, "Thriller": 53, "War": 10752, "Western": 37,
};

// AniList → TMDB 정규화 맵 (자주 겹치는 장르)
const ANILIST_TO_TMDB_GENRE: Record<string, string> = {
  "Action": "Action", "Adventure": "Adventure", "Comedy": "Comedy",
  "Drama": "Drama", "Fantasy": "Fantasy", "Horror": "Horror",
  "Mystery": "Mystery", "Romance": "Romance",
  "Sci-Fi": "Science Fiction", "Thriller": "Thriller",
  "Slice of Life": "Drama", "Supernatural": "Fantasy",
  "Psychological": "Thriller", "Mecha": "Action",
};
```
