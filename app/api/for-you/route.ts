import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GENRE_MAP, discoverByGenres, type TmdbResult, type TmdbItem, tmdbGet } from "@/lib/tmdb";
import { resolveUsername } from "@/lib/auth-helper";
import { resolveUserId } from "@/lib/user-utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
// media_trackings SELECT is RLS-gated to the row owner (auth.uid()=username);
// the anon key reads 0 rows. Use the service role to bypass RLS for reading
// a user's own tracking (writes already go through the service role in /api/track).
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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
    const items: TmdbResult[] = (data.results || []).filter((item: TmdbItem) => !(item.genre_ids?.includes(16) && item.original_language === "ja")).slice(0, 8).map((item: TmdbItem) =>
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
    const items: TmdbResult[] = (data.results || []).filter((item: TmdbItem) => !(item.genre_ids?.includes(16) && item.original_language === "ja")).slice(0, 8).map((item: TmdbItem) =>
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
  ratedGenreIds: number[],
  ratedTypeCounts?: Record<string, number>
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

  // Balance the final board by type so the mix mirrors what the user actually
  // rated with 4★ (movie-heavy user → movie-heavy board), instead of letting
  // one source (e.g. AniList 3x) dominate and flood a single type.
  if (ratedTypeCounts) {
    const totalRated = Object.values(ratedTypeCounts).reduce((a, b) => a + b, 0);
    if (totalRated > 0) {
      const TARGET = 14;
      const quota: Record<string, number> = {};
      for (const [type, cnt] of Object.entries(ratedTypeCounts)) {
        quota[type] = cnt > 0 ? Math.max(1, Math.round((cnt / totalRated) * TARGET)) : 0;
      }
      const picked: typeof scored = [];
      const typeUsed: Record<string, number> = {};
      for (const s of scored) {
        if (picked.length >= TARGET) break;
        const t = s.item.type;
        const used = typeUsed[t] || 0;
        const allow = (quota[t] || 0) > used;
        // Always keep at least 1 slot for every type the user rated, even if
        // quota round to 0 for a tiny minority type.
        const keepMinimum = ratedTypeCounts[t] > 0 && !Object.keys(typeUsed).includes(t);
        if (allow || keepMinimum) {
          picked.push(s);
          typeUsed[t] = used + 1;
        }
      }
      // If underfilled (e.g. only anime candidates exist), top up in score order.
      for (const s of scored) {
        if (picked.length >= TARGET) break;
        if (!picked.includes(s)) picked.push(s);
      }
      return picked.map((s) => s.item);
    }
  }

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
  // media_trackings.username is a UUID, not the display name — resolve the real id
  // (resolveUserId falls back to the deterministic hash UUID when no users row exists).
  const userId = (await resolveUserId(name)) || name;
  const ratedIds = new Set<number>();
  const genreCounts: Record<number, number> = {};
  const topTitles: { tmdbId: number; mediaType: string; rating: number; title: string }[] = [];
  // Types the user rated 4★+ (only recommend within these types)
  const ratedTypes = new Set<string>();
  // Count of 4★ titles per media type — used to balance the final board so
  // the mix matches what the user actually rates (movie-heavy → movie-heavy).
  const ratedTypeCounts: Record<string, number> = { movie: 0, tv: 0, anime: 0 };
  let highRatedCount = 0;

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
      if (r.rating >= 4) {
        highRatedCount++;
        // anime appears in media_type="anime"; TMDB media_type is movie|tv
        const t = r.media_type === "anime" ? "anime" : r.media_type === "tv" ? "tv" : "movie";
        ratedTypes.add(t);
        ratedTypeCounts[t] = (ratedTypeCounts[t] || 0) + 1;
        if (topTitles.length < 5) {
          topTitles.push({ tmdbId: r.tmdb_id, mediaType: r.media_type, rating: r.rating, title: "" });
        }
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
  const { data: tracking } = await supabaseAdmin
    .from("media_trackings")
    .select("tmdb_id, media_type, status, rating")
    .eq("username", userId)
    .in("status", ["watching", "completed"]);

  if (tracking?.length) {
    for (const t of tracking) {
      if (ratedIds.has(t.tmdb_id)) continue;
      ratedIds.add(t.tmdb_id);
      // A 4★ rating on a tracked/watched title counts toward personalization
      // and toward the user's rated-type set (movies/tv/anime).
      if (t.rating >= 4) {
        highRatedCount++;
        const ratedT = t.media_type === "anime" ? "anime" : t.media_type === "tv" ? "tv" : "movie";
        ratedTypes.add(ratedT);
        ratedTypeCounts[ratedT] = (ratedTypeCounts[ratedT] || 0) + 1;
      }
      // Prefer 4★ titles in topTitles so the "similar to" seeds match the
      // user's strongest preferences. Only fall back to lower-rated ones if
      // we still have room after all 4★ titles.
      const wantTopTitle =
        (t.rating >= 4 && !topTitles.some((x) => x.tmdbId === t.tmdb_id)) ||
        (topTitles.filter((x) => x.rating >= 4).length < 1 && topTitles.length < 5 && !topTitles.some((x) => x.tmdbId === t.tmdb_id));
      if (wantTopTitle && topTitles.length < 5) {
        topTitles.push({ tmdbId: t.tmdb_id, mediaType: t.media_type, rating: t.rating || 0, title: "" });
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
  const { data: planToWatch } = await supabaseAdmin
    .from("media_trackings")
    .select("tmdb_id, media_type")
    .eq("username", userId)
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

  // Personalization requires 3+ high-rated (4★) titles across rated types.
  // Otherwise fall back to trending on the client (cold start protection).
  if (highRatedCount < 3 || topGenres.length === 0 || ratedTypes.size === 0) {
    return NextResponse.json({
      items: [],
      genres: [],
      reason: highRatedCount < 3
        ? "Rate at least 3 titles with 4★ to unlock personalized recommendations"
        : reviews?.length || tracking?.length
          ? "Discovery service temporarily unavailable"
          : "Rate or track some titles to get personalized recommendations",
    });
  }

  // Only surfaces from media types the user actually rated 4★.
  const allowedTypes = ratedTypes;

  // ── 4. Multi-Source Collection ──
  const candidates = new Map<number, ScoredItem>();

  function addCandidate(item: TmdbResult, sourceWeight: number, reason: string) {
    if (ratedIds.has(item.id)) return;
    if (!item.poster) return;
    if (!allowedTypes.has(item.type)) return;
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
      for (const item of (trendingMovies.results || []).filter((item: any) => !(item.genre_ids?.includes(16) && item.original_language === "ja")).slice(0, 5)) {
        trendingItems.push(formatResult(item, "movie"));
      }
      for (const item of (trendingTV.results || []).filter((item: any) => !(item.genre_ids?.includes(16) && item.original_language === "ja")).slice(0, 5)) {
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
  const ranked = scoreAndRank(candidates, userGenreIds, topGenres, ratedTypeCounts);

  // Build reason map
  const reasons: Record<number, string> = {};
  for (const item of ranked) {
    const c = candidates.get(item.id);
    if (c?.reason) reasons[item.id] = c.reason;
  }

  return NextResponse.json({ items: ranked, genres: genreNames, reasons });
}
