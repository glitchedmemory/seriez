import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";

// ─── User resolution ───

async function resolveUserIdByUsername(username: string): Promise<string | null> {
  const trimmed = username.trim().slice(0, 20);
  if (!trimmed) return null;

  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("username", trimmed)
    .maybeSingle();

  if (existing) return existing.id;

  // Auto-create user
  const crypto = await import("crypto");
  const hash = crypto.createHash("sha256").update("seriez:" + trimmed).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString("hex");
  const userId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;

  await supabaseAdmin.from("users").insert({
    id: userId,
    username: trimmed,
    email: `${trimmed}@seriezuser.com`,
  });

  return userId;
}

// ─── TMDB helpers ───

async function tmdbGet(endpoint: string) {
  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  return res.json();
}

interface TmdbCache {
  title: string;
  posterPath: string | null;
  runtime: number | null;
  genres: { id: number; name: string }[];
}

const tmdbCache = new Map<string, TmdbCache>();

async function getTmdbInfo(
  tmdbId: number,
  mediaType: string
): Promise<TmdbCache | null> {
  const cacheKey = `${mediaType}:${tmdbId}`;
  if (tmdbCache.has(cacheKey)) return tmdbCache.get(cacheKey)!;

  try {
    const ep = mediaType === "movie" ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
    const detail = await tmdbGet(ep);
    if (!detail) {
      tmdbCache.set(cacheKey, null!);
      return null;
    }

    const title = detail.title || detail.name || "Unknown";
    const posterPath = detail.poster_path || null;

    let runtime: number | null = null;
    if (mediaType === "movie") {
      runtime = detail.runtime || null;
    } else {
      const episodeRuntimes = detail.episode_run_time || [];
      runtime = episodeRuntimes.length > 0 ? episodeRuntimes[0] : null;
    }

    const genres = (detail.genres || []).map(
      (g: { id: number; name: string }) => ({ id: g.id, name: g.name })
    );

    const result: TmdbCache = { title, posterPath, runtime, genres };
    tmdbCache.set(cacheKey, result);
    return result;
  } catch {
    tmdbCache.set(cacheKey, null!);
    return null;
  }
}

// ─── GET /api/history ───

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month");
  const queryUsername = searchParams.get("username");

  if (!queryUsername) {
    return NextResponse.json(
      { error: "Missing username parameter" },
      { status: 400 }
    );
  }

  const userId = await resolveUserIdByUsername(queryUsername);
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Parse target month
  let targetYear: number;
  let targetMonth: number;
  if (monthParam) {
    const [y, m] = monthParam.split("-").map(Number);
    targetYear = y;
    targetMonth = m;
  } else {
    const now = new Date();
    targetYear = now.getFullYear();
    targetMonth = now.getMonth() + 1;
  }

  // Graph range: last 12 months
  const graphStart = new Date(targetYear, targetMonth - 12, 1)
    .toISOString()
    .split("T")[0];

  // ─── Fetch watches ───
  const { data: watches, error: watchError } = await supabaseAdmin
    .from("episode_watches")
    .select("tmdb_id, season_number, episode_number, watched_at")
    .eq("username", userId)
    .gte("watched_at", graphStart)
    .order("watched_at", { ascending: false });

  if (watchError) {
    return NextResponse.json({ error: watchError.message }, { status: 500 });
  }

  // ─── Fetch trackings ───
  const { data: tracking } = await supabaseAdmin
    .from("media_trackings")
    .select("tmdb_id, media_type, status, rating, updated_at")
    .eq("username", userId);

  const ratingMap = new Map<
    number,
    { rating: number; status: string; mediaType: string; updatedAt: string }
  >();
  if (tracking) {
    for (const t of tracking) {
      ratingMap.set(t.tmdb_id, {
        rating: t.rating ?? 0,
        status: t.status,
        mediaType: t.media_type,
        updatedAt: t.updated_at,
      });
    }
  }

  // ─── Build calendar ───
  interface DayEntry {
    tmdbId: number;
    title: string;
    posterPath: string | null;
    mediaType: string;
    rating: number;
    runtime: number | null;
    episodeCount: number;
  }

  const calendar: Record<string, DayEntry[]> = {};
  const monthEpisodeCounts: Record<string, number> = {};
  const genreRatings: Record<string, { total: number; count: number }> = {};

  for (const w of watches || []) {
    const dateKey = new Date(w.watched_at).toISOString().split("T")[0];
    const monthKey = dateKey.slice(0, 7);
    monthEpisodeCounts[monthKey] = (monthEpisodeCounts[monthKey] || 0) + 1;

    if (!dateKey.startsWith(`${targetYear}-${String(targetMonth).padStart(2, "0")}`))
      continue;

    if (!calendar[dateKey]) calendar[dateKey] = [];

    const existingIndex = calendar[dateKey].findIndex(
      (e) => e.tmdbId === w.tmdb_id
    );
    if (existingIndex >= 0) {
      calendar[dateKey][existingIndex].episodeCount++;
      continue;
    }

    const trackingInfo = ratingMap.get(w.tmdb_id);
    const mediaType = trackingInfo?.mediaType || "movie";
    const tmdbInfo = await getTmdbInfo(w.tmdb_id, mediaType);

    calendar[dateKey].push({
      tmdbId: w.tmdb_id,
      title: tmdbInfo?.title || `Title #${w.tmdb_id}`,
      posterPath: tmdbInfo?.posterPath || null,
      mediaType,
      rating: trackingInfo?.rating || 0,
      runtime: tmdbInfo?.runtime || null,
      episodeCount: 1,
    });

    if (tmdbInfo && trackingInfo?.rating) {
      for (const genre of tmdbInfo.genres) {
        if (!genreRatings[genre.name]) {
          genreRatings[genre.name] = { total: 0, count: 0 };
        }
        genreRatings[genre.name].total += trackingInfo.rating;
        genreRatings[genre.name].count += 1;
      }
    }
  }

  // ─── Stats ───
  let totalRuntimeMinutes = 0;
  let totalEpisodes = 0;
  const uniqueTitles = new Set<number>();

  for (const entries of Object.values(calendar)) {
    for (const entry of entries) {
      uniqueTitles.add(entry.tmdbId);
      if (entry.runtime) totalRuntimeMinutes += entry.runtime * entry.episodeCount;
      totalEpisodes += entry.episodeCount;
    }
  }

  const totalHours = Math.round(totalRuntimeMinutes / 6) / 10;
  const allRatings = Array.from(ratingMap.values()).filter((r) => r.rating > 0);
  const avgRating =
    allRatings.length > 0
      ? Math.round(
          (allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length) * 10
        ) / 10
      : 0;

  // ─── Monthly graph ───
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(targetYear, targetMonth - 1 - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  const monthlyGraph = months.map((month) => ({
    month,
    count: monthEpisodeCounts[month] || 0,
  }));

  // ─── Top genres ───
  const topGenres = Object.entries(genreRatings)
    .map(([name, { total, count }]) => ({
      name,
      avgRating: Math.round((total / count) * 10) / 10,
      count,
    }))
    .sort((a, b) => b.avgRating - a.avgRating)
    .slice(0, 3);

  // ─── Watch list ───
  const uniqueTracked = Array.from(
    new Map(
      (tracking || [])
        .filter((t: any) => t.status === "completed" || t.status === "watching")
        .map((t: any) => [t.tmdb_id, t])
    ).values()
  );

  const watchList = [];
  for (const t of uniqueTracked as any[]) {
    const tmdbInfo = await getTmdbInfo(t.tmdb_id, t.media_type);
    watchList.push({
      tmdbId: t.tmdb_id,
      mediaType: t.media_type,
      title: tmdbInfo?.title || `Title #${t.tmdb_id}`,
      posterPath: tmdbInfo?.posterPath || null,
      status: t.status,
      rating: t.rating ?? 0,
      updatedAt: t.updated_at,
    });
  }

  return NextResponse.json({
    calendar,
    stats: {
      totalHours,
      avgRating,
      totalTitles: uniqueTitles.size,
      totalEpisodes,
    },
    monthlyGraph,
    topGenres,
    watchList,
  });
}
