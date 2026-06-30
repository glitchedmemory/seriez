// Right Now — time-based genre curation with balanced decades
import type { TmdbResult } from "./tmdb";
import { GENRE_MAP } from "./tmdb";

const TMDB = "https://api.themoviedb.org/3";
const KEY = process.env.TMDB_API_KEY!;
const ANILIST = "https://graphql.anilist.co";

// ─── TMDB fetch ───
async function tmdb(p: string, q: Record<string, string> = {}) {
  const u = new URL(`${TMDB}${p}`);
  u.searchParams.set("api_key", KEY);
  Object.entries(q).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { next: { revalidate: 1800 } });
  return r.ok ? r.json() : { results: [] };
}

function toResult(item: any, type: "movie" | "tv"): TmdbResult {
  const d = item.release_date || item.first_air_date || "";
  return {
    id: item.id, title: item.title || item.name || "Unknown",
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w780${item.poster_path}` : null,
    backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
    rating: Math.round((item.vote_average || 0) * 10) / 10,
    year: d ? parseInt(d.slice(0, 4)) : 0, type,
    overview: item.overview || "",
    genres: ((item.genre_ids || []) as number[]).map((g: number) => GENRE_MAP[g]).filter(Boolean).slice(0, 3),
    daysUntil: null,
  };
}

// ─── AniList trending/popular anime (NOT hidden gems) ───
async function animePopular(): Promise<TmdbResult[]> {
  try {
    const q = `query{Page(perPage:15){media(sort:POPULARITY_DESC,type:ANIME,isAdult:false){id title{romaji english}coverImage{extraLarge}bannerImage averageScore seasonYear description genres}}}`;
    const r = await fetch(ANILIST, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q }), next: { revalidate: 1800 } });
    const j = await r.json();
    return (j.data?.Page?.media || []).map((m: any) => ({
      id: m.id, title: m.title?.english || m.title?.romaji || "Unknown",
      poster: m.coverImage?.extraLarge || null, backdrop: m.bannerImage || null,
      rating: Math.round((m.averageScore || 0) / 10) / 10, year: m.seasonYear || 0,
      type: "anime" as const, overview: (m.description || "").replace(/<[^>]+>/g, "").slice(0, 300),
      genres: (m.genres || []).slice(0, 5), daysUntil: null,
    }));
  } catch { return []; }
}

// ─── Time period → genres ───
type Period = "morning" | "afternoon" | "evening" | "night";

interface PeriodConfig {
  genres: number[];       // TMDB genre IDs
  mood: Mood;
}

const PERIODS: Record<Period, PeriodConfig> = {
  morning:   { genres: [35, 10751, 10749, 12], mood: "comfort" },
  afternoon: { genres: [28, 878, 14, 12], mood: "energy" },
  evening:   { genres: [53, 9648, 80, 18], mood: "tension" },
  night:     { genres: [27, 99, 10402, 10752], mood: "comfort" },
};

function getPeriod(hour: number): Period {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
}

// ─── Mood weighting ───
type Mood = "energy" | "tension" | "comfort";
const MOOD_GENRES: Record<Mood, string[]> = {
  energy: ["Action", "Adventure", "Sci-Fi", "Fantasy", "War"],
  tension: ["Thriller", "Mystery", "Drama", "Crime", "Horror"],
  comfort: ["Comedy", "Romance", "Family", "Documentary", "Music"],
};

function weightedScore(item: TmdbResult, mood: Mood): number {
  let score = item.rating;
  if (item.genres.some(g => MOOD_GENRES[mood].includes(g))) score *= 2.0;
  if (item.rating >= 8.5) score *= 1.5;
  return score;
}

// ─── Decade bucket ───
function decade(year: number): string {
  if (year >= 2020) return "2020s";
  if (year >= 2010) return "2010s";
  if (year >= 2000) return "2000s";
  return "1990s";
}

// ─── Main ───
export async function getTonightsPick(tz?: string): Promise<{ hero: TmdbResult; nextHero: TmdbResult } | null> {
  // Determine local hour
  let hour: number;
  try {
    if (tz) {
      const now = new Date();
      const local = new Date(now.toLocaleString("en-US", { timeZone: tz }));
      hour = local.getHours();
    } else {
      // PDT fallback
      hour = (new Date().getUTCHours() - 7 + 24) % 24;
    }
  } catch {
    hour = (new Date().getUTCHours() - 7 + 24) % 24;
  }

  const period = getPeriod(hour);
  const config = PERIODS[period];

  // Fetch TMDB: 4 genres × 20 per genre (5 per decade across 4 decades)
  const perDecade = 5;
  const decadeBuckets = new Map<string, TmdbResult[]>();

  for (const genreId of config.genres) {
    const data = await tmdb("/discover/movie", {
      with_genres: String(genreId),
      sort_by: "vote_average.desc",
      "vote_count.gte": "100",
      "primary_release_date.gte": "1990-01-01",
      without_genres: "16",
    });
    const items: TmdbResult[] = (data.results || []).map((x: any) => toResult(x, "movie"));

    // Bucket by decade
    for (const [dec, bucket] of [["2020s", []], ["2010s", []], ["2000s", []], ["1990s", []]] as [string, TmdbResult[]][]) {
      const filtered = items.filter(i => decade(i.year) === dec).slice(0, perDecade);
      if (!decadeBuckets.has(dec)) decadeBuckets.set(dec, []);
      decadeBuckets.get(dec)!.push(...filtered);
    }
  }

  // TV: 1 call per genre (lighter since TV pool is smaller)
  for (const genreId of config.genres) {
    const data = await tmdb("/discover/tv", {
      with_genres: String(genreId),
      sort_by: "vote_average.desc",
      "vote_count.gte": "100",
      "first_air_date.gte": "1990-01-01",
      without_genres: "16",
    });
    const items: TmdbResult[] = (data.results || []).map((x: any) => toResult(x, "tv"));
    for (const [dec, bucket] of [["2020s", []], ["2010s", []], ["2000s", []], ["1990s", []]] as [string, TmdbResult[]][]) {
      const filtered = items.filter(i => decade(i.year) === dec).slice(0, perDecade);
      if (!decadeBuckets.has(dec)) decadeBuckets.set(dec, []);
      decadeBuckets.get(dec)!.push(...filtered);
    }
  }

  // Flatten decade buckets → pool
  let pool: TmdbResult[] = [];
  for (const items of decadeBuckets.values()) {
    pool.push(...items);
  }

  // Add anime
  const anime = await animePopular();
  pool.push(...anime);

  if (pool.length < 2) return null;

  // Deduplicate by ID
  const seen = new Set<number>();
  pool = pool.filter(item => !seen.has(item.id) && seen.add(item.id));

  // Score + weighted random
  const scored = pool
    .map(item => ({ item, score: weightedScore(item, config.mood) * (0.8 + Math.random() * 0.4) }))
    .sort((a, b) => b.score - a.score);

  const hero = scored[0].item;
  const next = scored.find(s => s.item.type !== hero.type) || scored[1];
  return { hero, nextHero: next.item };
}
