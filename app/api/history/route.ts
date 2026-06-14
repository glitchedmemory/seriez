import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";

async function resolveUserIdByUsername(username: string): Promise<string | null> {
  const trimmed = username.trim().slice(0, 20);
  if (!trimmed) return null;
  const { data: existing } = await supabaseAdmin
    .from("users").select("id").eq("username", trimmed).maybeSingle();
  if (existing) return existing.id;
  const crypto = await import("crypto");
  const hash = crypto.createHash("sha256").update("seriez:" + trimmed).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50; hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString("hex");
  const userId = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
  await supabaseAdmin.from("users").insert({ id: userId, username: trimmed, email: `${trimmed}@seriezuser.com` });
  return userId;
}

// ─── TMDB fetch (no cache — rate limit handled by 50ms delay) ───
const getTmdbCached = (endpoint: string) =>
  fetch(`https://api.themoviedb.org/3${endpoint}?api_key=${TMDB_API_KEY}&language=en-US`, {
    cache: "no-store",
  }).then(r => r.ok ? r.json() : null).catch(() => null);

interface TmdbCache {
  title: string;
  posterPath: string | null;
  runtime: number | null;
  genres: { id: number; name: string }[];
}

async function getTmdbInfo(tmdbId: number, mediaType: string): Promise<TmdbCache | null> {
  const ep = mediaType === "movie" ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
  const detail = await getTmdbCached(ep);
  if (!detail) return null;

  return {
    title: detail.title || detail.name || "Unknown",
    posterPath: detail.poster_path || null,
    runtime: mediaType === "movie"
      ? detail.runtime || null
      : (detail.episode_run_time?.length > 0 ? detail.episode_run_time[0] : null),
    genres: (detail.genres || []).map((g: any) => ({ id: g.id, name: g.name })),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month");
  const queryUsername = searchParams.get("username");
  if (!queryUsername) return NextResponse.json({ error: "Missing username" }, { status: 400 });

  const userId = await resolveUserIdByUsername(queryUsername);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let targetYear: number, targetMonth: number;
  if (monthParam) { const [y, m] = monthParam.split("-").map(Number); targetYear = y; targetMonth = m; }
  else { const n = new Date(); targetYear = n.getFullYear(); targetMonth = n.getMonth() + 1; }

  const graphStart = new Date(targetYear, targetMonth - 12, 1).toISOString().split("T")[0];

  const [watchesRes, trackingRes] = await Promise.all([
    supabaseAdmin.from("episode_watches")
      .select("tmdb_id, season_number, episode_number, watched_at")
      .eq("username", userId).gte("watched_at", graphStart).order("watched_at", { ascending: false }),
    supabaseAdmin.from("media_trackings")
      .select("tmdb_id, media_type, status, rating, updated_at")
      .eq("username", userId),
  ]);

  const watches = watchesRes.data;
  const tracking = trackingRes.data;

  const ratingMap = new Map<number, { rating: number; status: string; mediaType: string; updatedAt: string }>();
  if (tracking) for (const t of tracking) ratingMap.set(t.tmdb_id, {
    rating: t.rating ?? 0, status: t.status, mediaType: t.media_type, updatedAt: t.updated_at,
  });

  // ─── Collect unique tmdbIds for target month ───
  const targetPrefix = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
  const monthEpisodeCounts: Record<string, number> = {};
  const dayGroups: Record<string, { tmdbId: number; episodes: number }[]> = {};

  for (const w of watches || []) {
    const dateKey = new Date(w.watched_at).toISOString().split("T")[0];
    const monthKey = dateKey.slice(0, 7);
    monthEpisodeCounts[monthKey] = (monthEpisodeCounts[monthKey] || 0) + 1;
    if (!dateKey.startsWith(targetPrefix)) continue;
    if (!dayGroups[dateKey]) dayGroups[dateKey] = [];
    const existing = dayGroups[dateKey].find(e => e.tmdbId === w.tmdb_id);
    if (existing) { existing.episodes++; continue; }
    dayGroups[dateKey].push({ tmdbId: w.tmdb_id, episodes: 1 });
  }

  // ─── Sequential TMDB fetch with rate-limit delay ───
  const uniqueTmdbIds = new Set<number>();
  for (const entries of Object.values(dayGroups)) for (const e of entries) uniqueTmdbIds.add(e.tmdbId);
  // Also include watchlist tmdb_ids
  if (tracking) for (const t of tracking) uniqueTmdbIds.add(t.tmdb_id);
  const tmdbResults = [];
  for (const tmdbId of uniqueTmdbIds) {
    const info = ratingMap.get(tmdbId);
    const mediaType = info?.mediaType || "movie";
    const tmdbInfo = await getTmdbInfo(tmdbId, mediaType);
    tmdbResults.push({ tmdbId, tmdbInfo, mediaType, rating: info?.rating || 0 });
    await new Promise(r => setTimeout(r, 50)); // avoid TMDB rate limit
  }

  const tmdbMap = new Map<number, { tmdbInfo: TmdbCache | null; mediaType: string; rating: number }>();
  for (const r of tmdbResults) tmdbMap.set(r.tmdbId, { tmdbInfo: r.tmdbInfo, mediaType: r.mediaType, rating: r.rating });

  // ─── Build calendar ───
  type DayEntry = { tmdbId: number; title: string; posterPath: string | null; mediaType: string; rating: number; runtime: number | null; episodeCount: number };
  const calendar: Record<string, DayEntry[]> = {};
  const genreRatings: Record<string, { total: number; count: number }> = {};

  for (const [dateKey, entries] of Object.entries(dayGroups)) {
    calendar[dateKey] = [];
    for (const e of entries) {
      const tmdb = tmdbMap.get(e.tmdbId);
      const title = tmdb?.tmdbInfo?.title || `Title #${e.tmdbId}`;
      const posterPath = tmdb?.tmdbInfo?.posterPath || null;
      const runtime = tmdb?.tmdbInfo?.runtime || null;
      calendar[dateKey].push({ tmdbId: e.tmdbId, title, posterPath, mediaType: tmdb?.mediaType || "movie", rating: tmdb?.rating || 0, runtime, episodeCount: e.episodes });

      if (tmdb?.tmdbInfo && tmdb.rating > 0) {
        for (const genre of tmdb.tmdbInfo.genres) {
          if (!genreRatings[genre.name]) genreRatings[genre.name] = { total: 0, count: 0 };
          genreRatings[genre.name].total += tmdb.rating;
          genreRatings[genre.name].count += 1;
        }
      }
    }
  }

  // ─── Stats ───
  let totalMin = 0, totalEps = 0;
  const titles = new Set<number>();
  for (const entries of Object.values(calendar)) for (const e of entries) {
    titles.add(e.tmdbId);
    if (e.runtime) totalMin += e.runtime * e.episodeCount;
    totalEps += e.episodeCount;
  }

  // Weekly: current ISO week (Monday–Sunday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const weekStart = monday.toISOString().split("T")[0];
  const weekEnd = sunday.toISOString().split("T")[0];
  let weeklyMin = 0, allTimeMin = 0;
  for (const w of (watches || [])) {
    const tmdb = tmdbMap.get(w.tmdb_id);
    const rt = tmdb?.tmdbInfo?.runtime;
    if (!rt) continue;
    allTimeMin += rt;
    const watchDate = new Date(w.watched_at).toISOString().split("T")[0];
    if (watchDate >= weekStart && watchDate <= weekEnd) weeklyMin += rt;
  }
  const allRatings = Array.from(ratingMap.values()).filter(r => r.rating > 0);
  const avgRating = allRatings.length > 0 ? Math.round((allRatings.reduce((s,r)=>s+r.rating,0)/allRatings.length)*10)/10 : 0;

  // ─── Monthly graph ───
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(targetYear, targetMonth - 1 - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  }
  const monthlyGraph = months.map(month => ({ month, count: monthEpisodeCounts[month] || 0 }));

  // ─── Top genres ───
  const topGenres = Object.entries(genreRatings).map(([name, { total, count }]) => ({
    name, avgRating: Math.round((total/count)*10)/10, count,
  })).sort((a,b) => b.avgRating - a.avgRating).slice(0, 3);

  // ─── Watch list (reuse tmdbMap) ───
  const watchList = [];
  const seen = new Set<number>();
  if (tracking) for (const t of tracking) {
    if (seen.has(t.tmdb_id) || (t.status !== "completed" && t.status !== "watching")) continue;
    seen.add(t.tmdb_id);
    const tmdb = tmdbMap.get(t.tmdb_id);
    watchList.push({
      tmdbId: t.tmdb_id, mediaType: t.media_type,
      title: tmdb?.tmdbInfo?.title || `Title #${t.tmdb_id}`,
      posterPath: tmdb?.tmdbInfo?.posterPath || null,
      status: t.status, rating: t.rating ?? 0, updatedAt: t.updated_at,
    });
  }

  return NextResponse.json({
    calendar,
    stats: { weeklyHours: Math.round(weeklyMin/6)/10, totalHours: Math.round(totalMin/6)/10, allTimeHours: Math.round(allTimeMin/6)/10, avgRating, totalTitles: titles.size, totalEpisodes: totalEps },
    monthlyGraph, topGenres, watchList,
  });
}
