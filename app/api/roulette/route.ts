import { NextRequest, NextResponse } from "next/server";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_IMAGE = "https://image.tmdb.org/t/p/w500";

/**
 * SPIN LOGIC:
 * - Current date in H1 (Jan–Jun) → pick from last year's H2 (Jul–Dec)
 * - Current date in H2 (Jul–Dec) → pick from this year's H1 (Jan–Jun)
 * - Randomly chooses from Movies, TV Shows, or Anime
 * - Fetches top 20 popular from TMDB Discover for that period
 * - Picks one at random with full details
 */

export async function GET(_req: NextRequest) {
  try {
    // Auth check — login required
    const { createClient: createServerClient } = await import("@/lib/supabase/server");
    const supabase = await createServerClient();
    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData.user?.user_metadata?.username;
    if (!currentUser) {
      return NextResponse.json({ empty: true, message: "Sign in to spin!" }, { status: 200 });
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1–12

    let startDate: string;
    let endDate: string;
    let periodLabel: string;

    if (currentMonth <= 6) {
      // H1: use last year's H2
      startDate = `${currentYear - 1}-07-01`;
      endDate = `${currentYear - 1}-12-31`;
      periodLabel = `${currentYear - 1} H2`;
    } else {
      // H2: use this year's H1
      startDate = `${currentYear}-01-01`;
      endDate = `${currentYear}-06-30`;
      periodLabel = `${currentYear} H1`;
    }

    // Randomly pick media type: movie, tv, or anime
    const types = ["movie", "tv", "anime"] as const;
    const mediaType = types[Math.floor(Math.random() * types.length)];

    let discoverUrl: string;
    let dateField: string;

    if (mediaType === "movie") {
      dateField = "primary_release_date";
      discoverUrl = `${TMDB_API}/discover/movie?sort_by=popularity.desc&${dateField}.gte=${startDate}&${dateField}.lte=${endDate}&vote_count.gte=100&language=en-US`;
    } else if (mediaType === "anime") {
      // Anime = TV animation + Japanese language
      dateField = "first_air_date";
      discoverUrl = `${TMDB_API}/discover/tv?sort_by=popularity.desc&${dateField}.gte=${startDate}&${dateField}.lte=${endDate}&with_genres=16&with_original_language=ja&vote_count.gte=50&language=en-US`;
    } else {
      // TV (non-anime)
      dateField = "first_air_date";
      discoverUrl = `${TMDB_API}/discover/tv?sort_by=popularity.desc&${dateField}.gte=${startDate}&${dateField}.lte=${endDate}&vote_count.gte=50&language=en-US&without_genres=16`;
    }

    // Fetch top 20
    const discoverRes = await fetch(`${discoverUrl}&api_key=${TMDB_KEY}`);
    if (!discoverRes.ok) {
      return NextResponse.json({ error: "TMDB discover failed" }, { status: 500 });
    }
    const discoverData = await discoverRes.json();

    if (!discoverData.results || discoverData.results.length === 0) {
      return NextResponse.json({
        empty: true,
        message: `No popular ${mediaType === "anime" ? "anime" : mediaType === "movie" ? "movies" : "TV shows"} found for ${periodLabel}. Try again!`,
      }, { status: 200 });
    }

    // Pick random from top 20
    const pool = discoverData.results.slice(0, 20);
    const random = pool[Math.floor(Math.random() * pool.length)];

    // Fetch full details + credits
    const tmdbType = mediaType === "anime" ? "tv" : mediaType;
    const detailRes = await fetch(
      `${TMDB_API}/${tmdbType}/${random.id}?api_key=${TMDB_KEY}&language=en-US`
    );
    if (!detailRes.ok) {
      return NextResponse.json({ error: "TMDB detail fetch failed" }, { status: 500 });
    }
    const detail = await detailRes.json();

    // Fetch credits for director
    let director = "Unknown";
    try {
      const creditsRes = await fetch(
        `${TMDB_API}/${tmdbType}/${random.id}/credits?api_key=${TMDB_KEY}`
      );
      if (creditsRes.ok) {
        const credits = await creditsRes.json();
        const dir = credits.crew?.find((c: any) => c.job === "Director");
        if (dir) director = dir.name;
      }
    } catch {}

    const runtime = detail.runtime || detail.episode_run_time?.[0] || 0;
    const runtimeStr = runtime
      ? tmdbType === "movie"
        ? `${runtime} min`
        : `${runtime}m / ep`
      : "";

    return NextResponse.json({
      id: detail.id,
      mediaType: tmdbType,
      title: detail.title || detail.name,
      poster: detail.poster_path ? `${TMDB_IMAGE}${detail.poster_path}` : null,
      backdrop: detail.backdrop_path
        ? `https://image.tmdb.org/t/p/w780${detail.backdrop_path}`
        : null,
      year: (detail.release_date || detail.first_air_date || "").slice(0, 4),
      rating: Math.round((detail.vote_average || 0) * 10) / 10,
      genres: (detail.genres || []).slice(0, 3).map((g: any) => g.name),
      overview: detail.overview || "",
      director,
      runtime: runtimeStr || null,
      tagline: detail.tagline || "",
      periodLabel,
      spunType: mediaType,
    });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
