# Seriez 애니메 처리 규칙 — 최종 기획서

**최종 수정:** 2026-06-22
**원칙 선언자:** X님
**목적:** 애니메 관련 모든 데이터는 TMDB가 아닌 AniList/Kitsu/Jikan에서 가져온다. 이 문서는 "지킬 수 있는" 강제 규칙이다.

---

## 0. 핵심 원칙 — TMDB × Anime = 절대 금지

| 미디어 타입 | 데이터 소스 | 비고 |
|-------------|------------|------|
| `movie` | TMDB | 영화 |
| `tv` | TMDB | TV쇼 (실사/서양 애니메이션 포함. 단, 일본 애니메는 제외) |
| `anime` | **AniList** (주), Kitsu, Jikan, AniDB (보조) | 일본 애니메이션. 절대 TMDB 호출 금지 |

**절대 규칙:**
- `media_type === "anime"`인 모든 항목에 대해 TMDB API를 호출하지 않는다.
- 애니메 포스터/썸네일/메타데이터/에피소드 등 모든 데이터는 반드시 AniList 계열 API에서 가져온다.
- `"anime"`를 `"tv"`로 변환해서 TMDB에 우회 호출하는 행위도 금지.

---

## 1. 기존 코드 중 위반 지점 (→ 수정 필요)

### 1.1 `/api/collections/published/route.ts` — `getThumbnails()`

```ts
// 현재 (위반): 무조건 TMDB 호출
const res = await fetch(`${TMDB_API}/${item.media_type}/${item.tmdb_id}?...`);
// item.media_type이 "anime"이면 /anime/... → 404 → null
```

**수정 방향:** `media_type === "anime"`이면 AniList `coverImage.extraLarge`로 썸네일을 가져온다. `tmdb_id`가 AniList ID로 저장되어 있으므로 AniList GraphQL `Media(id:$id)`로 조회.

### 1.2 `/api/collections/[id]/items/route.ts` — 컬렉션 아이템 상세

```ts
// 현재 (위반): line 41 — 무조건 TMDB
const res = await fetch(`${TMDB_API}/${item.media_type}/${item.tmdb_id}?...`);
```

**수정 방향:** `media_type === "anime"` 분기 → AniList GraphQL 호출.

### 1.3 `/api/roulette/route.ts` — 룰렛

```ts
// 현재 (위반): line 88
const tmdbType = mediaType === "anime" ? "tv" : mediaType;
```

**수정 방향:** `anime` 타입이 뽑혔을 때 TMDB trending이 아닌 AniList `TRENDING_DESC`로 대체.

### 1.4 컴포넌트 `PublishedCollections.tsx`

```tsx
// 현재: PosterImage가 TMDB URL만 렌더링하도록 되어 있음
// AniList URL (https://s4.anilist.co/file/anilistcdn/...)도 정상 동작하는지 확인 필요
```

**수정 방향:** `PosterImage` 컴포넌트가 AniList CDN URL을 지원하는지 확인. 이미 `next.config`에 `s4.anilist.co`가 images 도메인으로 등록되어 있는지 확인.

---

## 2. 올바른 구현 패턴 — 이렇게 해야 한다

### 2.1 썸네일/포스터 가져오기

```ts
// lib/anilist.ts 에 추가할 함수
export async function getAnimePosters(anilistIds: number[]): Promise<Map<number, string | null>> {
  const query = `
    query($ids: [Int!]) {
      Page(perPage: 50) {
        media(id_in: $ids, type: ANIME) {
          id
          coverImage { extraLarge }
        }
      }
    }`;
  // ... fetch & return Map<anilistId, posterUrl>
}
```

### 2.2 컬렉션 아이템 enrichment (메타데이터)

```ts
// anime 타입일 때
if (item.media_type === "anime") {
  const gql = `query($id:Int){Media(id:$id){title{romaji english}coverImage{extraLarge}startDate{year}}}`;
  const res = await fetch(ANILIST_API, { method:"POST", body: JSON.stringify({query:gql, variables:{id:item.tmdb_id}}) });
  const m = (await res.json()).data.Media;
  return {
    title: m.title.english || m.title.romaji,
    poster: m.coverImage?.extraLarge || null,
    year: m.startDate?.year || null,
  };
}
```

### 2.3 trending/발견

이미 올바르게 구현된 예시:
- `/api/anime-trending` — AniList `TRENDING_DESC` ✓
- `/api/discover-by-year` — AniList 분기 있음 ✓
- `/api/tmdb/year-posters` — AniList 분기 있음 ✓

---

## 3. 새 기능 개발 시 체크리스트

애니메 관련 기능을 추가할 때 반드시 확인할 질문:

1. [ ] `media_type === "anime"` 분기가 있는가?
2. [ ] TMDB API를 호출하지 않는가? (`/anime/` 엔드포인트 없음)
3. [ ] `"anime"`를 `"tv"`로 변환하지 않는가?
4. [ ] AniList GraphQL로 데이터를 가져오는가?
5. [ ] 포스터 URL이 `s4.anilist.co` 도메인인가? (Next.js images 설정 확인)
6. [ ] fallback: Kitsu/Jikan도 고려했는가?

---

## 4. AniList API 참고

| 용도 | 엔드포인트 | 
|------|-----------|
| 기본 GraphQL | `https://graphql.anilist.co` |
| 검색/상세/트렌딩/추천 | GraphQL `Media` 쿼리 |
| 에피소드 | Kitsu `/api/edge/anime/:id/episodes` 또는 Jikan `/v4/anime/:id/episodes` |
| 포스터 CDN | `https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/...` |

**AniList Rate Limit:** 분당 약 90 요청. 대량 호출 시 배치(`id_in`) 사용.

---

## 5. 파일별 책임 구분 (현재 상태 + 수정 필요 표시)

| 파일 | 현재 상태 | 수정 필요 |
|------|----------|----------|
| `lib/anilist.ts` | ✅ AniList/Kitsu/Jikan 통합 완료 | `getAnimePosters()` 배치 함수 추가 |
| `lib/tmdb.ts` | ✅ 영화/TV만, 애니메 제외 | 없음 |
| `AnimeDetailClient.tsx` | ✅ AniList 전용 | 없음 |
| `DetailClient.tsx` | ✅ TMDB 전용 (영화/TV) | 없음 |
| `app/title/[id]/page.tsx` | ✅ type에 따라 분기 | 없음 |
| `app/search/page.tsx` | ✅ AniList+TMDB 병렬 검색 | 없음 |
| `api/anime-trending` | ✅ AniList | 없음 |
| `api/discover-by-year` | ✅ AniList 분기 | 없음 |
| `api/tmdb/year-posters` | ✅ AniList 분기 | 없음 |
| `api/collections/published` | ❌ `getThumbnails()` TMDB만 | anime 분기 추가 |
| `api/collections/[id]/items` | ❌ enrichment TMDB만 | anime 분기 추가 |
| `api/roulette` | ❌ `anime→tv` 변환 | AniList로 대체 |
| `api/activity` | ✅ anime enrichment 별도 | 없음 |
| `api/library` | ✅ anime 분기 | 없음 |
| `api/for-you` | ✅ anime 분기 | 없음 |
| `api/history` | ✅ anime 분기 | 없음 |
