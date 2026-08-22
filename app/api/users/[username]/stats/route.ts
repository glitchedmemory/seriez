import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GENRE_MAP, tmdbGet } from "@/lib/tmdb";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);


// ─── AniList helpers ───
const ANILIST_API = "https://graphql.anilist.co";

// ─── Rating conversion (DB stores mixed scales: ×10 int or 0–10 int) ───
const FROM_DB = (v: number) => v > 10 ? v / 10 : v > 5 ? v / 2 : v;

// ─── Runtime metadata cache (shared across all users) ───
async function loadKnownRuntimes(tracking: { tmdb_id: number; media_type: string }[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (tracking.length === 0) return map;
  const ids = [...new Set(tracking.map(t => t.tmdb_id))];
  // Batch in chunks of 100 to stay under URL limits
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    try {
      const { data } = await supabaseAdmin
        .from("media_runtimes")
        .select("tmdb_id, runtime")
        .in("tmdb_id", chunk);
      for (const row of data || []) {
        if (row.runtime > 0) map.set(row.tmdb_id, row.runtime);
      }
    } catch { /* ignore */ }
  }
  return map;
}

async function saveRuntimes(entries: { tmdb_id: number; media_type: string; runtime: number }[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    await supabaseAdmin
      .from("media_runtimes")
      .upsert(entries, { onConflict: "tmdb_id,media_type" });
  } catch { /* non-fatal */ }
}

// ─── Genre metadata cache (shared across all users) ───
async function loadKnownGenres(ids: { tmdb_id: number; media_type: string }[]): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (ids.length === 0) return map;
  const tmdbIds = [...new Set(ids.map(i => i.tmdb_id))];
  for (let i = 0; i < tmdbIds.length; i += 100) {
    const chunk = tmdbIds.slice(i, i + 100);
    try {
      const { data } = await supabaseAdmin
        .from("media_genres")
        .select("tmdb_id, media_type, genres")
        .in("tmdb_id", chunk);
      for (const row of data || []) {
        const g: string[] = Array.isArray(row.genres) ? row.genres : [];
        if (g.length > 0) map.set(row.tmdb_id, g);
      }
    } catch { /* ignore */ }
  }
  return map;
}

async function saveGenres(entries: { tmdb_id: number; media_type: string; genres: string[] }[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    await supabaseAdmin
      .from("media_genres")
      .upsert(entries, { onConflict: "tmdb_id,media_type" });
  } catch { /* non-fatal */ }
}

// ─── Credits (actors/directors) metadata cache (shared across all users) ───
async function loadKnownCredits(ids: { tmdb_id: number; media_type: string }[]): Promise<Map<number, { actors: { name: string; id: number; image: string | null }[]; directors: { name: string; id: number; personSource: string; image: string | null }[] }>> {
  const map = new Map();
  if (ids.length === 0) return map;
  const tmdbIds = [...new Set(ids.map(i => i.tmdb_id))];
  for (let i = 0; i < tmdbIds.length; i += 100) {
    const chunk = tmdbIds.slice(i, i + 100);
    try {
      const { data } = await supabaseAdmin
        .from("media_credits")
        .select("tmdb_id, media_type, credits")
        .in("tmdb_id", chunk);
      for (const row of data || []) {
        if (row.credits && typeof row.credits === "object") {
          map.set(row.tmdb_id, row.credits);
        }
      }
    } catch { /* ignore */ }
  }
  return map;
}

async function saveCredits(entries: { tmdb_id: number; media_type: string; credits: object }[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    await supabaseAdmin
      .from("media_credits")
      .upsert(entries, { onConflict: "tmdb_id,media_type" });
  } catch { /* non-fatal */ }
}

// ─── TMDB runtime batch fetcher (with free fallbacks: Wikidata + AniList) ───
async function fetchRuntimes(
  tracking: { tmdb_id: number; media_type: string }[]
): Promise<Map<number, number>> {
  // Seed from shared metadata cache — skip external lookups for known titles
  const known = await loadKnownRuntimes(tracking);
  const map = new Map<number, number>(known);

  // Only fetch runtimes we don't already know
  const knownIds = new Set(known.keys());
  const movieIds = [...new Set(tracking.filter(t => t.media_type === "movie").map(t => t.tmdb_id))].filter(id => !knownIds.has(id));
  const tvIds = [...new Set(tracking.filter(t => t.media_type === "tv" || t.media_type === "anime").map(t => t.tmdb_id))].filter(id => !knownIds.has(id));

  const BATCH = 8;

  // ── Source 1: TMDB (primary) ──
  // Also capture titles for downstream fallback searches
  const titleMap = new Map<number, string>();

  // Movies → runtime
  for (let i = 0; i < movieIds.length; i += BATCH) {
    const batch = movieIds.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(id =>
        tmdbGet(`/movie/${id}`).catch(() => null)
      )
    );
    for (let j = 0; j < batch.length; j++) {
      const result = results[j];
      const data = result.status === "fulfilled" ? (result as PromiseFulfilledResult<any>).value : null;
      if (data?.runtime && data.runtime > 0) map.set(batch[j], data.runtime);
      if (data?.title) titleMap.set(batch[j], data.title);
    }
  }

  // TV → episode_run_time average + capture name
  for (let i = 0; i < tvIds.length; i += BATCH) {
    const batch = tvIds.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(id =>
        tmdbGet(`/tv/${id}`).catch(() => null)
      )
    );
    for (let j = 0; j < batch.length; j++) {
      const result = results[j];
      const data = result.status === "fulfilled" ? (result as PromiseFulfilledResult<any>).value : null;
      if (data?.name) titleMap.set(batch[j], data.name);
      const runtimes: number[] = data?.episode_run_time || [];
      const avg = runtimes.length > 0
        ? Math.round(runtimes.reduce((a: number, b: number) => a + b, 0) / runtimes.length)
        : 0;
      if (avg > 0) map.set(batch[j], avg);
    }
  }

  // ── Source 2: Wikidata (free, no key) for movies missing runtime ──
  const missingMovies = movieIds.filter(id => !map.has(id));
  if (missingMovies.length > 0) {
    const wdRes = await Promise.allSettled(
      missingMovies.map(async (tmdbId) => {
        const query = `SELECT ?runtime ?article WHERE { ?item wdt:P4947 "${tmdbId}". OPTIONAL { ?item wdt:P2047 ?runtime. } OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>. } } LIMIT 1`;
        const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
        try {
          const r = await fetch(url, { headers: { "User-Agent": "Seriez/1.0" } });
          if (!r.ok) return { tmdbId, runtime: 0, article: "" };
          const j = await r.json();
          const b = j?.results?.bindings?.[0];
          const mins = b?.runtime?.value ? parseFloat(b.runtime.value) : 0;
          const article = b?.article?.value || "";
          return { tmdbId, runtime: mins > 0 ? Math.round(mins) : 0, article };
        } catch { return { tmdbId, runtime: 0, article: "" }; }
      })
    );
    const wpIds: { tmdbId: number; article: string }[] = [];
    for (const res of wdRes) {
      if (res.status === "fulfilled" && res.value.runtime > 0) {
        map.set(res.value.tmdbId, res.value.runtime);
      } else if (res.status === "fulfilled" && res.value.article) {
        wpIds.push({ tmdbId: res.value.tmdbId, article: res.value.article });
      }
    }

    // ── Source 3: Wikipedia infobox (free, no key) for Wikidata misses ──
    if (wpIds.length > 0) {
      const wpRes = await Promise.allSettled(
        wpIds.map(async ({ tmdbId, article }) => {
          const title = article.replace("https://en.wikipedia.org/wiki/", "");
          try {
            const r = await fetch(
              `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text&section=0&format=json`,
              { headers: { "User-Agent": "Seriez/1.0" } }
            );
            if (!r.ok) return { tmdbId, runtime: 0 };
            const j = await r.json();
            const html: string = j?.parse?.text?.["*"] || "";
            // Parse infobox: "Running time", "Runtime", or "minutes" with preceding number
            const m1 = html.match(/(?:Running time|Runtime)[^<]*?(\d+)\s*(?:minutes|min)/i);
            const m2 = html.match(/<td[^>]*>(\d+)\s*(?:minutes|min)<\/td>/i);
            const mins = m1 ? parseInt(m1[1]) : m2 ? parseInt(m2[1]) : 0;
            return { tmdbId, runtime: mins > 0 ? mins : 0 };
          } catch { return { tmdbId, runtime: 0 }; }
        })
      );
      for (const res of wpRes) {
        if (res.status === "fulfilled" && res.value.runtime > 0) {
          map.set(res.value.tmdbId, res.value.runtime);
        }
      }
    }
  }

  // ── Source 4: Wikidata (free, no key) for TV missing episode length ──
  const missingTV = tvIds.filter(id => !map.has(id));
  if (missingTV.length > 0) {
    const wdRes = await Promise.allSettled(
      missingTV.map(async (tmdbId) => {
        const query = `SELECT ?runtime ?article WHERE { ?item wdt:P4983 "${tmdbId}". OPTIONAL { ?item wdt:P2047 ?runtime. } OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>. } } LIMIT 1`;
        const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
        try {
          const r = await fetch(url, { headers: { "User-Agent": "Seriez/1.0" } });
          if (!r.ok) return { tmdbId, runtime: 0, article: "" };
          const j = await r.json();
          const b = j?.results?.bindings?.[0];
          const mins = b?.runtime?.value ? parseFloat(b.runtime.value) : 0;
          const article = b?.article?.value || "";
          return { tmdbId, runtime: mins > 0 ? Math.round(mins) : 0, article };
        } catch { return { tmdbId, runtime: 0, article: "" }; }
      })
    );
    const wpTVIds: { tmdbId: number; article: string }[] = [];
    for (const res of wdRes) {
      if (res.status === "fulfilled" && res.value.runtime > 0) {
        map.set(res.value.tmdbId, res.value.runtime);
      } else if (res.status === "fulfilled" && res.value.article) {
        wpTVIds.push({ tmdbId: res.value.tmdbId, article: res.value.article });
      }
    }

    // ── Source 5: TVMaze (free, no key) for TV Wikidata misses ──
    if (wpTVIds.length > 0) {
      const tvRes = await Promise.allSettled(
        wpTVIds.map(async ({ tmdbId, article }) => {
          try {
            // Use Wikipedia title to search TVMaze
            const title = decodeURIComponent(article.replace("https://en.wikipedia.org/wiki/", "").replace(/_/g, " "));
            const r = await fetch(
              `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(title)}`,
              { headers: { "User-Agent": "Seriez/1.0" } }
            );
            if (!r.ok) return { tmdbId, runtime: 0 };
            const j = await r.json();
            const mins = j?.averageRuntime || 0;
            return { tmdbId, runtime: mins > 0 ? mins : 0 };
          } catch { return { tmdbId, runtime: 0 }; }
        })
      );
      for (const res of tvRes) {
        if (res.status === "fulfilled" && res.value.runtime > 0) {
          map.set(res.value.tmdbId, res.value.runtime);
        }
      }
    }
  }

  // ── Source 6: Jikan v4 (MyAnimeList, free, no key) for remaining anime ──
  const stillMissingTV = tvIds.filter(id => !map.has(id) && titleMap.has(id));
  if (stillMissingTV.length > 0) {
    const jikanRes = await Promise.allSettled(
      stillMissingTV.map(async (tmdbId) => {
        const title = titleMap.get(tmdbId)!;
        try {
          const r = await fetch(
            `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`,
            { headers: { "User-Agent": "Seriez/1.0" } }
          );
          if (!r.ok) return { tmdbId, runtime: 0 };
          const j = await r.json();
          const dur = j?.data?.[0]?.duration || "";
          const m = dur.match(/(\d+)\s*min/);
          return { tmdbId, runtime: m ? parseInt(m[1]) : 0 };
        } catch { return { tmdbId, runtime: 0 }; }
      })
    );
    for (const res of jikanRes) {
      if (res.status === "fulfilled" && res.value.runtime > 0) {
        map.set(res.value.tmdbId, res.value.runtime);
      }
    }
  }

  // ── Source 7: Syoboi Calendar (Japanese, free, no key) ──
  const stillMissingAnime = tvIds.filter(id => !map.has(id) && titleMap.has(id));
  if (stillMissingAnime.length > 0) {
    const syoRes = await Promise.allSettled(
      stillMissingAnime.map(async (tmdbId) => {
        const title = titleMap.get(tmdbId)!;
        try {
          const r = await fetch(
            `https://cal.syoboi.jp/json.php?Req=TitleSearch&Search=${encodeURIComponent(title)}`,
            { headers: { "User-Agent": "Seriez/1.0" } }
          );
          if (!r.ok) return { tmdbId, runtime: 0 };
          const j = await r.json();
          const titles = j?.Titles || {};
          const first = Object.values(titles)[0] as any;
          // Syoboi returns TID; we can get program detail from db.php
          if (!first?.TID) return { tmdbId, runtime: 0 };
          const d2 = await fetch(
            `https://cal.syoboi.jp/db.php?Command=ProgLookup&TID=${first.TID}&ChID=`,
            { headers: { "User-Agent": "Seriez/1.0" } }
          );
          if (!d2.ok) return { tmdbId, runtime: 0 };
          const j2 = await d2.json();
          const progs = j2?.ProgItems || [];
          // Get median of StTime/EdTime differences in seconds → minutes
          const diffs = progs
            .map((p: any) => (parseInt(p.EdTime || "0") - parseInt(p.StTime || "0")) / 60)
            .filter((d: number) => d > 0 && d < 60);
          const median = diffs.length > 0
            ? Math.round(diffs.sort((a: number, b: number) => a - b)[Math.floor(diffs.length / 2)])
            : 0;
          return { tmdbId, runtime: median > 0 ? median : 0 };
        } catch { return { tmdbId, runtime: 0 }; }
      })
    );
    for (const res of syoRes) {
      if (res.status === "fulfilled" && res.value.runtime > 0) {
        map.set(res.value.tmdbId, res.value.runtime);
      }
    }
  }

  // ── Source 8: Wikipedia JA infobox (Japanese, free, no key) ──
  const finalMissing = tvIds.filter(id => !map.has(id) && titleMap.has(id));
  if (finalMissing.length > 0) {
    const jawpRes = await Promise.allSettled(
      finalMissing.map(async (tmdbId) => {
        const title = titleMap.get(tmdbId)!;
        try {
          const sr = await fetch(
            `https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title)}&format=json`,
            { headers: { "User-Agent": "Seriez/1.0" } }
          );
          if (!sr.ok) return { tmdbId, runtime: 0 };
          const sj = await sr.json();
          const pageTitle = sj?.query?.search?.[0]?.title;
          if (!pageTitle) return { tmdbId, runtime: 0 };
          const pr = await fetch(
            `https://ja.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&section=0&format=json`,
            { headers: { "User-Agent": "Seriez/1.0" } }
          );
          if (!pr.ok) return { tmdbId, runtime: 0 };
          const pj = await pr.json();
          const html: string = pj?.parse?.text?.["*"] || "";
          // Japanese infobox: 話数, 放送時間, or plain "分" (minutes)
          const m1 = html.match(/(\d+)\s*分/);
          const m2 = html.match(/(\d+)\s*min/);
          const mins = m1 ? parseInt(m1[1]) : m2 ? parseInt(m2[1]) : 0;
          // Filter realistic episode lengths (10-60 min)
          return { tmdbId, runtime: mins >= 10 && mins <= 60 ? mins : 0 };
        } catch { return { tmdbId, runtime: 0 }; }
      })
    );
    for (const res of jawpRes) {
      if (res.status === "fulfilled" && res.value.runtime > 0) {
        map.set(res.value.tmdbId, res.value.runtime);
      }
    }
  }

  // Persist newly discovered runtimes to the shared cache (non-blocking)
  const typeById = new Map(tracking.map(t => [t.tmdb_id, t.media_type]));
  const freshEntries: { tmdb_id: number; media_type: string; runtime: number }[] = [];
  for (const [id, runtime] of map) {
    if (!knownIds.has(id) && runtime > 0) {
      freshEntries.push({ tmdb_id: id, media_type: typeById.get(id) || "movie", runtime });
    }
  }
  if (freshEntries.length > 0) {
    void saveRuntimes(freshEntries);
  }

  return map;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const { searchParams } = new URL(req.url);
  const mediaType = searchParams.get("mediaType"); // movie | tv | anime | null

  // Resolve user_id up front (needed for both cache-hit and recompute paths)
  const { data: userData } = await supabase
    .from("users")
    .select("id")
    .eq("username", username)
    .single();

  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const userId = userData.id;

  try {
    // ── 0. Serve from per-user cache when fresh ──
    let cachedStats: any = null;
    let cacheAgeMs = Infinity;
    try {
      const { data: cached } = await supabaseAdmin
        .from("user_stats_cache")
        .select("stats, updated_at")
        .eq("username", username)
        .maybeSingle();
      cachedStats = cached?.stats ?? null;
      if (cached?.stats) {
        cacheAgeMs = Date.now() - new Date(cached.updated_at).getTime();
      }
    } catch { /* fall through */ }

    // Fresh cache → return immediately
    if (cachedStats && cacheAgeMs < 6 * 60 * 60 * 1000) {
      const resp = NextResponse.json(cachedStats);
      resp.headers.set("Cache-Control", "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400");
      resp.headers.set("CDN-Cache-Control", "public, s-maxage=21600");
      return resp;
    }

    // Stale cache → serve it NOW, recompute in the background (stale-while-revalidate)
    if (cachedStats) {
      void computeAndStore(username, userId).catch(() => {});
      const resp = NextResponse.json(cachedStats);
      resp.headers.set("Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=86400");
      resp.headers.set("CDN-Cache-Control", "public, s-maxage=60");
      return resp;
    }

    // No cache → compute synchronously (first-ever visit for this user)
    return await computeAndStore(username, userId);
  } catch (err: any) {
    console.error("Stats error:", err);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}

async function computeAndStore(username: string, userId: string): Promise<NextResponse> {
  try {
    // ── 1. Get user_id (already resolved by caller) ──

    // ── 2. Fetch all tracking data (always all types — client-side filters tabs) ──
    const { data: tracking } = await supabaseAdmin
      .from("media_trackings")
      .select("tmdb_id, media_type, status, rating, progress, watched_at, updated_at, anilist_id")
      .eq("username", userId);

    // ── 3. Fetch actual TMDB runtimes (in background — non-blocking for core data) ──
    const runtimeMap = tracking ? await fetchRuntimes(tracking) : new Map<number, number>();

    // ── 4. Fetch all reviews ──
    const { data: reviews } = await supabase
      .from("reviews")
      .select("tmdb_id, media_type, rating")
      .eq("username", username);

    // ── Merge tracking + reviews for rated items ──
    const ratedMap = new Map<number, { rating: number; mediaType: string }>();

    if (tracking) {
      for (const t of tracking) {
        if (t.rating && t.rating > 0) {
          ratedMap.set(t.tmdb_id, { rating: t.rating, mediaType: t.media_type });
        }
      }
    }
    if (reviews) {
      for (const r of reviews) {
        if (!ratedMap.has(r.tmdb_id) && r.rating && r.rating > 0) {
          ratedMap.set(r.tmdb_id, { rating: FROM_DB(r.rating), mediaType: r.media_type });
        }
      }
    }

    // ── 5. Compute basic counts ──
    const watched = (tracking || []).filter(t => t.status === "completed");
    const watching = (tracking || []).filter(t => t.status === "watching");
    const planned = (tracking || []).filter(t => t.status === "plan_to_watch");
    const rated = Array.from(ratedMap.values());
    const reviewedItems = (reviews || []).filter(r => r.rating && r.rating > 0);
    const allRated = [...rated, ...reviewedItems.filter(r => !ratedMap.has(r.tmdb_id)).map(r => ({ rating: FROM_DB(r.rating), mediaType: r.media_type }))];

    // ── Completion rate (TV + anime only) ──
    const series = (tracking || []).filter(t => t.media_type === "tv" || t.media_type === "anime");
    const seriesStarted = series.filter(s => s.status === "completed" || s.status === "watching");
    const seriesCompleted = series.filter(s => s.status === "completed");
    const completionRate = seriesStarted.length > 0
      ? Math.round((seriesCompleted.length / seriesStarted.length) * 100)
      : 0;

    // Rating distribution
    const ratingBuckets: Record<string, number> = {};
    for (let i = 5; i >= 0.5; i -= 0.5) {
      ratingBuckets[i.toFixed(1)] = 0;
    }
    for (const r of allRated) {
      const key = r.rating.toFixed(1);
      if (ratingBuckets[key] !== undefined) ratingBuckets[key]++;
    }

    const avgRating = allRated.length > 0
      ? Math.round((allRated.reduce((s, r) => s + r.rating, 0) / allRated.length) * 10) / 10
      : 0;

    // Media type breakdown
    const mediaBreakdown: Record<string, number> = { movie: 0, tv: 0, anime: 0 };
    for (const t of tracking || []) {
      if (mediaBreakdown[t.media_type] !== undefined) mediaBreakdown[t.media_type]++;
      else if (t.media_type === "anime") mediaBreakdown.anime++;
    }

    // ── 6. Watch time using actual runtime (no fallback — missing = excluded) ──
    let totalMinutes = 0;
    let mediaMinutes: Record<string, number> = { movie: 0, tv: 0, anime: 0 };

    for (const t of watched) {
      const runtime = runtimeMap.get(t.tmdb_id);
      if (!runtime || runtime <= 0) continue; // skip if no real data

      if (t.media_type === "movie") {
        totalMinutes += runtime;
        mediaMinutes.movie += runtime;
      } else if (t.media_type === "tv") {
        const episodes = t.progress || 10;
        totalMinutes += runtime * episodes;
        mediaMinutes.tv += runtime * episodes;
      } else if (t.media_type === "anime") {
        const episodes = t.progress || 12;
        totalMinutes += runtime * episodes;
        mediaMinutes.anime += runtime * episodes;
      }
    }
    const totalHours = Math.round(totalMinutes / 60);

    // ── Per-type stats for client-side tab switching ──
    const typeStats: Record<string, { watched: number; rated: number; avgRating: number | string; hours: number }> = {
      movie: { watched: 0, rated: 0, avgRating: "—", hours: 0 },
      tv: { watched: 0, rated: 0, avgRating: "—", hours: 0 },
      anime: { watched: 0, rated: 0, avgRating: "—", hours: 0 },
    };
    for (const [mt, label] of [["movie", "movie"], ["tv", "tv"], ["anime", "anime"]] as const) {
      const typeWatched = watched.filter(t => t.media_type === mt);
      const typeRated = allRated.filter(r => r.mediaType === mt);
      typeStats[label].watched = typeWatched.length;
      typeStats[label].rated = typeRated.length;
      typeStats[label].avgRating = typeRated.length > 0
        ? Math.round((typeRated.reduce((s, r) => s + r.rating, 0) / typeRated.length) * 10) / 10
        : "—";
      typeStats[label].hours = Math.round((mediaMinutes[label] || 0) / 60);
    }

    // ── 7. Genre distribution (shared metadata cache: TMDB/AniList genres) ──
    const genreCounts: Record<string, number> = {};
    const processedIds = new Set<number>();
    const animeIds: number[] = [];

    // Seed from global genre cache — skip external lookups for known titles
    const nonAnimeTracking = (tracking || []).filter(t => t.media_type !== "anime");
    const knownGenres = await loadKnownGenres(nonAnimeTracking);
    const freshGenreRows: { tmdb_id: number; media_type: string; genres: string[] }[] = [];

    for (const t of tracking || []) {
      if (processedIds.has(t.tmdb_id)) continue;
      processedIds.add(t.tmdb_id);

      if (t.media_type === "anime") {
        animeIds.push(t.tmdb_id);
        continue;
      }

      const cached = knownGenres.get(t.tmdb_id);
      if (cached) {
        for (const name of cached) genreCounts[name] = (genreCounts[name] || 0) + 1;
        continue;
      }

      try {
        const ep = t.media_type === "movie" ? `/movie/${t.tmdb_id}` : `/tv/${t.tmdb_id}`;
        const detail = await tmdbGet(ep);
        const names = (detail.genres || []).map((g: any) => g.name);
        for (const name of names) {
          genreCounts[name] = (genreCounts[name] || 0) + 1;
        }
        if (names.length > 0) freshGenreRows.push({ tmdb_id: t.tmdb_id, media_type: t.media_type, genres: names });
      } catch { /* skip */ }
    }

    if (freshGenreRows.length > 0) await saveGenres(freshGenreRows);

    // Anime genres from AniList
    if (animeIds.length > 0) {
      for (const anilistId of animeIds.slice(0, 30)) {
        try {
          const res = await fetch(ANILIST_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `query($id:Int){Media(id:$id){genres duration}}`,
              variables: { id: anilistId },
            }),
          });
          const json = await res.json();
          for (const g of json.data?.Media?.genres || []) {
            genreCounts[g] = (genreCounts[g] || 0) + 1;
          }
        } catch { /* skip */ }
      }
    }

    const topGenres = Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // ── 8. Top actors/directors (from projects rated > 0) — shared credits cache ──
    const actorMap: Record<string, { count: number; id: number; image: string | null }> = {};
    const directorMap: Record<string, { count: number; id: number; personSource: string; image: string | null }> = {};
    const ratedTmdbIds = [...new Set(allRated.map(r => {
      const track = tracking?.find(t => t.tmdb_id && t.rating === r.rating);
      return track?.tmdb_id;
    }).filter(Boolean))];

    const ANILIST_URL = "https://graphql.anilist.co";

    // Seed from global credits cache (TMDB movie/tv only — anime uses AniList staff)
    const ratedNonAnime = ratedTmdbIds
      .map(id => ({ tmdb_id: id, media_type: tracking?.find(t => t.tmdb_id === id)?.media_type || "movie" }))
      .filter(x => x.media_type !== "anime");
    const knownCredits = await loadKnownCredits(ratedNonAnime);
    const freshCreditRows: { tmdb_id: number; media_type: string; credits: object }[] = [];

    for (const tmdbId of ratedTmdbIds.slice(0, 20)) {
      try {
        const track = tracking?.find(t => t.tmdb_id === tmdbId);
        const mt = track?.media_type || "movie";

        if (mt === "anime") {
          const anilistId = track?.anilist_id;
          if (anilistId) {
            const q = `{Media(id:${anilistId}){staff(sort:RELEVANCE,perPage:8){edges{role node{id name{full}image{large}}}}}}`;
            const res = await fetch(ANILIST_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) });
            const data = await res.json();
            for (const edge of data?.data?.Media?.staff?.edges || []) {
              if (edge.role === "Director") {
                const name = edge.node?.name?.full || "Unknown";
                if (!directorMap[name]) directorMap[name] = { count: 0, id: edge.node.id, personSource: "anilist", image: edge.node?.image?.large || null };
                directorMap[name].count++;
              }
            }
          }
          continue;
        }

        // Seed from cache
        const cached = knownCredits.get(tmdbId);
        if (cached) {
          for (const a of cached.actors || []) {
            if (!actorMap[a.name]) actorMap[a.name] = { count: 0, id: a.id, image: a.image };
            actorMap[a.name].count++;
          }
          for (const d of cached.directors || []) {
            if (!directorMap[d.name]) directorMap[d.name] = { count: 0, id: d.id, personSource: d.personSource, image: d.image };
            directorMap[d.name].count++;
          }
          continue;
        }

        const credits = await tmdbGet(`/${mt}/${tmdbId}/credits`);
        const actors = (credits.cast || []).slice(0, 10).map((c: any) => ({ name: c.name, id: c.id, image: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null }));
        const directors = (credits.crew || []).filter((c: any) => c.job === "Director").map((c: any) => ({ name: c.name, id: c.id, personSource: "tmdb", image: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null }));
        for (const a of actors) {
          if (!actorMap[a.name]) actorMap[a.name] = { count: 0, id: a.id, image: a.image };
          actorMap[a.name].count++;
        }
        for (const d of directors) {
          if (!directorMap[d.name]) directorMap[d.name] = { count: 0, id: d.id, personSource: d.personSource, image: d.image };
          directorMap[d.name].count++;
        }
        freshCreditRows.push({ tmdb_id: tmdbId, media_type: mt, credits: { actors, directors } });
      } catch { /* skip */ }
    }

    if (freshCreditRows.length > 0) await saveCredits(freshCreditRows);

    const topActors = Object.entries(actorMap)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 8)
      .map(([name, info]) => ({ name, count: info.count, personId: info.id, personSource: "tmdb" as const, image: info.image }));

    const topDirectors = Object.entries(directorMap)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([name, info]) => ({ name, count: info.count, personId: info.id, personSource: info.personSource, image: info.image }));

    // ── 9. Monthly watch heatmap (last 12 months) ──
    // Past (completed) months never change, so we persist them in
    // monthly_watch_snapshot and skip recomputing them on every profile visit.
    // Only the current month is computed live from tracking below.
    const monthlyWatch: Record<string, number> = {};
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // Load persisted past-month counts
    try {
      const { data: snapshots } = await supabaseAdmin
        .from("monthly_watch_snapshot")
        .select("year_month, count")
        .eq("username", username);
      for (const s of snapshots || []) {
        if (s.year_month !== currentMonthKey) monthlyWatch[s.year_month] = s.count;
      }
    } catch { /* ignore */ }

    // Compute the current month live from tracking
    for (const t of watched) {
      const date = t.watched_at ? new Date(t.watched_at) : (t.updated_at ? new Date(t.updated_at) : null);
      if (!date || date < twelveMonthsAgo) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (key === currentMonthKey) monthlyWatch[key] = (monthlyWatch[key] || 0) + 1;
    }

    // Persist completed months (anything before the current month in our window)
    // as immutable snapshots so future visits don't recompute them.
    const snapshotUpserts: { username: string; year_month: string; count: number }[] = [];
    for (const [key, count] of Object.entries(monthlyWatch)) {
      if (key !== currentMonthKey) {
        snapshotUpserts.push({ username, year_month: key, count });
      }
    }
    if (snapshotUpserts.length > 0) {
      void supabaseAdmin
        .from("monthly_watch_snapshot")
        .upsert(snapshotUpserts, { onConflict: "username,year_month" })
        .then(() => {}, () => {});
    }

    // Fill in missing months with 0 (display completeness)
    for (let m = 0; m < 12; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!(key in monthlyWatch)) monthlyWatch[key] = 0;
    }

    // ── 10. Yearly recap (current year) ──
    const currentYear = now.getFullYear();
    const thisYearWatched = watched.filter(t => {
      const d = t.watched_at ? new Date(t.watched_at) : (t.updated_at ? new Date(t.updated_at) : null);
      return d && d.getFullYear() === currentYear;
    });

    let yearlyHours = 0;
    for (const t of thisYearWatched) {
      const runtime = runtimeMap.get(t.tmdb_id);
      if (!runtime || runtime <= 0) continue;
      if (t.media_type === "movie") {
        yearlyHours += runtime;
      } else if (t.media_type === "tv") {
        yearlyHours += runtime * (t.progress || 10);
      } else if (t.media_type === "anime") {
        yearlyHours += runtime * (t.progress || 12);
      }
    }
    yearlyHours = Math.round(yearlyHours / 60);

    // Top rated this year
    const thisYearRated = thisYearWatched
      .filter(t => t.rating && t.rating > 0)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 3)
      .map(t => ({ tmdb_id: t.tmdb_id, media_type: t.media_type, rating: t.rating }));

    // Top genre this year
    const yearGenreCounts: Record<string, number> = {};
    for (const t of thisYearWatched) {
      const matchingRated = allRated.find(r => {
        const track = tracking?.find(tr => tr.tmdb_id === t.tmdb_id);
        return track?.tmdb_id === t.tmdb_id && r.rating === track?.rating;
      });
      // Use genre data from the main genre counts (simplified — actual genre per title would need per-title lookups)
    }

    const yearlyRecap = {
      hours: yearlyHours,
      titles: thisYearWatched.length,
      topRated: thisYearRated,
    };

    // ── 11. Viewer DNA: Style & Taste ──

    // --- Style: rating trait + watching pattern ---
    const ratedCount = allRated.length;
    const watchedCount = watched.length;
    const { movie, tv, anime } = mediaBreakdown;
    const totalTracked = movie + tv + anime;

    // Rating trait
    let ratingTrait: string;
    let ratingTraitDesc: string;
    if (ratedCount === 0) {
      ratingTrait = "";
      ratingTraitDesc = "";
    } else if (avgRating >= 4.0) {
      ratingTrait = "Enthusiastic";
      ratingTraitDesc = "You rate generously — you find joy in most things you watch.";
    } else if (avgRating >= 3.0) {
      ratingTrait = "Balanced";
      ratingTraitDesc = "You have a balanced eye — appreciative but discerning.";
    } else {
      ratingTrait = "Selective";
      ratingTraitDesc = "You have high standards — only the best earn your praise.";
    }

    // Watching pattern
    let pattern: string;
    let patternDesc: string;
    if (watchedCount < 5) {
      pattern = "Newcomer";
      patternDesc = "Just getting started.";
    } else if (completionRate >= 70 && ratedCount >= 5) {
      pattern = "Completionist";
      patternDesc = "Sees every story through to the end.";
    } else if (completionRate < 40 && watchedCount >= 10) {
      pattern = "Explorer";
      patternDesc = "Always chasing the next discovery.";
    } else if (totalTracked > 0 && (movie / totalTracked) >= 0.6) {
      pattern = "Movie Buff";
      patternDesc = "Drawn to cinematic storytelling.";
    } else if (totalTracked > 0 && (tv / totalTracked) >= 0.5) {
      pattern = "Series Devotee";
      patternDesc = "Lives for deep character journeys.";
    } else if (totalTracked > 0 && (anime / totalTracked) >= 0.5) {
      pattern = "Anime Fan";
      patternDesc = "Animation is your medium.";
    } else if (watchedCount >= 100) {
      pattern = "Binge Watcher";
      patternDesc = "Devouring content at an impressive pace.";
    } else {
      pattern = "Casual Viewer";
      patternDesc = "Watching at your own rhythm.";
    }

    const styleLabel = ratingTrait && pattern
      ? `${ratingTrait} ${pattern}`
      : pattern || "Analyzing...";
    const styleDesc = patternDesc || "Rate a few titles to reveal your watching personality.";

    // --- Taste: top genres ---
    const topGenreNames = topGenres.slice(0, 2).map(g => g.name);
    const tasteLabel = topGenreNames.length >= 2
      ? `${topGenreNames[0]} & ${topGenreNames[1]}`
      : topGenreNames.length === 1
        ? topGenreNames[0]
        : "Undiscovered";
    const tasteDesc = topGenreNames.length > 0
      ? `Your ratings reveal a love for ${topGenreNames.join(" and ")}.`
      : "Watch and rate more to reveal your taste.";

    const styleReady = ratedCount > 0 || watchedCount >= 5;
    const tasteReady = topGenreNames.length > 0;

    const viewerDNA = {
      style: styleReady ? styleLabel : "Analyzing...",
      styleDescription: styleReady ? styleDesc : "Rate a few titles to reveal your watching personality.",
      styleReady,
      styleStatus: styleReady
        ? null
        : ratedCount > 0
          ? `Watched ${watchedCount}/5 titles — watch ${5 - watchedCount} more to analyze`
          : watchedCount >= 5
            ? `Rated ${ratedCount}/1 — rate at least 1 title`
            : `Rated ${ratedCount}/1 · Watched ${watchedCount}/5`,
      taste: tasteReady ? tasteLabel : "Analyzing...",
      tasteDescription: tasteReady ? tasteDesc : "The more you watch and rate, the clearer your taste becomes.",
      tasteReady,
      tasteStatus: tasteReady
        ? null
        : "Collecting genre data...",
    };

    const payload = {
      totals: {
        watched: watched.length,
        watching: watching.length,
        planned: planned.length,
        rated: allRated.length,
        reviewed: reviewedItems.length,
        hours: totalHours,
      },
      completion: {
        rate: completionRate,
        started: seriesStarted.length,
        completed: seriesCompleted.length,
      },
      rating: {
        average: avgRating,
        distribution: Object.entries(ratingBuckets).map(([score, count]) => ({
          score: parseFloat(score),
          count,
        })),
      },
      mediaBreakdown,
      mediaHours: {
        movie: Math.round(mediaMinutes.movie / 60),
        tv: Math.round(mediaMinutes.tv / 60),
        anime: Math.round(mediaMinutes.anime / 60),
      },
      typeStats,
      genres: topGenres,
      topActors,
      topDirectors,
      monthlyWatch: Object.entries(monthlyWatch)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count })),
      yearlyRecap,
      viewerDNA,
    };

    // Persist computed stats (non-blocking) so the next request is instant
    void supabaseAdmin
      .from("user_stats_cache")
      .upsert(
        { username, stats: payload, updated_at: new Date().toISOString() },
        { onConflict: "username" }
      )
      .then(() => {}, () => {});

    const resp = NextResponse.json(payload);
    // Cache freshly computed stats so repeat visits skip the recompute entirely.
    resp.headers.set("Cache-Control", "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400");
    resp.headers.set("CDN-Cache-Control", "public, s-maxage=21600");
    return resp;
  } catch (err: any) {
    console.error("Stats error:", err);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
