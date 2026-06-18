import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GENRE_MAP } from "@/lib/tmdb";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";

// ─── TMDB helpers ───
async function tmdbGet(endpoint: string) {
  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

// ─── AniList helpers ───
const ANILIST_API = "https://graphql.anilist.co";

// ─── Rating conversion (DB stores mixed scales: ×10 int or 0–10 int) ───
const FROM_DB = (v: number) => v > 10 ? v / 10 : v > 5 ? v / 2 : v;

// ─── TMDB runtime batch fetcher (with free fallbacks: Wikidata + AniList) ───
async function fetchRuntimes(
  tracking: { tmdb_id: number; media_type: string }[]
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  const movieIds = [...new Set(tracking.filter(t => t.media_type === "movie").map(t => t.tmdb_id))];
  const tvIds = [...new Set(tracking.filter(t => t.media_type === "tv" || t.media_type === "anime").map(t => t.tmdb_id))];

  const BATCH = 8;

  // ── Source 1: TMDB (primary) ──
  // Also capture titles for downstream fallback searches
  const titleMap = new Map<number, string>();

  // Movies → runtime
  for (let i = 0; i < movieIds.length; i += BATCH) {
    const batch = movieIds.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(id =>
        fetch(`${TMDB_BASE}/movie/${id}?api_key=${TMDB_API_KEY}&language=en-US`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
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
        fetch(`${TMDB_BASE}/tv/${id}?api_key=${TMDB_API_KEY}&language=en-US`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
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

  return map;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const { searchParams } = new URL(req.url);
  const mediaType = searchParams.get("mediaType"); // movie | tv | anime | null

  try {
    // ── 1. Get user_id ──
    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .single();

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = userData.id;

    // ── 2. Fetch all tracking data ──
    let trackingQuery = supabaseAdmin
      .from("media_trackings")
      .select("tmdb_id, media_type, status, rating, progress, watched_at, updated_at")
      .eq("username", userId);
    if (mediaType) trackingQuery = trackingQuery.eq("media_type", mediaType);
    const { data: tracking } = await trackingQuery;

    // ── 3. Fetch actual TMDB runtimes (in background — non-blocking for core data) ──
    const runtimeMap = tracking ? await fetchRuntimes(tracking) : new Map<number, number>();

    // ── 4. Fetch all reviews ──
    let reviewsQuery = supabase
      .from("reviews")
      .select("tmdb_id, media_type, rating")
      .eq("username", username);
    if (mediaType) reviewsQuery = reviewsQuery.eq("media_type", mediaType);
    const { data: reviews } = await reviewsQuery;

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

    // ── 7. Genre distribution ──
    const genreCounts: Record<string, number> = {};
    const processedIds = new Set<number>();
    const animeIds: number[] = [];

    for (const t of tracking || []) {
      if (processedIds.has(t.tmdb_id)) continue;
      processedIds.add(t.tmdb_id);

      if (t.media_type === "anime") {
        animeIds.push(t.tmdb_id);
        continue;
      }

      try {
        const ep = t.media_type === "movie" ? `/movie/${t.tmdb_id}` : `/tv/${t.tmdb_id}`;
        const detail = await tmdbGet(ep);
        for (const g of detail.genres || []) {
          const name = g.name;
          genreCounts[name] = (genreCounts[name] || 0) + 1;
        }
      } catch { /* skip */ }
    }

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

    // ── 8. Top actors/directors (from projects rated > 0) ──
    const actorCounts: Record<string, number> = {};
    const directorCounts: Record<string, number> = {};
    const ratedTmdbIds = [...new Set(allRated.map(r => {
      const track = tracking?.find(t => t.tmdb_id && t.rating === r.rating);
      return track?.tmdb_id;
    }).filter(Boolean))];

    for (const tmdbId of ratedTmdbIds.slice(0, 20)) {
      try {
        const track = tracking?.find(t => t.tmdb_id === tmdbId);
        const mt = track?.media_type || "movie";
        if (mt === "anime") continue;
        const ep = mt === "movie" ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;

        const credits = await tmdbGet(`/${mt}/${tmdbId}/credits`);
        for (const cast of (credits.cast || []).slice(0, 10)) {
          actorCounts[cast.name] = (actorCounts[cast.name] || 0) + 1;
        }
        for (const crew of (credits.crew || []).filter((c: any) => c.job === "Director")) {
          directorCounts[crew.name] = (directorCounts[crew.name] || 0) + 1;
        }
      } catch { /* skip */ }
    }

    const topActors = Object.entries(actorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    const topDirectors = Object.entries(directorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // ── 9. Monthly watch heatmap (last 12 months) ──
    const monthlyWatch: Record<string, number> = {};
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    for (const t of watched) {
      const date = t.watched_at ? new Date(t.watched_at) : (t.updated_at ? new Date(t.updated_at) : null);
      if (date && date >= twelveMonthsAgo) {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        monthlyWatch[key] = (monthlyWatch[key] || 0) + 1;
      }
    }

    // Fill in missing months with 0
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
    const styleLabel = avgRating >= 4.0
      ? "Enthusiast"
      : avgRating >= 3.0
        ? "Balanced Watcher"
        : allRated.length > 0
          ? "Selective Critic"
          : "Newcomer";
    const styleDesc = avgRating >= 4.0
      ? "You rate generously — you find joy in most things you watch."
      : avgRating >= 3.0
        ? "You have a balanced eye — appreciative but discerning."
        : allRated.length > 0
          ? "You have high standards — only the best earn your praise."
          : "Start rating to reveal your watching style.";

    const topGenreNames = topGenres.slice(0, 2).map(g => g.name);
    const tasteLabel = topGenreNames.length >= 2
      ? `${topGenreNames[0]} & ${topGenreNames[1]}`
      : topGenreNames.length === 1
        ? topGenreNames[0]
        : "Undiscovered";
    const tasteDesc = topGenreNames.length > 0
      ? `Your ratings reveal a love for ${topGenreNames.join(" and ")}.`
      : "Watch and rate more to reveal your taste.";

    const viewerDNA = {
      style: allRated.length > 0 ? styleLabel : "Analyzing...",
      styleDescription: allRated.length > 0 ? styleDesc : "Rate a few titles to reveal your watching personality.",
      taste: topGenreNames.length > 0 ? tasteLabel : "Analyzing...",
      tasteDescription: topGenreNames.length > 0 ? tasteDesc : "The more you watch and rate, the clearer your taste becomes.",
    };

    return NextResponse.json({
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
      genres: topGenres,
      topActors,
      topDirectors,
      monthlyWatch: Object.entries(monthlyWatch)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count })),
      yearlyRecap,
      viewerDNA,
    });
  } catch (err: any) {
    console.error("Stats error:", err);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
