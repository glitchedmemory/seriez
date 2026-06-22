import { createClient } from "@supabase/supabase-js";
import { resolveUserId } from "@/lib/user-utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export interface RecentWatched {
  tmdb_id: number;
  anilist_id: number | null;
  media_type: string;
}

export interface WatchedIds {
  tmdbIds: number[];
  anilistIds: number[];
}

/**
 * 최근 N일 내에 status='completed'로 표시한 모든 작품 조회
 * watched_at 기준 필터링 (Prisma 미노출 컬럼 → Supabase REST API 직접 사용)
 */
export async function getWatchedInLastDays(
  username: string,
  days: number = 3
): Promise<RecentWatched[]> {
  const userId = await resolveUserId(username);
  if (!userId) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { data, error } = await supabaseAdmin
    .from("media_trackings")
    .select("tmdb_id, anilist_id, media_type")
    .eq("username", userId)
    .eq("status", "completed")
    .gte("watched_at", cutoff.toISOString())
    .order("watched_at", { ascending: false });

  if (error) {
    console.error("getWatchedInLastDays error:", error);
    return [];
  }

  return (data || []) as RecentWatched[];
}

/**
 * 사용자가 completed 처리한 모든 작품의 ID 수집 (제외 목록용)
 */
export async function getAllWatchedIds(username: string): Promise<WatchedIds> {
  const userId = await resolveUserId(username);
  if (!userId) return { tmdbIds: [], anilistIds: [] };

  const { data, error } = await supabaseAdmin
    .from("media_trackings")
    .select("tmdb_id, anilist_id")
    .eq("username", userId)
    .eq("status", "completed");

  if (error) {
    console.error("getAllWatchedIds error:", error);
    return { tmdbIds: [], anilistIds: [] };
  }

  const tmdbIds: number[] = [];
  const anilistIds: number[] = [];

  for (const row of data || []) {
    if (row.tmdb_id) tmdbIds.push(row.tmdb_id);
    if (row.anilist_id) anilistIds.push(row.anilist_id);
  }

  return { tmdbIds, anilistIds };
}

// ─── Phase 2: Genre & Year analysis ───

const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY!;
const ANILIST_API = "https://graphql.anilist.co";

// TMDB genre ID → name (for filtering, we need both directions)
export const TMDB_GENRE_NAME_TO_ID: Record<string, number> = {
  "Action": 28, "Adventure": 12, "Animation": 16, "Comedy": 35,
  "Crime": 80, "Documentary": 99, "Drama": 18, "Family": 10751,
  "Fantasy": 14, "History": 36, "Horror": 27, "Music": 10402,
  "Mystery": 9648, "Romance": 10749, "Science Fiction": 878,
  "TV Movie": 10770, "Thriller": 53, "War": 10752, "Western": 37,
};

// AniList genre → TMDB genre name (for cross-platform analysis)
const ANILIST_TO_TMDB_GENRE: Record<string, string> = {
  "Action": "Action", "Adventure": "Adventure", "Comedy": "Comedy",
  "Drama": "Drama", "Fantasy": "Fantasy", "Horror": "Horror",
  "Mystery": "Mystery", "Romance": "Romance",
  "Sci-Fi": "Science Fiction", "Thriller": "Thriller",
  "Slice of Life": "Drama", "Supernatural": "Fantasy",
  "Psychological": "Thriller", "Mecha": "Action",
};

/**
 * TMDB에서 작품의 장르 가져오기 (movie or tv)
 */
async function fetchTMDBGenres(tmdbId: number, mediaType: string): Promise<string[]> {
  try {
    const res = await fetch(
      `${TMDB_API}/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}&language=en-US`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.genres || []).map((g: any) => g.name);
  } catch {
    return [];
  }
}

/**
 * AniList에서 작품의 장르 가져오기
 */
async function fetchAniListGenres(anilistId: number): Promise<string[]> {
  try {
    const query = `query($id:Int){Media(id:$id){genres}}`;
    const res = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { id: anilistId } }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const rawGenres: string[] = json.data?.Media?.genres || [];
    // Normalize AniList genres to TMDB genre names
    return rawGenres.map((g) => ANILIST_TO_TMDB_GENRE[g] || g);
  } catch {
    return [];
  }
}

/**
 * TMDB에서 작품의 연도 가져오기
 */
async function fetchTMDBYear(tmdbId: number, mediaType: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${TMDB_API}/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}&language=en-US`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const dateStr = data.release_date || data.first_air_date;
    if (dateStr) return parseInt(dateStr.slice(0, 4));
    return null;
  } catch {
    return null;
  }
}

/**
 * AniList에서 작품의 연도 가져오기
 */
async function fetchAniListYear(anilistId: number): Promise<number | null> {
  try {
    const query = `query($id:Int){Media(id:$id){startDate{year}}}`;
    const res = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { id: anilistId } }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.Media?.startDate?.year || null;
  } catch {
    return null;
  }
}

/**
 * 최근 Watched 작품들의 장르 빈도 분석 → Top 2 장르명 반환
 * 모든 API 호출은 병렬로 처리
 */
export async function analyzeTopGenres(
  recentWatched: RecentWatched[]
): Promise<string[]> {
  if (recentWatched.length === 0) return [];

  // Fetch genres for all watched items in parallel
  const genrePromises = recentWatched.map(async (item) => {
    if (item.media_type === "anime" && item.anilist_id) {
      return fetchAniListGenres(item.anilist_id);
    } else if (item.tmdb_id) {
      const mediaType = item.media_type === "tv" ? "tv" : "movie";
      return fetchTMDBGenres(item.tmdb_id, mediaType);
    }
    return [] as string[];
  });

  const allGenres = await Promise.all(genrePromises);

  // Count frequencies
  const freq: Record<string, number> = {};
  for (const genres of allGenres) {
    for (const g of genres) {
      freq[g] = (freq[g] || 0) + 1;
    }
  }

  // Sort by frequency, pick top 2
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([genre]) => genre);
}

/**
 * 최근 Watched 작품들의 연도 범위 추출 → ±2년 확장
 * 모든 API 호출은 병렬로 처리
 */
export async function analyzeYearRange(
  recentWatched: RecentWatched[]
): Promise<{ minYear: number; maxYear: number } | null> {
  if (recentWatched.length === 0) return null;

  const yearPromises = recentWatched.map(async (item) => {
    if (item.media_type === "anime" && item.anilist_id) {
      return fetchAniListYear(item.anilist_id);
    } else if (item.tmdb_id) {
      const mediaType = item.media_type === "tv" ? "tv" : "movie";
      return fetchTMDBYear(item.tmdb_id, mediaType);
    }
    return null;
  });

  const years = (await Promise.all(yearPromises)).filter(
    (y): y is number => y !== null
  );

  if (years.length === 0) return null;

  const minYear = Math.min(...years) - 2;
  const maxYear = Math.max(...years) + 2;

  return { minYear, maxYear };
}

/**
 * 장르명 배열을 TMDB 장르 ID 배열로 변환
 */
export function genresToTMDBIds(genres: string[]): number[] {
  return genres
    .map((g) => TMDB_GENRE_NAME_TO_ID[g])
    .filter((id): id is number => id !== undefined);
}

// ─── Phase 3: TMDB/AniList filter search ───

export interface TMDBFilterParams {
  mediaType: "movie" | "tv";
  genreIds?: number[];
  yearGte?: number;
  yearLte?: number;
  excludeIds: number[];
  periodStart: string;
  periodEnd: string;
}

export interface AniListFilterParams {
  genres?: string[];
  yearGte?: number;
  yearLte?: number;
  excludeIds: number[];
  seasons: string[];
  searchYear: number;
}

/**
 * 필터가 적용된 TMDB Discover API 검색
 */
export async function searchTMDBWithFilters(
  params: TMDBFilterParams
): Promise<any[]> {
  const { mediaType, genreIds, yearGte, yearLte, excludeIds, periodStart, periodEnd } = params;
  const dateField = mediaType === "movie" ? "primary_release_date" : "first_air_date";
  const minVotes = mediaType === "movie" ? 100 : 50;
  const withoutGenres = mediaType === "tv" ? "&without_genres=16" : "";

  let url = `${TMDB_API}/discover/${mediaType}?sort_by=popularity.desc&vote_count.gte=${minVotes}&language=en-US${withoutGenres}`;

  // Period constraint (existing H1/H2 logic)
  url += `&${dateField}.gte=${periodStart}&${dateField}.lte=${periodEnd}`;

  // Genre filter
  if (genreIds && genreIds.length > 0) {
    url += `&with_genres=${genreIds.join(",")}`;
  }

  // Year range filter (overrides period if narrower)
  if (yearGte || yearLte) {
    const gte = yearGte ? `${yearGte}-01-01` : periodStart;
    const lte = yearLte ? `${yearLte}-12-31` : periodEnd;
    url = url.replace(
      new RegExp(`${dateField}\\.gte=[^&]+`),
      `${dateField}.gte=${gte}`
    );
    url = url.replace(
      new RegExp(`${dateField}\\.lte=[^&]+`),
      `${dateField}.lte=${lte}`
    );
  }

  url += `&api_key=${TMDB_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const pool = (data.results || []).slice(0, 20);

    // Exclude watched
    if (excludeIds.length > 0) {
      const excludeSet = new Set(excludeIds);
      return pool.filter((item: any) => !excludeSet.has(item.id));
    }
    return pool;
  } catch {
    return [];
  }
}

/**
 * 필터가 적용된 AniList GraphQL 검색
 */
export async function searchAniListWithFilters(
  params: AniListFilterParams
): Promise<any[]> {
  const { genres, yearGte, yearLte, excludeIds, seasons, searchYear } = params;

  let allResults: any[] = [];
  const excludeSet = new Set(excludeIds);

  for (const season of seasons) {
    try {
      const query = `query($year:Int,$season:MediaSeason){Page(perPage:20){media(seasonYear:$year,season:$season,type:ANIME,sort:POPULARITY_DESC){id title{romaji english}coverImage{extraLarge}bannerImage startDate{year}averageScore genres description}}}`;
      const res = await fetch(ANILIST_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { year: searchYear, season } }),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const media = (json.data?.Page?.media || []) as any[];

      // Apply filters
      let filtered = media.filter((m: any) => !excludeSet.has(m.id));

      if (genres && genres.length > 0) {
        filtered = filtered.filter((m: any) => {
          const mGenres = new Set(m.genres || []);
          return genres.some((g) => mGenres.has(g));
        });
      }

      if (yearGte || yearLte) {
        filtered = filtered.filter((m: any) => {
          const y = m.startDate?.year;
          if (!y) return false;
          if (yearGte && y < yearGte) return false;
          if (yearLte && y > yearLte) return false;
          return true;
        });
      }

      allResults.push(...filtered);
    } catch {}
  }

  return allResults;
}
