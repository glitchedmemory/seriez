import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GENRE_MAP, discoverByGenres, type TmdbResult, type TmdbItem } from "@/lib/tmdb";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── AniList helpers ───

const ANILIST_API = "https://graphql.anilist.co";

const ANILIST_RECS_QUERY = `
query($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    title { romaji english }
    recommendations(sort: RATING_DESC) {
      nodes {
        mediaRecommendation {
          id
          title { romaji english }
          coverImage { extraLarge }
          bannerImage
          averageScore
          seasonYear
          description
          genres
        }
      }
    }
  }
}`;

async function fetchAnimeRecs(anilistId: number): Promise<TmdbResult[]> {
  try {
    const res = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: ANILIST_RECS_QUERY, variables: { id: anilistId } }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const nodes = json.data?.Media?.recommendations?.nodes || [];
    return nodes.map((n: any) => {
      const m = n.mediaRecommendation;
      return {
        id: m.id,
        title: m.title?.english || m.title?.romaji || "Unknown",
        poster: m.coverImage?.extraLarge || m.coverImage?.large || null,
        backdrop: m.bannerImage || null,
        rating: Math.round((m.averageScore / 10) * 10) / 10 || 0,
        year: m.seasonYear || 0,
        type: "anime" as const,
        overview: (m.description || "").replace(/<[^>]*>/g, "").slice(0, 300),
        genres: (m.genres || []).slice(0, 5),
        daysUntil: null,
      };
    });
  } catch {
    return [];
  }
}

// ─── TMDB helpers ───

async function tmdbGet(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${endpoint}`);
  return res.json();
}

function formatResult(item: TmdbItem, type: "movie" | "tv"): TmdbResult {
  const title = item.title || item.name || "Unknown";
  const year = parseInt((item.release_date || item.first_air_date || "0").slice(0, 4));
  return {
    id: item.id,
    title,
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w780${item.poster_path}` : null,
    backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
    rating: Math.round(item.vote_average * 10) / 10,
    year: year || 0,
    type,
    overview: item.overview || "",
    genres: (item.genre_ids || []).map((gid: number) => GENRE_MAP[gid] || "").filter(Boolean),
    daysUntil: null,
  };
}

// ─── Source A: Similar titles ───

async function fetchSimilar(tmdbId: number, mediaType: string): Promise<{ items: TmdbResult[]; reason: string }> {
  try {
    const endpoint = mediaType === "movie" ? `/movie/${tmdbId}/similar` : `/tv/${tmdbId}/similar`;
    const data = await tmdbGet(endpoint);
    const items: TmdbResult[] = (data.results || []).slice(0, 8).map((item: TmdbItem) =>
      formatResult(item, mediaType as "movie" | "tv")
    );
    return { items, reason: "" };
  } catch {
    return { items: [], reason: "" };
  }
}

// ─── Source B: TMDB Recommendations ───

async function fetchRecommendations(tmdbId: number, mediaType: string): Promise<{ items: TmdbResult[]; reason: string }> {
  try {
    const endpoint = mediaType === "movie" ? `/movie/${tmdbId}/recommendations` : `/tv/${tmdbId}/recommendations`;
    const data = await tmdbGet(endpoint);
    const items: TmdbResult[] = (data.results || []).slice(0, 8).map((item: TmdbItem) =>
      formatResult(item, mediaType as "movie" | "tv")
    );
    return { items, reason: "" };
  } catch {
    return { items: [], reason: "" };
  }
}

// ─── Scoring ───

interface ScoredItem {
  item: TmdbResult;
  score: number;
  reason: string;
  sourceWeight: number;
}

function scoreAndRank(
  candidates: Map<number, ScoredItem>,
  userGenreIds: number[],
  ratedGenreIds: number[]
): TmdbResult[] {
  const scored = Array.from(candidates.values()).map((c) => {
    const tmdbRating = c.item.rating;
    const itemGenreIds = c.item.genres
      .map((g) => Object.entries(GENRE_MAP).find(([, name]) => name === g)?.[0])
      .filter(Boolean)
      .map(Number);

    // Genre match (0-1)
    const genreMatches = itemGenreIds.filter((gid) => userGenreIds.includes(gid)).length;
    const genreMatchRatio = userGenreIds.length > 0 ? genreMatches / Math.min(userGenreIds.length, 5) : 0;

    // Already in user genres bonus
    const inRatedGenres = itemGenreIds.filter((gid) => ratedGenreIds.includes(gid)).length;

    const score =
      c.sourceWeight * 10 +
      (tmdbRating - 7.0) * 2 +
      Math.log((tmdbRating > 0 ? tmdbRating * 100 : 100) + 1) * 0.5 +
      genreMatchRatio * 3 +
      inRatedGenres * 1.5 +
      (c.item.year >= 2025 ? 2 : 0); // recency bonus

    return { ...c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 14).map((s) => s.item);
}

// ─── Main ───

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = await resolveUsername(req);

  if (!username?.trim()) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  const name = username.trim();
  const ratedIds = new Set<number>();
  const genreCounts: Record<number, number> = {};
  const topTitles: { tmdbId: number; mediaType: string; rating: number; title: string }[] = [];

  // ── 1. Reviews (rated items — 2x weight) ──
  const { data: reviews } = await supabase
    .from("reviews")
    .select("tmdb_id, media_type, rating")
    .eq("username", name)
    .order("created_at", { ascending: false })
    .limit(30);

  if (reviews?.length) {
    for (const r of reviews) {
      if (ratedIds.has(r.tmdb_id)) continue;
      ratedIds.add(r.tmdb_id);
      if (r.rating >= 4 && topTitles.length < 5) {
        topTitles.push({ tmdbId: r.tmdb_id, mediaType: r.media_type, rating: r.rating, title: "" });
      }
      try {
        const ep = r.media_type === "movie" ? `/movie/${r.tmdb_id}` : `/tv/${r.tmdb_id}`;
        const detail = await tmdbGet(ep);
        // Store title for reason
        const match = topTitles.find((t) => t.tmdbId === r.tmdb_id);
        if (match) match.title = detail.title || detail.name || "";
        for (const g of detail.genres || []) {
          genreCounts[g.id] = (genreCounts[g.id] || 0) + 2;
        }
      } catch { /* skip */ }
    }
  }

  // ── 2. Tracking (watching/completed — 1x) ──
  const { data: tracking } = await supabase
    .from("media_trackings")
    .select("tmdb_id, media_type, status")
    .eq("username", name)
    .in("status", ["watching", "completed"]);

  if (tracking?.length) {
    for (const t of tracking) {
      if (ratedIds.has(t.tmdb_id)) continue;
      ratedIds.add(t.tmdb_id);
      if (topTitles.length < 5) {
        topTitles.push({ tmdbId: t.tmdb_id, mediaType: t.media_type, rating: 0, title: "" });
      }
      try {
        const ep = t.media_type === "movie" ? `/movie/${t.tmdb_id}` : `/tv/${t.tmdb_id}`;
        const detail = await tmdbGet(ep);
        const match = topTitles.find((x) => x.tmdbId === t.tmdb_id);
        if (match) match.title = detail.title || detail.name || "";
        for (const g of detail.genres || []) {
          genreCounts[g.id] = (genreCounts[g.id] || 0) + 1;
        }
      } catch { /* skip */ }
    }
  }

  // ── 3. Plan to watch (0.5x) ──
  const { data: planToWatch } = await supabase
    .from("media_trackings")
    .select("tmdb_id, media_type")
    .eq("username", name)
    .eq("status", "plan_to_watch");

  if (planToWatch?.length) {
    for (const p of planToWatch) {
      if (ratedIds.has(p.tmdb_id)) continue;
      ratedIds.add(p.tmdb_id);
      try {
        const ep = p.media_type === "movie" ? `/movie/${p.tmdb_id}` : `/tv/${p.tmdb_id}`;
        const detail = await tmdbGet(ep);
        for (const g of detail.genres || []) {
          genreCounts[g.id] = (genreCounts[g.id] || 0) + 0.5;
        }
      } catch { /* skip */ }
    }
  }

  // ── 4. Anime genre profiling ──
  // Collect anime IDs (stored in tmdb_id with media_type="anime")
  const animeTop: { anilistId: number; rating: number; title: string; weight: number }[] = [];
  const seenAnime = new Set<number>();

  // From reviews (2x weight)
  for (const r of reviews || []) {
    if (r.media_type !== "anime" || seenAnime.has(r.tmdb_id)) continue;
    seenAnime.add(r.tmdb_id);
    if (r.rating >= 4 && animeTop.length < 5) {
      animeTop.push({ anilistId: r.tmdb_id, rating: r.rating, title: "", weight: 2 });
    }
    // Fetch genre from AniList
    try {
      const aRes = await fetch(ANILIST_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `query($id:Int){Media(id:$id){title{romaji english}genres}}`, variables: { id: r.tmdb_id } }),
      });
      const aJson = await aRes.json();
      const anGenres: string[] = aJson.data?.Media?.genres || [];
      const anTitle = aJson.data?.Media?.title?.english || aJson.data?.Media?.title?.romaji || "";
      const match = animeTop.find((x) => x.anilistId === r.tmdb_id);
      if (match && anTitle) match.title = anTitle;
      for (const g of anGenres) {
        const gid = Object.entries(GENRE_MAP).find(([, name]) => name === g)?.[0];
        if (gid) genreCounts[parseInt(gid)] = (genreCounts[parseInt(gid)] || 0) + 2;
      }
    } catch { /* skip */ }
  }

  // From tracking (1x weight)
  for (const t of tracking || []) {
    if (t.media_type !== "anime" || seenAnime.has(t.tmdb_id)) continue;
    seenAnime.add(t.tmdb_id);
    if (animeTop.length < 5) {
      animeTop.push({ anilistId: t.tmdb_id, rating: 0, title: "", weight: 1 });
    }
    try {
      const aRes = await fetch(ANILIST_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `query($id:Int){Media(id:$id){title{romaji english}genres}}`, variables: { id: t.tmdb_id } }),
      });
      const aJson = await aRes.json();
      const anGenres: string[] = aJson.data?.Media?.genres || [];
      const anTitle = aJson.data?.Media?.title?.english || aJson.data?.Media?.title?.romaji || "";
      const match = animeTop.find((x) => x.anilistId === t.tmdb_id);
      if (match && anTitle) match.title = anTitle;
      for (const g of anGenres) {
        const gid = Object.entries(GENRE_MAP).find(([, name]) => name === g)?.[0];
        if (gid) genreCounts[parseInt(gid)] = (genreCounts[parseInt(gid)] || 0) + 1;
      }
    } catch { /* skip */ }
  }

  // From plan to watch (0.5x weight)
  for (const p of planToWatch || []) {
    if (p.media_type !== "anime" || seenAnime.has(p.tmdb_id)) continue;
    seenAnime.add(p.tmdb_id);
    try {
      const aRes = await fetch(ANILIST_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `query($id:Int){Media(id:$id){genres}}`, variables: { id: p.tmdb_id } }),
      });
      const aJson = await aRes.json();
      for (const g of (aJson.data?.Media?.genres || [])) {
        const gid = Object.entries(GENRE_MAP).find(([, name]) => name === g)?.[0];
        if (gid) genreCounts[parseInt(gid)] = (genreCounts[parseInt(gid)] || 0) + 0.5;
      }
    } catch { /* skip */ }
  }

  // ── Top genres ──
  const topGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id]) => parseInt(id));

  const userGenreIds = topGenres.slice(0, 3);
  const genreNames = userGenreIds.map((id) => GENRE_MAP[id] || String(id));

  // No data at all
  if (topGenres.length === 0) {
    return NextResponse.json({
      items: [],
      genres: [],
      reason: reviews?.length || tracking?.length
        ? "Discovery service temporarily unavailable"
        : "Rate or track some titles to get personalized recommendations",
    });
  }

  // ── 4. Multi-Source Collection ──
  const candidates = new Map<number, ScoredItem>();

  function addCandidate(item: TmdbResult, sourceWeight: number, reason: string) {
    if (ratedIds.has(item.id)) return;
    if (!item.poster) return;
    const existing = candidates.get(item.id);
    if (existing && existing.sourceWeight >= sourceWeight) return;
    candidates.set(item.id, { item, score: 0, reason, sourceWeight });
  }

  // Source A: Similar titles (weight 3x)
  const similarPromises = topTitles.slice(0, 5).map(async (t) => {
    const { items } = await fetchSimilar(t.tmdbId, t.mediaType);
    const reason = t.title ? `Because you liked ${t.title}` : `Similar to your taste`;
    return { items, reason };
  });
  const similarResults = await Promise.all(similarPromises);
  for (const { items, reason } of similarResults) {
    for (const item of items) addCandidate(item, 3, reason);
  }

  // Source B: Recommendations (weight 2x)
  const recPromises = topTitles.slice(0, 5).map(async (t) => {
    const { items } = await fetchRecommendations(t.tmdbId, t.mediaType);
    const reason = "Recommended for you";
    return { items, reason };
  });
  const recResults = await Promise.all(recPromises);
  for (const { items, reason } of recResults) {
    for (const item of items) addCandidate(item, 2, reason);
  }

  // Source C: Genre discovery (weight 1x)
  if (candidates.size < 10) {
    try {
      const genreItems = await discoverByGenres(userGenreIds);
      for (const item of genreItems) {
        addCandidate(item, 1, `Since you like ${genreNames.slice(0, 2).join(" & ")}`);
      }
    } catch { /* skip */ }
  }

  // Source D: Trending (weight 0.5x — cold start or not enough)
  if (candidates.size < 6) {
    try {
      const [trendingMovies, trendingTV] = await Promise.all([
        tmdbGet("/trending/movie/week"),
        tmdbGet("/trending/tv/week"),
      ]);
      const trendingItems: TmdbResult[] = [];
      for (const item of (trendingMovies.results || []).slice(0, 5)) {
        trendingItems.push(formatResult(item, "movie"));
      }
      for (const item of (trendingTV.results || []).slice(0, 5)) {
        trendingItems.push(formatResult(item, "tv"));
      }
      for (const item of trendingItems) {
        addCandidate(item, 0.5, "Trending this week");
      }
    } catch { /* skip */ }
  }

  // Source E: AniList Recommendations (weight 3x)
  if (animeTop.length > 0) {
    const animeRecsPromises = animeTop.slice(0, 3).map(async (a) => {
      const recs = await fetchAnimeRecs(a.anilistId);
      const reason = a.title ? `Since you liked ${a.title}` : "Anime you might enjoy";
      return { items: recs, reason };
    });
    const animeRecsResults = await Promise.all(animeRecsPromises);
    for (const { items, reason } of animeRecsResults) {
      for (const item of items) {
        addCandidate(item, 3, reason);
      }
    }
  }

  // ── 5. Score & Rank ──
  const ranked = scoreAndRank(candidates, userGenreIds, topGenres);

  // Build reason map
  const reasons: Record<number, string> = {};
  for (const item of ranked) {
    const c = candidates.get(item.id);
    if (c?.reason) reasons[item.id] = c.reason;
  }

  return NextResponse.json({ items: ranked, genres: genreNames, reasons });
}
