// ponytail: single-file curation engine, no abstractions
import type { TmdbResult } from "./tmdb";
import { GENRE_MAP } from "./tmdb";

const TMDB = "https://api.themoviedb.org/3";
const KEY = process.env.TMDB_API_KEY!;
const ANILIST = "https://graphql.anilist.co";

// ─── TMDB fetch (inlined, get() not exported) ───
async function tmdb(p: string, q: Record<string, string> = {}) {
  const u = new URL(`${TMDB}${p}`);
  u.searchParams.set("api_key", KEY);
  Object.entries(q).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { next: { revalidate: 3600 } });
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

// ─── AniList hidden gem fetch ───
async function animeHiddenGems(): Promise<TmdbResult[]> {
  try {
    const q = `query{Page(perPage:15){media(sort:SCORE_DESC,type:ANIME,isAdult:false,popularity_lesser:30000,minimumTagRank:70){id title{romaji english}coverImage{extraLarge}bannerImage averageScore seasonYear description genres popularity}}}`;
    const r = await fetch(ANILIST, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q }), next: { revalidate: 3600 } });
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

// ─── strategy: hidden gem ───
async function hiddenGems(): Promise<TmdbResult[]> {
  const baseQ = { "vote_count.lte": "300", "vote_average.gte": "7.5", sort_by: "vote_average.desc", "primary_release_date.gte": "2016-01-01", without_genres: "16" };
  const [m, t] = await Promise.all([tmdb("/discover/movie", baseQ), tmdb("/discover/tv", { ...baseQ, "first_air_date.gte": "2016-01-01" })]);
  return [...(m.results || []).slice(0, 10).map((x: any) => toResult(x, "movie")), ...(t.results || []).slice(0, 10).map((x: any) => toResult(x, "tv"))];
}

// ─── strategy: cult ───
async function cultPicks(): Promise<TmdbResult[]> {
  const q = { "vote_count.lte": "300", "vote_count.gte": "50", "vote_average.gte": "6.2", "vote_average.lte": "7.4", sort_by: "popularity.desc", with_genres: "27|878|53|28", without_genres: "16" };
  const [m, t] = await Promise.all([tmdb("/discover/movie", q), tmdb("/discover/tv", q)]);
  return [...(m.results || []).slice(0, 10).map((x: any) => toResult(x, "movie")), ...(t.results || []).slice(0, 10).map((x: any) => toResult(x, "tv"))];
}

// ─── weekly themes ───
const THEMES = [
  { name: "90s Gems", params: { "primary_release_date.gte": "1990-01-01", "primary_release_date.lte": "1999-12-31", "vote_average.gte": "7.0" } },
  { name: "Korean Cinema", params: { with_original_language: "ko", "vote_average.gte": "7.5" } },
  { name: "Under 2 Hours", params: { "with_runtime.lte": "120", "vote_average.gte": "7.0" } },
  { name: "Foreign Gems", params: { without_original_language: "en", "vote_average.gte": "7.5", "vote_count.lte": "500" } },
];

async function weeklyTheme(): Promise<TmdbResult[]> {
  const week = Math.floor((Math.floor(Date.now() / 86400000) + 3) / 7); // day 0 = 1970-01-01 Thu, align to Sun
  const theme = THEMES[week % 4];
  const baseQ = { ...theme.params, sort_by: "vote_average.desc", without_genres: "16", "vote_count.lte": "800" };
  const [m, t] = await Promise.all([tmdb("/discover/movie", baseQ), tmdb("/discover/tv", { ...baseQ, "first_air_date.gte": "1990-01-01" })]);
  return [...(m.results || []).slice(0, 10).map((x: any) => toResult(x, "movie")), ...(t.results || []).slice(0, 10).map((x: any) => toResult(x, "tv"))];
}

// ─── mood weighting ───
type Mood = "energy" | "tension" | "comfort";
const MOOD_GENRES: Record<Mood, string[]> = {
  energy: ["Action", "Adventure", "Sci-Fi", "Fantasy", "War"],
  tension: ["Thriller", "Mystery", "Drama", "Crime", "Horror"],
  comfort: ["Comedy", "Romance", "Family", "Documentary", "Music"],
};

function getMood(hour: number): Mood {
  if (hour >= 6 && hour < 18) return "energy";
  if (hour >= 18 && hour < 22) return "tension";
  return "comfort";
}

function weightedScore(item: TmdbResult, mood: Mood): number {
  let score = item.rating;
  const moodGenres = MOOD_GENRES[mood];
  if (item.genres.some(g => moodGenres.includes(g))) score *= 2.0;
  if (item.rating >= 8.5) score *= 1.5;
  return score;
}

// ─── main ───
export async function getTonightsPick(): Promise<{ hero: TmdbResult; nextHero: TmdbResult } | null> {
  const now = new Date();
  // deterministic strategy pick based on date
  const doy = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const r = (doy * 17 + 7) % 100; // 0-99

  let pool: TmdbResult[] = [];
  if (r < 40) {
    const [tmdbGems, animeGems] = await Promise.all([hiddenGems(), animeHiddenGems()]);
    pool = [...tmdbGems, ...animeGems];
  } else if (r < 70) {
    pool = await cultPicks();
  } else {
    const [themeItems, animeGems] = await Promise.all([weeklyTheme(), animeHiddenGems()]);
    pool = [...themeItems, ...animeGems];
  }

  if (pool.length < 2) return null;

  // ponytail: global PDT offset, per-user timezone if it matters
  const pdtHour = (now.getUTCHours() - 7 + 24) % 24;
  const mood = getMood(pdtHour);

  // score + weighted random from top 5
  const scored = pool
    .map(item => ({ item, score: weightedScore(item, mood) * (0.8 + Math.random() * 0.4) }))
    .sort((a, b) => b.score - a.score);

  const hero = scored[0].item;
  // nextHero: different media type preferred
  const next = scored.find(s => s.item.type !== hero.type) || scored[1];
  return { hero, nextHero: next.item };
}
