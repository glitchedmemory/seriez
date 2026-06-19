const TMDB_BASE = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_API_KEY!;

import { validateAndReplaceTrailers } from "./yt-validator";

const poster = (path: string | null) =>
  path ? `https://image.tmdb.org/t/p/w780${path}` : null;

const backdrop = (path: string | null) =>
  path ? `https://image.tmdb.org/t/p/original${path}` : null;

// TMDB genre ID → name mapping
export const GENRE_MAP: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie",
  53: "Thriller", 10752: "War", 37: "Western",
  // TV-specific
  10759: "Action", 10762: "Kids", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi", 10766: "Soap", 10767: "Talk", 10768: "War",
};

async function get(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("language", "en-US");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${endpoint}`);
  return res.json();
}

export type TmdbItem = {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  overview?: string;
  genre_ids?: number[];
  release_date?: string;
  first_air_date?: string;
  media_type?: "movie" | "tv";
};

export type TmdbResult = {
  id: number;
  title: string;
  poster: string | null;
  backdrop: string | null;
  rating: number;
  year: number;
  type: "movie" | "tv" | "anime";
  overview: string;
  genres: string[];
  daysUntil: number | null;
};

function format(item: TmdbItem): TmdbResult {
  // Type detection: prefer explicit media_type, then check fields
  // TMDB TV items have "name", movies have "title"
  let isMovie: boolean;
  if (item.media_type) {
    isMovie = item.media_type === "movie";
  } else {
    // If item has "name" (TV marker), it's TV. Otherwise default to movie.
    isMovie = !item.name && !!item.title;
  }
  const dateStr = item.release_date || item.first_air_date || "";
  const daysUntil = dateStr
    ? Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
    : null;
  return {
    id: item.id,
    title: item.title || item.name || "Unknown",
    poster: poster(item.poster_path),
    backdrop: backdrop(item.backdrop_path),
    rating: Math.round(item.vote_average * 10) / 10,
    year: dateStr ? parseInt(dateStr.slice(0, 4)) : 0,
    type: isMovie ? "movie" : "tv",
    overview: item.overview || "",
    genres: (item.genre_ids || [])
      .map((id: number) => GENRE_MAP[id])
      .filter(Boolean)
      .slice(0, 3),
    daysUntil: daysUntil && daysUntil > 0 ? daysUntil : null,
  };
}

export async function getTrending(): Promise<TmdbResult[]> {
  // Fetch movie and TV trending separately to guarantee 14 each
  const [movieData, tvData] = await Promise.all([
    get("/trending/movie/week"),
    get("/trending/tv/week"),
  ]);
  const movies = (movieData.results as TmdbItem[]).slice(0, 14).map(format);
  const tvs = (tvData.results as TmdbItem[]).slice(0, 14).map(format);
  return [...movies, ...tvs];
}

export async function getUpcoming(): Promise<TmdbResult[]> {
  const data = await get("/movie/upcoming", { region: "US", sort_by: "popularity.desc" });
  const results = (data.results as TmdbItem[]).map(format);
  // Only keep items with confirmed future release dates
  return results
    .filter((item) => {
      // Include items without a known date, but exclude confirmed past dates
      if (!item.daysUntil) return item.year === 0; // keep if no date at all (edge case)
      return item.daysUntil > 0; // only future releases
    })
    .slice(0, 14);
}

export async function getNowPlaying(region: string = "US"): Promise<TmdbResult[]> {
  const data = await get("/movie/now_playing", { region });
  return (data.results as TmdbItem[]).slice(0, 7).map(format);
}

export async function searchMulti(query: string): Promise<TmdbResult[]> {
  const data = await get("/search/multi", { query, include_adult: "false" });
  return (data.results as TmdbItem[])
    .filter((item) => item.media_type === "movie" || item.media_type === "tv")
    .map(format)
    .slice(0, 10);
}

export async function getPopularMovies(): Promise<TmdbResult[]> {
  const data = await get("/movie/popular");
  return (data.results as TmdbItem[]).slice(0, 10).map(format);
}

export async function getPopularTV(): Promise<TmdbResult[]> {
  const data = await get("/tv/popular");
  return (data.results as TmdbItem[]).slice(0, 10).map(format);
}

export async function discoverByGenres(genreIds: number[]): Promise<TmdbResult[]> {
  const genreStr = genreIds.slice(0, 3).join(",");
  const [movies, tv] = await Promise.all([
    get("/discover/movie", { with_genres: genreStr, sort_by: "popularity.desc", "vote_count.gte": "50" }),
    get("/discover/tv", { with_genres: genreStr, sort_by: "popularity.desc", "vote_count.gte": "50" }),
  ]);
  const results: TmdbResult[] = [];
  for (const item of (movies.results as TmdbItem[]).slice(0, 6)) {
    results.push({ ...format(item), type: "movie" });
  }
  for (const item of (tv.results as TmdbItem[]).slice(0, 6)) {
    results.push({ ...format(item), type: "tv" });
  }
  // Deduplicate by id, shuffle, return top 10
  const seen = new Set<number>();
  const unique = results.filter((r) => !seen.has(r.id) && seen.add(r.id));
  return unique.sort(() => Math.random() - 0.5).slice(0, 10);
}

// ── Detail types ──

export type TmdbDetail = {
  id: number;
  title: string;
  tagline: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  rating: number;
  voteCount: number;
  year: number;
  runtime: number; // minutes
  genres: string[];
  status: string;
  type: "movie" | "tv";
  // TV-specific
  seasons?: number;
  episodes?: number;
  createdBy?: string[];
  networks?: string[];
  lastAirDate?: string;
  // Movie-specific
  budget?: number;
  revenue?: number;
  director?: string;
  // Common
  cast: { id: number; name: string; character: string; photo: string | null }[];
  similar: TmdbResult[];
  videos: { key: string; name: string; site: string; type: string }[];
};

function formatCredits(credits: { cast?: Array<{ id: number; name: string; character?: string; profile_path: string | null }>; crew?: Array<{ id: number; name: string; job: string; profile_path: string | null }> }) {
  const cast = (credits.cast || []).slice(0, 15).map((c) => ({
    id: c.id,
    name: c.name,
    character: c.character || "Unknown",
    photo: poster(c.profile_path),
  }));
  const directors = (credits.crew || [])
    .filter((c) => c.job === "Director")
    .map((d) => ({
      id: d.id,
      name: d.name,
      character: "Director",
      photo: poster(d.profile_path),
    }));
  return [...directors, ...cast];
}

// Aggregate credits (TV only) — crew.jobs is an array, cast.roles is an array
function formatAggregateCredits(aggregate: {
  cast?: Array<{ id: number; name: string; roles?: Array<{ character: string; episode_count: number }>; profile_path: string | null }>;
  crew?: Array<{ id: number; name: string; jobs?: Array<{ job: string; episode_count: number }>; profile_path: string | null }>;
}) {
  const directors = (aggregate.crew || [])
    .filter((c) => (c.jobs || []).some((j) => j.job === "Director"))
    .sort((a, b) => {
      const aEp = (a.jobs || []).find((j) => j.job === "Director")?.episode_count || 0;
      const bEp = (b.jobs || []).find((j) => j.job === "Director")?.episode_count || 0;
      return bEp - aEp; // most episodes first
    })
    .map((d) => ({
      id: d.id,
      name: d.name,
      character: "Director",
      photo: poster(d.profile_path),
    }));
  const cast = (aggregate.cast || []).slice(0, 15).map((c) => ({
    id: c.id,
    name: c.name,
    character: (c.roles || [])[0]?.character || "Unknown",
    photo: poster(c.profile_path),
  }));
  return [...directors, ...cast];
}

function formatSimilar(
  data: { results?: TmdbItem[] },
  sourceGenreIds: number[] = [],
  sourceId?: number,
  type?: "movie" | "tv",
  keywordIds: number[] = [],
): TmdbResult[] {
  const genreSet = new Set(sourceGenreIds);
  const sourceIsAnimated = sourceGenreIds.includes(16);
  const minGenreMatch = genreSet.size <= 1 ? 1 : Math.min(2, Math.ceil(genreSet.size / 2));

  // Base pool (always applied): exclude self, type filter, anime exclusion
  const base = (data.results || [])
    .filter((item) => item.id !== sourceId)
    .filter((item) => {
      if (!type) return true;
      if (type === "movie") return item.media_type === "movie" || !!item.title;
      return item.media_type === "tv" || !!item.name;
    })
    .filter((item) => sourceIsAnimated || !(item.genre_ids || []).includes(16));

  // Multi-pass with fallback: section must never be empty
  let result = runPass(base, genreSet, minGenreMatch, 2000);
  if (result.length === 0) {
    result = runPass(base, genreSet, 1, 2000);
  }
  if (result.length === 0) {
    result = runPass(base, genreSet, 1, 0);
  }
  return result;
}

function runPass(
  pool: TmdbItem[],
  genreSet: Set<number>,
  minGenre: number,
  minYear: number,
): TmdbResult[] {
  return pool
    .filter((item) => {
      if (genreSet.size === 0) return true;
      const overlap = (item.genre_ids || []).filter((gid) => genreSet.has(gid));
      return overlap.length >= minGenre;
    })
    .map(format)
    .filter((item) => item.year >= minYear)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10);
}

/** Use TMDB discover API to find genuinely similar titles by genre + keyword overlap */
async function discoverSimilar(
  genreIds: number[],
  type: "movie" | "tv",
  excludeId: number,
  keywordIds: number[] = [],
): Promise<TmdbResult[]> {
  if (genreIds.length === 0) return [];
  const genreStr = genreIds.join(",");
  const endpoint = type === "movie" ? "/discover/movie" : "/discover/tv";
  const minGenreMatch = genreIds.length <= 1 ? 1 : Math.min(2, Math.ceil(genreIds.length / 2));

  // Multi-pass with fallback
  let results = await discoverPass(endpoint, genreStr, excludeId, genreIds, minGenreMatch, keywordIds);
  if (results.length === 0 && keywordIds.length > 0) {
    results = await discoverPass(endpoint, genreStr, excludeId, genreIds, 1, []);
  }
  if (results.length === 0) {
    results = await discoverPass(endpoint, genreStr, excludeId, genreIds, 1, []);
  }
  return results;
}

async function discoverPass(
  endpoint: string,
  genreStr: string,
  excludeId: number,
  genreIds: number[],
  minGenre: number,
  keywordIds: number[],
): Promise<TmdbResult[]> {
  const params: Record<string, string> = {
    with_genres: genreStr,
    sort_by: "popularity.desc",
    "vote_count.gte": "100",
  };
  if (keywordIds.length > 0) {
    params.with_keywords = keywordIds.slice(0, 10).join(",");
  }
  try {
    const data = await get(endpoint, params);
    return (data.results as TmdbItem[])
      .filter((item) => item.id !== excludeId)
      .filter((item) => {
        const overlap = (item.genre_ids || []).filter((gid) => genreIds.includes(gid));
        return overlap.length >= minGenre;
      })
      .map(format)
      .filter((item) => item.year >= 2000)
      .slice(0, 12);
  } catch {
    return [];
  }
}

/** Fetch movies in the same TMDB collection (franchise/series) — only 1 entry */
async function getFranchiseMovies(
  collectionId: number,
  excludeId: number,
): Promise<TmdbResult[]> {
  try {
    const data = await get(`/collection/${collectionId}`);
    const parts: TmdbResult[] = (data.parts || [])
      .filter((m: TmdbItem) => m.id !== excludeId)
      .filter((m: TmdbItem) => m.release_date || m.first_air_date)
      .map(format)
      .filter((item: TmdbResult) => item.year >= 1990);
    // Return the highest-rated entry — users want ONE representative, not all sequels
    parts.sort((a, b) => b.rating - a.rating);
    return parts.slice(0, 1);
  } catch {
    return [];
  }
}

/** Merge similar API results + discover API results + franchise results,
 *  deduplicate by collection (max 1 per franchise except source). */
function mergeSimilar(
  similarResults: TmdbResult[],
  discoverResults: TmdbResult[],
  franchiseResults: TmdbResult[] = [],
  sourceCollectionId?: number,
  collectionMap?: Map<number, number>,
): TmdbResult[] {
  const seen = new Set<number>();
  const all: TmdbResult[] = [];
  const fromDiscover = new Set<number>();
  const fromFranchise = new Set<number>();

  // Franchise first (highest relevance), then discover, then similar
  for (const item of franchiseResults) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      fromFranchise.add(item.id);
      all.push(item);
    }
  }
  for (const item of discoverResults) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      fromDiscover.add(item.id);
      all.push(item);
    }
  }
  for (const item of similarResults) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      all.push(item);
    }
  }

  // Weighted score: franchise > discover popularity > rating
  const scored = all.map((item) => {
    let score = 0;
    if (fromFranchise.has(item.id)) {
      // Franchise entries get highest priority — position in series (later = higher)
      const idx = franchiseResults.findIndex(f => f.id === item.id);
      score = 1.0 - (idx / Math.max(franchiseResults.length, 1)) * 0.1;
    } else if (fromDiscover.has(item.id)) {
      const idx = discoverResults.findIndex(d => d.id === item.id);
      score = 0.5 + (1 - idx / Math.max(discoverResults.length, 1)) * 0.3;
    } else {
      score = (item.rating / 10) * 0.5;
    }
    return { item, score };
  }).sort((a, b) => b.score - a.score);

  // Deduplicate: max 1 per collection (except source's own = up to 2)
  const collectionCount = new Map<number, number>();
  const seenSeries = new Map<string, number>(); // base title → count
  const result: TmdbResult[] = [];

  // Helper: extract franchise identity — catches sequels, subtitled entries, reboots
  const franchiseKey = (title: string): string => {
    let key = title;
    // Strip year suffix: "Movie (2026)" → "Movie"
    key = key.replace(/\s*\(\d{4}\)$/, "");
    // If colon, use part before colon: "Spider-Man: Across the Spider-Verse" → "Spider-Man"
    const colonIdx = key.indexOf(":");
    if (colonIdx > 0) key = key.slice(0, colonIdx).trim();
    // Strip leading "The ": "The Avengers" → "Avengers"
    key = key.replace(/^The\s+/i, "");
    // Strip part/chapter/vol markers: "Chapter 2", "Vol 3"
    key = key.replace(/\s+(Part|Chapter|Vol|Season)\s+\d+$/i, "");
    // Strip trailing number: "Toy Story 4" → "Toy Story"
    key = key.replace(/\s+\d+$/, "");
    // Take first 2 words: "Super Mario Galaxy" → "Super Mario"
    const words = key.split(/\s+/);
    return words.slice(0, 2).join(" ");
  };

  for (const { item } of scored) {
    if (result.length >= 12) break;
    const cid = collectionMap?.get(item.id);
    if (cid !== undefined) {
      const current = collectionCount.get(cid) || 0;
      const limit = cid === sourceCollectionId ? 1 : 1;
      if (current >= limit) continue;
      collectionCount.set(cid, current + 1);
    }
    // Also deduplicate by base franchise name (for discover/similar items)
    // Skip franchise items — they're already handled by collectionCount or explicitly wanted
    if (!fromFranchise.has(item.id)) {
      const key = franchiseKey(item.title);
      const seriesCount = seenSeries.get(key) || 0;
      if (seriesCount >= 1 && key.length > 0) continue; // only 1 per franchise
      seenSeries.set(key, seriesCount + 1);
    }
    result.push(item);
  }
  return result;
}

/** Fetch keywords for a movie or TV show */
async function getKeywords(id: number, type: "movie" | "tv"): Promise<number[]> {
  try {
    const data = await get(`/${type}/${id}/keywords`);
    return ((type === "movie" ? data.keywords : data.results) || []).map(
      (k: { id: number }) => k.id,
    );
  } catch {
    return [];
  }
}

export async function getMovieDetail(id: number): Promise<TmdbDetail> {
  const [detail, credits, similar, videos, keywords] = await Promise.all([
    get(`/movie/${id}`),
    get(`/movie/${id}/credits`),
    get(`/movie/${id}/similar`),
    get(`/movie/${id}/videos`),
    getKeywords(id, "movie"),
  ]);

  const genreIds: number[] = (detail.genres || []).map((g: { id: number }) => g.id);

  // Fetch franchise/collection movies if this movie belongs to one
  const collectionId = detail.belongs_to_collection?.id;
  const franchiseResults = collectionId
    ? await getFranchiseMovies(collectionId, detail.id)
    : [];

  // Also discover similar by genre + keywords — much better than /similar alone
  const discoverResults = await discoverSimilar(genreIds, "movie", detail.id, keywords);
  const similarFiltered = formatSimilar(similar, genreIds, detail.id, "movie", keywords);

  // Build collection map from discover results (for deduplication)
  const collectionMap = new Map<number, number>();
  for (const item of discoverResults) {
    // discover items don't have collection_id directly — we'll fetch if needed
    // For now, use the franchise info from the collection API
  }

  const result = {
    id: detail.id,
    title: detail.title || "Unknown",
    tagline: detail.tagline || "",
    overview: detail.overview || "",
    poster: poster(detail.poster_path),
    backdrop: backdrop(detail.backdrop_path),
    rating: Math.round(detail.vote_average * 10) / 10,
    voteCount: detail.vote_count || 0,
    year: detail.release_date ? parseInt(detail.release_date.slice(0, 4)) : 0,
    runtime: detail.runtime || 0,
    genres: (detail.genres || []).map((g: { name: string }) => g.name),
    status: detail.status || "Unknown",
    type: "movie" as const,
    budget: detail.budget || 0,
    revenue: detail.revenue || 0,
    director: (credits.crew || []).find((c: { job: string }) => c.job === "Director")?.name || "",
    cast: formatCredits(credits),
    similar: mergeSimilar(similarFiltered, discoverResults, franchiseResults, collectionId, collectionMap),
    videos: [] as TmdbDetail["videos"],
  };

  // Validate YouTube trailers and replace broken ones
  const movieTitle = `${detail.title || ""} ${detail.release_date ? parseInt(detail.release_date.slice(0, 4)) : ""}`.trim();
  const rawVideos = (videos.results || [])
    .filter((v: { site: string; type: string }) => v.site === "YouTube" && ["Trailer", "Teaser"].includes(v.type))
    .sort((a: any, b: any) => {
      // Trailers before Teasers
      if (a.type === "Trailer" && b.type !== "Trailer") return -1;
      if (a.type !== "Trailer" && b.type === "Trailer") return 1;
      // Official before non-official within same type
      if (a.official && !b.official) return -1;
      if (!a.official && b.official) return 1;
      return 0;
    })
    .map((v: { key: string; name: string }) => ({ key: v.key, name: v.name }))
    .slice(0, 3);
  result.videos = (await validateAndReplaceTrailers(rawVideos, `${movieTitle} official trailer`))
    .map((v) => ({ key: v.key, name: v.name, site: "YouTube", type: "Trailer" }));

  return result;
}

export async function getTVDetail(id: number): Promise<TmdbDetail> {
  const [detail, credits, similar, videos, keywords, aggregateCredits] = await Promise.all([
    get(`/tv/${id}`),
    get(`/tv/${id}/credits`),
    get(`/tv/${id}/similar`),
    get(`/tv/${id}/videos`),
    getKeywords(id, "tv"),
    get(`/tv/${id}/aggregate_credits`),
  ]);

  const genreIds: number[] = (detail.genres || []).map((g: { id: number }) => g.id);

  // Also discover similar by genre + keywords — much better than /similar alone
  const discoverResults = await discoverSimilar(genreIds, "tv", detail.id, keywords);
  const similarFiltered = formatSimilar(similar, genreIds, detail.id, "tv", keywords);

  const resultTV = {
    id: detail.id,
    title: detail.name || "Unknown",
    tagline: detail.tagline || "",
    overview: detail.overview || "",
    poster: poster(detail.poster_path),
    backdrop: backdrop(detail.backdrop_path),
    rating: Math.round(detail.vote_average * 10) / 10,
    voteCount: detail.vote_count || 0,
    year: detail.first_air_date ? parseInt(detail.first_air_date.slice(0, 4)) : 0,
    runtime: detail.episode_run_time?.[0] || 0,
    genres: (detail.genres || []).map((g: { name: string }) => g.name),
    status: detail.status || "Unknown",
    type: "tv" as const,
    seasons: detail.number_of_seasons || 0,
    episodes: detail.number_of_episodes || 0,
    createdBy: (detail.created_by || []).map((c: { name: string }) => c.name),
    networks: (detail.networks || []).map((n: { name: string }) => n.name),
    lastAirDate: detail.last_air_date || "",
    cast: formatAggregateCredits(aggregateCredits),
    similar: mergeSimilar(similarFiltered, discoverResults),
    videos: [] as TmdbDetail["videos"],
  };

  // Validate YouTube trailers and replace broken ones
  const tvTitle = `${detail.name || ""} ${detail.first_air_date ? parseInt(detail.first_air_date.slice(0, 4)) : ""}`.trim();
  const rawVideos = (videos.results || [])
    .filter((v: { site: string; type: string }) => v.site === "YouTube" && ["Trailer", "Teaser"].includes(v.type))
    .sort((a: any, b: any) => {
      if (a.type === "Trailer" && b.type !== "Trailer") return -1;
      if (a.type !== "Trailer" && b.type === "Trailer") return 1;
      if (a.official && !b.official) return -1;
      if (!a.official && b.official) return 1;
      return 0;
    })
    .map((v: { key: string; name: string }) => ({ key: v.key, name: v.name }))
    .slice(0, 3);
  resultTV.videos = (await validateAndReplaceTrailers(rawVideos, `${tvTitle} official trailer`))
    .map((v) => ({ key: v.key, name: v.name, site: "YouTube", type: "Trailer" }));

  return resultTV;
}

// ── TV Season types ──

export type TvSeasonDetail = {
  id: number;
  seriesId: number;
  seriesTitle: string;
  seasonNumber: number;
  totalSeasons: number;
  name: string;
  overview: string;
  poster: string | null;
  rating: number;
  voteCount: number;
  airDate: string;
  episodes: {
    number: number;
    name: string;
    overview: string;
    still: string | null;
    rating: number;
    voteCount: number;
    airDate: string;
    runtime: number;
  }[];
};

export async function getTVSeason(
  seriesId: number,
  seasonNumber: number,
): Promise<TvSeasonDetail | null> {
  try {
    const [seasonData, seriesData] = await Promise.all([
      get(`/tv/${seriesId}/season/${seasonNumber}`),
      get(`/tv/${seriesId}`),
    ]);
    return {
      id: seasonData.id,
      seriesId,
      seriesTitle: seriesData.name || "Unknown",
      seasonNumber: seasonData.season_number || seasonNumber,
      totalSeasons: seriesData.number_of_seasons || 0,
      name: seasonData.name || `Season ${seasonNumber}`,
      overview: seasonData.overview || "",
      poster: poster(seasonData.poster_path) || poster(seriesData.poster_path),
      rating: Math.round((seasonData.vote_average || 0) * 10) / 10,
      voteCount: seasonData.vote_count || 0,
      airDate: seasonData.air_date || "",
      episodes: (seasonData.episodes || []).map((ep: {
        episode_number: number;
        name: string;
        overview: string;
        still_path: string | null;
        vote_average: number;
        vote_count: number;
        air_date: string;
        runtime: number;
      }) => ({
        number: ep.episode_number,
        name: ep.name || `Episode ${ep.episode_number}`,
        overview: ep.overview || "",
        still: poster(ep.still_path),
        rating: Math.round((ep.vote_average || 0) * 10) / 10,
        voteCount: ep.vote_count || 0,
        airDate: ep.air_date || "",
        runtime: ep.runtime || 0,
      })),
    };
  } catch {
    return null;
  }
}

// ── Person types ──

export type PersonDetail = {
  id: number;
  name: string;
  photo: string | null;
  birthday: string;
  deathday: string;
  birthplace: string;
  biography: string;
  knownFor: string;
  movieCredits: {
    id: number;
    title: string;
    character: string;
    year: number;
    poster: string | null;
    rating: number;
  }[];
  tvCredits: {
    id: number;
    title: string;
    character: string;
    year: number;
    poster: string | null;
    rating: number;
  }[];
};

export async function getPersonDetail(id: number): Promise<PersonDetail | null> {
  try {
    const [detail, movieCredits, tvCredits] = await Promise.all([
      get(`/person/${id}`),
      get(`/person/${id}/movie_credits`),
      get(`/person/${id}/tv_credits`),
    ]);

    // Process movie credits — merge cast + crew, deduplicate, prefer crew for matching department
    const movieSeen = new Map<number, { id: number; title: string; character: string; year: number; poster: string | null; rating: number; isCrew: boolean }>();
    
    // Add cast first
    for (const c of (movieCredits.cast || []).filter((c: { release_date?: string }) => c.release_date)) {
      movieSeen.set(c.id, {
        id: c.id,
        title: c.title,
        character: c.character || "",
        year: new Date(c.release_date!).getFullYear(),
        poster: poster(c.poster_path),
        rating: Math.round(c.vote_average * 10) / 10,
        isCrew: false,
      });
    }
    
    // Add crew — overwrites cast when department matches knownFor
    const knownDept = detail.known_for_department || "";
    for (const c of (movieCredits.crew || []).filter((c: { release_date?: string }) => c.release_date)) {
      const existing = movieSeen.get(c.id);
      const isDirector = knownDept === "Directing" && c.job === "Director";
      if (!existing || isDirector) {
        movieSeen.set(c.id, {
          id: c.id,
          title: c.title,
          character: c.job || "",
          year: new Date(c.release_date!).getFullYear(),
          poster: poster(c.poster_path),
          rating: Math.round(c.vote_average * 10) / 10,
          isCrew: true,
        });
      }
    }
    
    const movieList = Array.from(movieSeen.values())
      .sort((a, b) => b.year - a.year)
      .slice(0, 30);

    // Process TV credits — merge cast + crew, deduplicate, prefer crew for matching department
    const tvSeen = new Map<number, { id: number; title: string; character: string; year: number; poster: string | null; rating: number }>();
    
    for (const c of (tvCredits.cast || []).filter((c: { first_air_date?: string }) => c.first_air_date)) {
      tvSeen.set(c.id, {
        id: c.id,
        title: c.name,
        character: c.character || "",
        year: new Date(c.first_air_date!).getFullYear(),
        poster: poster(c.poster_path),
        rating: Math.round(c.vote_average * 10) / 10,
      });
    }
    
    for (const c of (tvCredits.crew || []).filter((c: { first_air_date?: string }) => c.first_air_date)) {
      const existing = tvSeen.get(c.id);
      const isDirector = knownDept === "Directing" && c.job === "Director";
      if (!existing || isDirector) {
        tvSeen.set(c.id, {
          id: c.id,
          title: c.name,
          character: c.job || "",
          year: new Date(c.first_air_date!).getFullYear(),
          poster: poster(c.poster_path),
          rating: Math.round(c.vote_average * 10) / 10,
        });
      }
    }
    
    const tvList = Array.from(tvSeen.values())
      .sort((a, b) => b.year - a.year)
      .slice(0, 30);

    return {
      id: detail.id,
      name: detail.name,
      photo: poster(detail.profile_path),
      birthday: detail.birthday || "",
      deathday: detail.deathday || "",
      birthplace: detail.place_of_birth || "",
      biography: (detail.biography || "").slice(0, 500),
      knownFor: detail.known_for_department || "Acting",
      movieCredits: movieList,
      tvCredits: tvList,
    };
  } catch {
    return null;
  }
}

// ── Anime TV detection ──
const animeTVCache = new Map<number, boolean>();

/** Check if a TMDB TV show is actually Japanese anime (Animation genre 16 + JP origin) */
export async function isAnimeTV(tmdbId: number): Promise<boolean> {
  if (animeTVCache.has(tmdbId)) return animeTVCache.get(tmdbId)!;
  try {
    const detail = await get(`/tv/${tmdbId}`);
    const genres: number[] = (detail.genres || []).map((g: any) => g.id);
    const countries: string[] = detail.origin_country || [];
    const isAnime = genres.includes(16) && countries.includes("JP");
    animeTVCache.set(tmdbId, isAnime);
    return isAnime;
  } catch {
    animeTVCache.set(tmdbId, false);
    return false;
  }
}