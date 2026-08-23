import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GENRE_MAP, discoverByGenres, type TmdbResult, type TmdbItem, tmdbGet } from "@/lib/tmdb";
import { resolveUsername } from "@/lib/auth-helper";
import { resolveUserId } from "@/lib/user-utils";
import { persistentCache } from "@/lib/persistent-cache";

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
  return persistentCache("foryou", ["animeRecs", anilistId], 86400, async () => {
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
  });
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

// ─── Persistent TMDB detail (movie/tv) — shared on disk across all users ───
interface TmdbDetailShape {
  title?: string;
  name?: string;
  genres?: { id: number; name: string }[];
}

async function tmdbDetailPersistent(tmdbId: number, mediaType: string): Promise<TmdbDetailShape> {
  return persistentCache("foryou", ["detail", tmdbId, mediaType], 86400, async () => {
    try {
      const ep = mediaType === "movie" ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
      return await tmdbGet(ep);
    } catch {
      return {};
    }
  });
}

// ─── Persistent AniList genre lookup (anime) — shared on disk across all users ───
async function anilistGenresPersistent(anilistId: number): Promise<{ genres: string[]; title: string }> {
  return persistentCache("foryou", ["anilistGenres", anilistId], 86400, async () => {
    try {
      const aRes = await fetch(ANILIST_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `query($id:Int){Media(id:$id){title{romaji english}genres}}`, variables: { id: anilistId } }),
      });
      const aJson = await aRes.json();
      const m = aJson.data?.Media;
      return { genres: m?.genres || [], title: m?.title?.english || m?.title?.romaji || "" };
    } catch {
      return { genres: [], title: "" };
    }
  });
}

// ─── Source A: Similar titles ───

async function fetchSimilar(tmdbId: number, mediaType: string): Promise<{ items: TmdbResult[]; reason: string }> {
  return persistentCache("foryou", ["similar", tmdbId, mediaType], 86400, async () => {
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
  });
}

// ─── Source B: TMDB Recommendations ───

async function fetchRecommendations(tmdbId: number, mediaType: string): Promise<{ items: TmdbResult[]; reason: string }> {
  return persistentCache("foryou", ["recs", tmdbId, mediaType], 86400, async () => {
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
  });
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
  // rated with 3.5★ (movie-heavy user → movie-heavy board), instead of letting
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
        // Stop once we have a generous over-provisioned pool (year balancing
        // happens downstream, so we need MORE than the final 14 here).
        if (picked.length >= 40) break;
      }
      // Top up in score order to a generous pool (post-2000 may be sparse —
      // a large pool guarantees the 7:3 fill can still find enough of each).
      for (const s of scored) {
        if (picked.length >= 40) break;
        if (!picked.includes(s)) picked.push(s);
      }
      return picked.map((s) => s.item);
    }
  }

  return scored.map((s) => s.item);
}

// ─── Main ───

export async function GET(req: NextRequest) {
  const username = await resolveUsername(req);

  if (!username?.trim()) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  const name = username.trim();
  // media_trackings.username is a UUID, not the display name — resolve the real id
  // (resolveUserId falls back to the deterministic hash UUID when no users row exists).
  const userId = (await resolveUserId(name)) || name;

  // ── Version gate: only 3.5★+ trackings change the board. ──
  // Compute a cheap "version" = the latest updated_at among the user's 3.5★+
  // watching/completed trackings. When it matches the cached version we return
  // the stored board instantly (no DB scans, no TMDB/AniList calls, no scoring).
  // The 3.5★ count lookup doubles as the activation check (needs 3+).
  const { data: ratedRows } = await supabaseAdmin
    .from("media_trackings")
    .select("updated_at")
    .eq("username", userId)
    .in("status", ["watching", "completed"])
    .gte("rating", 3.5);

  const ratedCount = ratedRows?.length || 0;
  if (ratedCount < 3) {
    return NextResponse.json({
      items: [],
      genres: [],
      reason: "Rate at least 3 titles with 3.5★ to unlock personalized recommendations",
    });
  }

  const version = ratedRows
    ? (ratedRows.map((r) => r.updated_at ?? "").sort().pop() || "v0") + `#n${ratedCount}`
    : "v0";

  const board = await persistentCache("foryouBoard", [userId, version], 86400, () => computeBoard(userId));

  return NextResponse.json(board);
}

interface RatedTitle { tmdbId: number; mediaType: string; rating: number; title: string }

async function computeBoard(userId: string): Promise<{ items: TmdbResult[]; genres: string[]; reasons: Record<number, string> }> {
  const ratedIds = new Set<number>();
  const genreCounts: Record<number, number> = {};
  const topTitles: RatedTitle[] = [];
  // Types the user rated 3.5★+ (only recommend within these types)
  const ratedTypes = new Set<string>();
  // Count of 3.5★ titles per media type — used to balance the final board so
  // the mix matches what the user actually rates (movie-heavy → movie-heavy).
  const ratedTypeCounts: Record<string, number> = { movie: 0, tv: 0, anime: 0 };
  let highRatedCount = 0;

  // ── 1. Tracking (watching/completed — user's own star rating is the ONLY signal) ──
  // Only 3.5★+ rated titles influence personalization (reviews no longer carry a rating).
  const { data: tracking } = await supabaseAdmin
    .from("media_trackings")
    .select("tmdb_id, media_type, status, rating")
    .eq("username", userId)
    .in("status", ["watching", "completed"]);

  if (tracking?.length) {
    for (const t of tracking) {
      if (ratedIds.has(t.tmdb_id)) continue;
      ratedIds.add(t.tmdb_id);
      // Below 3.5★ (or unrated) does nothing for For You.
      if (!t.rating || t.rating < 3.5) continue;
      highRatedCount++;
      const ratedT = t.media_type === "anime" ? "anime" : t.media_type === "tv" ? "tv" : "movie";
      ratedTypes.add(ratedT);
      ratedTypeCounts[ratedT] = (ratedTypeCounts[ratedT] || 0) + 1;
      if (topTitles.length < 5 && !topTitles.some((x) => x.tmdbId === t.tmdb_id)) {
        topTitles.push({ tmdbId: t.tmdb_id, mediaType: t.media_type, rating: t.rating, title: "" });
      }
      try {
        const detail = await tmdbDetailPersistent(t.tmdb_id, t.media_type);
        const match = topTitles.find((x) => x.tmdbId === t.tmdb_id);
        if (match) match.title = detail.title || detail.name || "";
        for (const g of detail.genres || []) {
          genreCounts[g.id] = (genreCounts[g.id] || 0) + 1;
        }
      } catch { /* skip */ }
    }
  }

  // ── 2. Anime genre profiling (only from 3.5★+ tracked titles) ──
  const animeTop: { anilistId: number; rating: number; title: string; weight: number }[] = [];
  const seenAnime = new Set<number>();

  for (const t of tracking || []) {
    if (t.media_type !== "anime" || !t.rating || t.rating < 3.5) continue;
    if (seenAnime.has(t.tmdb_id)) continue;
    seenAnime.add(t.tmdb_id);
    if (animeTop.length < 5) {
      animeTop.push({ anilistId: t.tmdb_id, rating: t.rating, title: "", weight: 1 });
    }
    try {
      const a = await anilistGenresPersistent(t.tmdb_id);
      const anGenres: string[] = a.genres;
      const anTitle = a.title;
      const match = animeTop.find((x) => x.anilistId === t.tmdb_id);
      if (match && anTitle) match.title = anTitle;
      for (const g of anGenres) {
        const gid = Object.entries(GENRE_MAP).find(([, name]) => name === g)?.[0];
        if (gid) genreCounts[parseInt(gid)] = (genreCounts[parseInt(gid)] || 0) + 1;
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

  // Personalization requires 3+ high-rated (3.5★) titles across rated types.
  // Otherwise fall back to trending on the client (cold start protection).
  if (highRatedCount < 3 || topGenres.length === 0 || ratedTypes.size === 0) {
    return {
      items: [],
      genres: [],
      reasons: {},
      reason: highRatedCount < 3 || topGenres.length === 0
        ? "Rate at least 3 titles with 3.5★ to unlock personalized recommendations"
        : "Discovery service temporarily unavailable",
    } as any;
  }

  // Only surfaces from media types the user actually rated 3.5★.
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

  // ── 5b. Year balance: 70% post-2000 / 30% pre-2000 (drop unknown-year items) ──
  // Older titles previously flooded the board because year had no bearing on
  // scoring. Drop year=0 (unknown) titles entirely, then re-balance the final
  // list to a 7:3 post-2000 : pre-2000 ratio, keeping score order within each
  // bucket and filling shortfalls from the other bucket.
  const knownYear = ranked.filter((item) => item.year >= 1);
  const post2000 = knownYear.filter((item) => item.year >= 2000);
  const pre2000 = knownYear.filter((item) => item.year < 2000);

  const TARGET_TOTAL = knownYear.length < 14 ? knownYear.length : 14;
  const targetPost = Math.round(TARGET_TOTAL * 0.7);
  const balanced: TmdbResult[] = [];
  let pi = 0, pp = 0;
  while (balanced.length < TARGET_TOTAL) {
    // Alternate: prefer post-2000 until we hit its quota, then pre-2000.
    // If one bucket is exhausted, fill from the other.
    const needPost = balanced.length < targetPost;
    if (needPost && pi < post2000.length) {
      balanced.push(post2000[pi++]);
    } else if (pp < pre2000.length) {
      balanced.push(pre2000[pp++]);
    } else if (pi < post2000.length) {
      balanced.push(post2000[pi++]);
    } else {
      break;
    }
  }

  // Build reason map
  const reasons: Record<number, string> = {};
  for (const item of balanced) {
    const c = candidates.get(item.id);
    if (c?.reason) reasons[item.id] = c.reason;
  }

  return { items: balanced, genres: genreNames, reasons };
}
