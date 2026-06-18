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
  return null; // Do NOT auto-create — user must already exist
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

// ─── AI persona engine: analyzes watch patterns to pick best-fit persona ───
interface RatingEntry { rating: number; status: string; mediaType: string; updatedAt: string; }

function getPersona(allRatings: RatingEntry[], genreRatings: Record<string, { total: number; count: number }>) {
  if (allRatings.length === 0) return null;

  const avg = allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length;

  // Pattern analysis
  const variance = allRatings.length > 1
    ? allRatings.reduce((s, r) => s + Math.pow(r.rating - avg, 2), 0) / allRatings.length : 0;
  const genreEntries = Object.entries(genreRatings).sort((a, b) => b[1].count - a[1].count);
  const topGenre = genreEntries[0]?.[0] || "";
  const uniqueGenres = genreEntries.length;
  const isDiverse = uniqueGenres >= 5;
  const isFocused = uniqueGenres <= 2 && allRatings.length >= 5;
  const isVaried = variance > 1.2;

  // Genre affinity groups
  const actionGenres = ["Action", "Adventure", "Thriller", "Science Fiction"];
  const dramaGenres = ["Drama", "Romance", "Mystery"];
  const funGenres = ["Comedy", "Animation"];
  const darkGenres = ["Horror", "Crime", "War"];

  const likesAction = actionGenres.some(g => genreEntries.some(([n]) => n === g));
  const likesDrama = dramaGenres.some(g => genreEntries.some(([n]) => n === g));
  const likesFun = funGenres.some(g => genreEntries.some(([n]) => n === g));
  const likesDark = darkGenres.some(g => genreEntries.some(([n]) => n === g));

  // Anime fan detection
  const animeCount = allRatings.filter(r => r.mediaType === "anime").length;
  const isAnimeFan = allRatings.length >= 3 && animeCount / allRatings.length >= 0.6;

  // 7-tier persona selection
  let label: string, desc: string;

  if (avg >= 4.5) {
    if (isAnimeFan && isDiverse) { label = "Otaku Spirit"; desc = "Anime is your world and you love almost everything you start. A passionate weeb who finds joy in every series."; }
    else if (isAnimeFan && isFocused) { label = "Manga Reader"; desc = "You read the source first and the anime never disappoints. Seeing your favorite panels animated is pure bliss."; }
    else if (isAnimeFan) { label = "Isekai Addict"; desc = "Another world, another 5 stars. You've watched every isekai this season and you're not stopping."; }
    else if (likesFun) { label = "Joy Finder"; desc = "You watch to feel good — and almost everything delivers. A happiness-first viewer who finds gems everywhere."; }
    else if (isDiverse) { label = "Generous Spirit"; desc = "Your open mind spans genres, and your high ratings reflect genuine appreciation for the craft."; }
    else { label = "Easy to Please"; desc = "You don't overthink it — if it entertains, it earns your stars. Pure, unfiltered enjoyment."; }
  } else if (avg >= 4.0) {
    if (isAnimeFan && isFocused) { label = "Shonen Faithful"; desc = "Training arcs, power-ups, tournament finals — the formula works and you know it."; }
    else if (isAnimeFan && isVaried) { label = "Waifu Collector"; desc = "Every season brings a new best girl, and you're here for all of them. Emotional attachment guaranteed."; }
    else if (isAnimeFan) { label = "Seasonal Binger"; desc = "You follow the seasonal calendar religiously. Every new OP is a promise — and it rarely disappoints."; }
    else if (likesAction) { label = "Hype Chaser"; desc = "You live for the rush — blockbusters, explosions, and high-stakes thrills are your happy place."; }
    else if (isFocused) { label = "Passionate Admirer"; desc = "You know what you love and you stick to it. Deep appreciation for your chosen lane."; }
    else { label = "Enthusiastic Fan"; desc = "You lean positive, celebrate what works, and rarely walk away disappointed."; }
  } else if (avg >= 3.5) {
    if (isAnimeFan && isFocused) { label = "Slice of Life Enjoyer"; desc = "You find beauty in the mundane. A quiet episode about making coffee can earn a solid 4."; }
    else if (isAnimeFan && isVaried) { label = "OP/ED Critic"; desc = "You judge openings as hard as the show itself. A banger OP buys goodwill, a bad one loses it."; }
    else if (isAnimeFan) { label = "Subtitle Devotee"; desc = "You live in the subtitles. Japanese VAs, seasonal drops, and emotional EDs — this is your native language."; }
    else if (isDiverse) { label = "Silver Lining Seeker"; desc = "Genre-hopping optimist who finds something to appreciate in every story."; }
    else if (isVaried) { label = "Warm Viewer"; desc = "Your ratings swing with your mood, but you always find warmth in what you watch."; }
    else { label = "Glass Half Full"; desc = "Steady, positive, and reliable — you see the good without ignoring the flaws."; }
  } else if (avg >= 3.0) {
    if (isAnimeFan && isFocused) { label = "Adaptation Purist"; desc = "You've read the source material and you judge accordingly. The anime must earn its stars."; }
    else if (isAnimeFan && isVaried) { label = "Pacing Police"; desc = "Filler arcs and dragged-out episodes cost stars. You value tight storytelling above all."; }
    else if (isAnimeFan) { label = "Genre Explorer"; desc = "Isekai, shonen, romance, mecha — you sample everything with measured judgment."; }
    else if (likesDrama) { label = "Middle Ground"; desc = "You weigh emotion carefully — not too harsh, not too soft. A true dramatic balance."; }
    else if (isDiverse) { label = "Fair-Minded Critic"; desc = "Your wide taste comes with measured judgment. Fair scores across the board."; }
    else { label = "Balanced Judge"; desc = "You keep it even — your ratings reflect thoughtful, unhurried consideration."; }
  } else if (avg >= 2.5) {
    if (isAnimeFan && isDiverse) { label = "Hidden Gem Hunter"; desc = "You skip the mainstream hits and dig for overlooked masterpieces. Popularity is not a criteria."; }
    else if (isAnimeFan && isFocused) { label = "Connoisseur"; desc = "Your taste in anime is refined. Mass appeal means nothing to you."; }
    else if (isAnimeFan) { label = "Seasonal Dropper"; desc = "You start 10 shows per season and finish 3. Life's too short for mediocre anime."; }
    else if (likesDark) { label = "Quality Filter"; desc = "Dark themes demand high standards. You don't hand out stars to just anything."; }
    else if (isFocused) { label = "Taste Curator"; desc = "You curate with precision. Only titles that truly match your taste make the cut."; }
    else { label = "Selective Critic"; desc = "You know what works and what doesn't — and you're not afraid to say so."; }
  } else if (avg >= 2.0) {
    if (isAnimeFan && isFocused) { label = "Studio Loyalist"; desc = "You follow studios, not hype. KyoAni, MAPPA, Ufotable — you know who delivers and who doesn't."; }
    else if (isAnimeFan && !isVaried) { label = "Director Follower"; desc = "You track directors across projects. Naoko Yamada's touch is unmistakable to your trained eye."; }
    else if (isAnimeFan) { label = "Animation Purist"; desc = "CGI dragons and low frame rates are instant dealbreakers. Hand-drawn excellence or nothing."; }
    else if (likesAction) { label = "Hard to Impress"; desc = "Explosions and car chases alone won't win you over. You demand substance behind the spectacle."; }
    else if (isVaried) { label = "Discerning Viewer"; desc = "Your taste is exacting and your standards high. Only the best earns recognition."; }
    else { label = "Sharp Eye"; desc = "You spot flaws others miss. A critical gaze that keeps quality in check."; }
  } else {
    if (isAnimeFan && isFocused) { label = "Source Snob"; desc = "The anime is always worse than the LN. Your stars are reserved for adaptations that surpass the original."; }
    else if (isAnimeFan && isDiverse) { label = "Sakuga Purist"; desc = "You judge by key frames and animation quality. Only visual masterpieces with flawless sakuga earn your stars."; }
    else if (isAnimeFan) { label = "Golden Age Keeper"; desc = "Nothing made after 2010 impresses you. The golden era has passed and you're gatekeeping what remains."; }
    else if (likesDark) { label = "Tough Crowd"; desc = "Horror, crime, darkness — even then you're stingy with stars. Only truly exceptional work impresses."; }
    else if (isFocused) { label = "Strict Purist"; desc = "You know your genre inside out, and the bar is set high. Mediocrity won't pass."; }
    else { label = "Rare Praiser"; desc = "Stars are earned, not given. When you rate highly, people pay attention."; }
  }

  return { label, desc, tier: avg };
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

  const [watchesRes, trackingRes, userRes] = await Promise.all([
    supabaseAdmin.from("episode_watches")
      .select("tmdb_id, season_number, episode_number, watched_at")
      .eq("username", userId).gte("watched_at", graphStart).order("watched_at", { ascending: false }),
    supabaseAdmin.from("media_trackings")
      .select("tmdb_id, media_type, status, rating, updated_at")
      .eq("username", userId),
    supabaseAdmin.from("users")
      .select("is_premium")
      .eq("username", queryUsername.trim().slice(0, 20)).maybeSingle(),
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
    monthlyGraph, topGenres, watchList, persona: getPersona(allRatings, genreRatings),
    isPremium: userRes?.data?.is_premium === true,
  });
}
