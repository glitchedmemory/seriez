# Seriez 라우팅 개편: /title/[id] → /movie /tv /anime 분리

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 영화·TV·애니 디테일 페이지를 URL 레벨에서 분리(`/movie/[id]`, `/tv/[id]/season/[n]`, `/anime/[id]`)하여 TMDB 영화/TV ID 중복 충돌을 원천 제거한다.

**Architecture:** 새 라우트 3개를 추가하고 공통 로직을 `lib/title-utils.ts`로 추출. 내부 링크 30곳을 새 URL로 교체. 기존 `/title/*`는 리다이렉트 전용으로 전환. proxy.ts에 301/302 리다이렉트 규칙 추가.

**Tech Stack:** Next.js 16 (App Router, Turbopack), TypeScript, TMDB API, Cloudflare CDN, PM2

---

## 배경 / 현재 상태

**문제:** TMDB는 영화와 TV에 같은 숫자 ID를 부여할 수 있음 (예: 1396 = 영화 Mirror + TV Breaking Bad). 현재 `/title/[id]` 단일 라우트가 `?type=` 쿼리로 구분하므로:
- 내부 링크는 `?type=`을 명시해서 충돌 없음 (단, type 없는 접근에서 isMovie 우선)
- `/title/1396`처럼 type 없는 직접 접근(검색엔진·북마크·공유) 시 isMovie 체크가 true면 영화(Mirror)가 표시되고 TV(Breaking Bad)를 볼 수 없음

**해결 방향:** URL 자체가 타입을 담게 하여 추측 로직 제거.

## 새 URL 구조

| 타입 | 새 URL | 비고 |
|---|---|---|
| 영화 | `/movie/[id]` | 영화 디테일 |
| TV | `/tv/[id]` → `/tv/[id]/season/1` | proxy에서 즉시 리다이렉트 |
| TV 시즌 | `/tv/[id]/season/[season]` | 기존 시즌 페이지 이동 |
| 애니 | `/anime/[id]` | 애니 디테일 |

**구 URL → 새 URL (리다이렉트):**
- `/title/603` (type 없음, movie만 존재) → `/movie/603` (302)
- `/title/1396` (type 없음, movie+TV 둘 다 존재) → vote_count 비교로 결정 (302)
- `/title/1396?type=tv` → `/tv/1396/season/1` (301)
- `/title/1396?type=movie` → `/movie/1396` (301)
- `/title/1396?type=anime` → `/anime/[anilistId]` (301, getAnilistId로 변환)
- `/title/1396/season/2` → `/tv/1396/season/2` (301)

> **리다이렉트 상태 코드 결정:** type이 명시된 경우(결정이 확정적) → 301. type 없는 경우(자동 판별 필요, 결과가 바뀔 수 있음) → 302. 영구 캐시로 잘못된 판별이 고착되는 것을 방지.

---

## 단계별 계획

### Phase 0: 사전 준비

**Task 0.1: `lib/title-utils.ts` 생성** (공통 헬퍼)

```ts
// lib/title-utils.ts
const TMDB_BASE = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_API_KEY!;

type ResolvedType = { type: "movie" | "tv" | "anime"; id: number } | null;

// movie 존재 여부 + vote_count 반환
export async function getMovieInfo(id: number): Promise<{ exists: boolean; voteCount: number } | null> {
  try {
    const res = await fetch(`${TMDB_BASE}/movie/${id}?api_key=${API_KEY}&language=en-US`, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const d = await res.json();
    return { exists: true, voteCount: d.vote_count || 0 };
  } catch { return null; }
}

// tv 존재 여부 + vote_count 반환
export async function getTVInfo(id: number): Promise<{ exists: boolean; voteCount: number } | null> {
  try {
    const res = await fetch(`${TMDB_BASE}/tv/${id}?api_key=${API_KEY}&language=en-US`, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const d = await res.json();
    return { exists: true, voteCount: d.vote_count || 0 };
  } catch { return null; }
}

// type 없는 접근 시 충돌 해결 (vote_count 비교)
export async function resolveConflict(id: number): Promise<"movie" | "tv"> {
  const [movie, tv] = await Promise.all([getMovieInfo(id), getTVInfo(id)]);
  if (movie && !tv) return "movie";
  if (!movie && tv) return "tv";
  if (movie && tv) {
    return (movie.voteCount >= tv.voteCount) ? "movie" : "tv";
  }
  return "movie"; // 둘 다 없으면 기본 (notFound로 이어짐)
}
```

**검증:** `npx tsc --noEmit` — 새 에러 0개.

### Phase 1: 새 라우트 생성 (기존 페이지 이동)

**Task 1.1: `app/movie/[id]/page.tsx` 생성**
- `app/title/[id]/page.tsx`의 movie 분기(169-224행)를 이동
- `getMovieDetail(numId)` 호출, MovieHero/DetailInteractive/MovieInfo 등 동일 렌더
- `generateMovieJsonLd` url → `/movie/${id}`
- `export const revalidate = 86400`

**Task 1.2: `app/anime/[id]/page.tsx` 생성**
- `app/title/[id]/page.tsx`의 anime 분기(124-167행)를 이동
- `getAnilistId(numId)` → `getAnimeDetail` → AnimeHero 등 동일 렌더
- jsonLd url → `/anime/${anilistId}`

**Task 1.3: `app/tv/[id]/season/[season]/page.tsx` 이동**
- `app/title/[id]/season/[season]/` → `app/tv/[id]/season/[season]/` 이동 (git mv)
- 내부 링크 url → `/tv/${seriesId}/season/${seasonNum}`

**Task 1.4: `app/tv/[id]/page.tsx` 생성** (리다이렉트용)
```ts
import { redirect } from "next/navigation";
export default function TVRedirect({ params }: { params: Promise<{ id: string }> }) {
  // async 컴포넌트로 전환, params await
  redirect(`/tv/${id}/season/1`);
}
```

**검증:** 로컬 dev 서버로 `/movie/603`, `/anime/[id]`, `/tv/1399/season/1` 직접 접근 → 200 + 정상 렌더링 확인.

### Phase 2: 내부 링크 교체 (30곳)

**패턴 교체 규칙:**
- `/title/${id}?type=movie` → `/movie/${id}`
- `/title/${id}?type=tv` → `/tv/${id}/season/1`
- `/title/${id}?type=anime` → `/anime/${id}`
- `/title/${id}/season/${n}` → `/tv/${id}/season/${n}`

**파일 목록 (컴포넌트):**
1. `components/HomeClient.tsx` (46, 78, 207)
2. `components/HeroCard.tsx` (86-87, 105, 254)
3. `components/SearchClient.tsx` (240, 290)
4. `components/DetailClient.tsx` (654)
5. `components/CollectionClient.tsx` (244)
6. `components/LibraryClient.tsx` (124-125, 266-267)
7. `components/PersonClient.tsx` (11)
8. `components/PersonHero.tsx` (7)
9. `components/AnimeStaffClient.tsx` (11)
10. `components/AnimeSeasons.tsx` (44)
11. `components/AnimeRecommendations.tsx` (25)
12. `components/AnimeDetailClient.tsx` (708, 1010)
13. `components/SeasonClient.tsx` (627, 914)
14. `components/SeasonTabs.tsx` (15)
15. `components/SeasonRecommendations.tsx` (26)
16. `components/MovieRecommendations.tsx` (25)
17. `components/RouletteCard.tsx` (122)
18. `components/StreamingTop10.tsx` (217)

**파일 목록 (앱/페이지):**
19. `app/feed/page.tsx` (131)
20. `app/profile/page.tsx` (506, 535, 548, 650)
21. `app/history/WatchList.tsx` (45)
22. `app/ai/anime/[id]/page.tsx` (74, 131)
23. `app/ai/tv/[id]/page.tsx` (50, 104)
24. `app/ai/trending/page.tsx` (113)

> ⚠️ `LibraryClient.tsx` 124-125행 주의: mediaType이 tv면 season 경로, anime면 `?type=anime`, movie면 type 없음 → 각각 새 URL로 변환. `item.seasonNumber` 유지.
> ⚠️ `HeroCard.tsx` 86행: tv는 season/1, movie/anime은 type 파라미터 → 각각 새 URL 변환.

**검증:** `grep -rn "/title/" --include="*.tsx" --include="*.ts" app/ components/ | grep -v backup` → 백업 파일 제외 0건.

### Phase 3: 구 URL 리다이렉트 (proxy.ts)

**Task 3.1: proxy.ts에 리다이렉트 규칙 추가**

```ts
// 구 URL → 새 URL (기존 ?type=tv 리다이렉트를 확장)
if (path.startsWith("/title/")) {
  const parts = path.split("/"); // ["", "title", id, "season", n]
  const id = parts[2];
  const type = request.nextUrl.searchParams.get("type");
  
  // /title/[id]/season/[n] → /tv/[id]/season/[n] (301)
  if (parts[3] === "season" && parts[4]) {
    return NextResponse.redirect(new URL(`/tv/${id}/season/${parts[4]}`, request.url), 301);
  }
  // /title/[id]?type=tv → /tv/[id]/season/1 (301)
  if (type === "tv") {
    return NextResponse.redirect(new URL(`/tv/${id}/season/1`, request.url), 301);
  }
  // /title/[id]?type=movie → /movie/[id] (301)
  if (type === "movie") {
    return NextResponse.redirect(new URL(`/movie/${id}`, request.url), 301);
  }
  // /title/[id]?type=anime → /anime/[id] (301)
  if (type === "anime") {
    return NextResponse.redirect(new URL(`/anime/${id}`, request.url), 301);
  }
  // /title/[id] type 없음 → 충돌 해결 (302) — fetch 가능한지 proxy에서 확인
  // ⚠️ proxy(edge)에서 TMDB fetch는 불가능할 수 있음 → app/title/[id]/page.tsx에서 처리
}
```

> ⚠️ **중요 제약:** Next.js proxy(middleware)는 Edge 런타임이라 Node fetch가 제한될 수 있음. TMDB API 호출이 필요한 type 없는 리다이렉트는 **proxy가 아니라 `app/title/[id]/page.tsx`에서 처리**한다 (서버 컴포넌트라 fetch 가능).
> **최종 결정:** proxy.ts는 type이 명시된 경우 + season 경로만 301 처리. type 없는 `/title/[id]`는 `app/title/[id]/page.tsx`(변경 후)가 `resolveConflict()` 호출 → 302 리다이렉트.

**Task 3.2: `app/title/[id]/page.tsx`를 리다이렉트 전용으로 축소**

```ts
import { redirect } from "next/navigation";
import { getAnilistId } from "@/lib/anilist";
import { getMovieInfo, getTVInfo, resolveConflict } from "@/lib/title-utils";

export const revalidate = 86400;

export default async function TitleRedirect({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const [{ id }, { type }] = await Promise.all([params, searchParams]);
  const numId = parseInt(id);
  if (isNaN(numId)) redirect("/404");
  
  if (type === "anime") {
    const anilistId = await getAnilistId(numId);
    if (anilistId) redirect(`/anime/${anilistId}`, RedirectType.replace);
    // anilistId 없으면 아래로 폴스루 (movie/tv 판별)
  }
  
  const movie = await getMovieInfo(numId);
  const tv = await getTVInfo(numId);
  
  if (type === "movie" && movie) redirect(`/movie/${numId}`);
  if (type === "tv" && tv) redirect(`/tv/${numId}/season/1`);
  
  // type 없음 → 충돌 해결
  const resolved = await resolveConflict(numId);
  if (resolved === "tv" && tv) redirect(`/tv/${numId}/season/1`);
  redirect(`/movie/${numId}`); // movie 기본 (없으면 /404로 fallback)
}
```

- 기존 anime/movie 렌더링 코드는 제거 (Phase 1에서 새 라우트로 이동 완료)
- 404 처리: movie/tv 모두 없으면 notFound()

**검증:** `/title/603` → `/movie/603` 302, `/title/1396` → vote_count 기준 (Breaking Bad가 vote 수 압도적 → `/tv/1396/season/1`), `/title/1396?type=movie` → `/movie/1396` 301.

### Phase 4: 인프라 업데이트

**Task 4.1: `app/sitemap.ts`**
- `/title/${id}?type=movie` → `/movie/${id}`
- `/title/${id}?type=tv` → `/tv/${id}/season/1`

**Task 4.2: `scripts/warm-cdn.py`**
- `/title/{mid}` → `/movie/{mid}`
- `/title/{tid}?type=tv` → `/tv/{tid}/season/1`
- `/title/{aid}?type=anime` → `/anime/{aid}`

**Task 4.3: `scripts/cache-warm-local.sh`**
- grep 패턴 `/title/` → `/movie/|/tv/|/anime/`

### Phase 5: 최종 검증 + 배포

**로컬 검증:**
1. `npx tsc --noEmit` — 기존 21개 에러 이외 새 에러 0
2. dev 서버: `/movie/603` 200, `/tv/1399/season/1` 200, `/anime/[id]` 200
3. 리다이렉트: `/title/603` → /movie/603, `/title/1399` → /tv/1399/season/1, `/title/1396` → /tv/1396/season/1 (vote 비교), `/title/1396?type=movie` → /movie/1396
4. 구 URL /title/ 직접 접근 시 리다이렉트 체인 확인 (curl -I)

**배포:**
1. 커밋 (여러 개, Phase별로 분리)
2. push
3. VPS: `git reset --hard origin/main && rm -rf .next && npm run build && pm2 restart seriez`
4. 실서버 검증: 위 URL들 curl 확인

**Cloudflare 캐시 주의:** 구 URL이 301로 영구 캐시되어 있으면 새 리다이렉트가 적용 안 될 수 있음 → Cloudflare 대시보드에서 Cache Rules 확인 또는 `?t=` 파라미터로 우회 테스트.

---

## 파일 변경 요약

**생성:**
- `lib/title-utils.ts`
- `app/movie/[id]/page.tsx`
- `app/anime/[id]/page.tsx`
- `app/tv/[id]/page.tsx`
- `app/tv/[id]/season/[season]/page.tsx` (git mv)

**이동/삭제:**
- `app/title/[id]/page.tsx` → 리다이렉트 전용 축소
- `app/title/[id]/season/[season]/` → `app/tv/[id]/season/[season]/` (git mv)
- `app/title/[id]/loading.tsx` → 이동 또는 복제 (`app/movie/[id]/loading.tsx`, `app/tv/[id]/loading.tsx`)

**수정:**
- `proxy.ts`
- `app/sitemap.ts`
- `scripts/warm-cdn.py`
- `scripts/cache-warm-local.sh`
- 컴포넌트 18개 + 페이지 6개 (링크 30곳)

**백업 파일(수정 금지):** `*.backdrop-backup-20260617` 3개

---

## 리스크 / 트레이드오프

1. **Edge proxy에서 TMDB fetch 불가 가능성** — type 없는 리다이렉트를 proxy가 아닌 page.tsx(서버 컴포넌트)에서 처리하여 회피. proxy는 확정적 301만 담당.
2. **SEO 리다이렉트 체인** — 구 URL → 새 URL이 1홉으로 끝나도록 보장. 중간에 ?type=tv → season/1 → 새 URL 식의 2홉 방지.
3. **Cloudflare 영구 캐시** — 301 캐시로 인해 새 규칙 미적용 가능. 배포 후 실서버 curl -I로 Location 헤더 확인.
4. **vote_count 기준의 한계** — 극히 드물게 사용자 의도와 다른 선택 가능. 단, 내부 링크는 모두 type 명시라 사용자 흐름은 보호됨. 302라서 나중에 기준 변경 가능.
5. **generateStaticParams** — title/[id]의 static params 로직(20,000개)을 movie/anime 라우트로 이관해야 함. TV는 이미 season 페이지가 dynamic (ƒ 마크 확인됨). movie/anime도 동적 렌더링이면 static params 생략 가능하나, 현재 revalidate=86400 ISR 구조 유지 권장.
6. **검증 순서** — Phase 1(추가) 완료 후 기존 사이트 무영향 확인 → Phase 2(링크 교체) → Phase 3(리다이렉트) 순서로 진행. 각 Phase 커밋 분리로 롤백 용이.

## 미결정 사항 (실행 전 확인 필요)

1. ~~`/anime/[id]`에서 id를 TMDB id로 유지할지, AniList id로 변환할지~~ → **확정 (2026-08-02): 건들지 않음.** 기존 방식 유지 — `/anime/{tmdbId}`가 TMDB id를 받아 내부에서 getAnilistId로 변환. 기존 링크와 완벽 호환.
2. ~~구 `/title/` URL 처리~~ → **확정 (2026-08-02): 301 리다이렉트 영구 유지.** 검색엔진 순위 보존 + 북마크/공유 링크 안전. 404 폐기 없음.
