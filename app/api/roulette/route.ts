import { NextRequest, NextResponse } from "next/server";
import {
  getWatchedInLastDays,
  getAllWatchedIds,
  analyzeTopGenres,
  analyzeYearRange,
  genresToTMDBIds,
  searchTMDBWithFilters,
  searchAniListWithFilters,
} from "@/lib/roulette-user";

export const dynamic = "force-dynamic";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_IMAGE = "https://image.tmdb.org/t/p/w780";
const ANILIST_API = "https://graphql.anilist.co";

export async function GET(_req: NextRequest) {
  try {
    // ─── Auth check ───
    const { createClient: createServerClient } = await import("@/lib/supabase/server");
    const supabase = await createServerClient();
    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData.user?.user_metadata?.username;
    if (!currentUser) {
      return NextResponse.json({ empty: true, message: "Sign in to spin!" }, { status: 200 });
    }

    // ─── Period: opposite half-year ───
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    let startDate: string;
    let endDate: string;
    let periodLabel: string;

    if (currentMonth <= 6) {
      startDate = `${currentYear - 1}-07-01`;
      endDate = `${currentYear - 1}-12-31`;
      periodLabel = `${currentYear - 1} H2`;
    } else {
      startDate = `${currentYear}-01-01`;
      endDate = `${currentYear}-06-30`;
      periodLabel = `${currentYear} H1`;
    }

    // ─── Random media type ───
    const types = ["movie", "tv", "anime"] as const;
    const mediaType = types[Math.floor(Math.random() * types.length)];

    // ─── Fetch user data in parallel ───
    const [recentWatched, watchedIds] = await Promise.all([
      getWatchedInLastDays(currentUser, 3),
      getAllWatchedIds(currentUser),
    ]);

    const [topGenres, yearRange] = await Promise.all([
      analyzeTopGenres(recentWatched),
      analyzeYearRange(recentWatched),
    ]);

    const genreIds = genresToTMDBIds(topGenres);

    // ─── Tier search ───
    let results: any[] = [];
    let tier = 4;
    let reason = "";

    if (mediaType === "anime") {
      // ─── Anime path ───
      const seasons = currentMonth <= 6
        ? ["SUMMER", "FALL"]
        : ["WINTER", "SPRING"];
      const searchYear = currentMonth <= 6 ? currentYear - 1 : currentYear;

      // Tier 1: genre + year + exclude
      if (topGenres.length > 0 && yearRange) {
        results = await searchAniListWithFilters({
          genres: topGenres,
          yearGte: yearRange.minYear,
          yearLte: yearRange.maxYear,
          excludeIds: watchedIds.anilistIds,
          seasons,
          searchYear,
        });
        if (results.length >= 5) {
          tier = 1;
          reason = `You've been into ${topGenres.join(" & ")} lately`;
        }
      }

      // Tier 2: genre + exclude
      if (results.length < 5 && topGenres.length > 0) {
        results = await searchAniListWithFilters({
          genres: topGenres,
          excludeIds: watchedIds.anilistIds,
          seasons,
          searchYear,
        });
        if (results.length >= 5) {
          tier = 2;
          reason = `You've been into ${topGenres.join(" & ")} lately`;
        }
      }

      // Tier 3: year + exclude
      if (results.length < 5 && yearRange) {
        results = await searchAniListWithFilters({
          yearGte: yearRange.minYear,
          yearLte: yearRange.maxYear,
          excludeIds: watchedIds.anilistIds,
          seasons,
          searchYear,
        });
        if (results.length >= 5) {
          tier = 3;
          reason = "From your era";
        }
      }

      // Tier 4: exclude only (original logic)
      if (results.length === 0) {
        results = await searchAniListWithFilters({
          excludeIds: watchedIds.anilistIds,
          seasons,
          searchYear,
        });
        tier = 4;
        reason = "Just something different";
      }

      if (results.length === 0) {
        return NextResponse.json({
          empty: true,
          message: `No popular anime found for ${periodLabel}. Try again!`,
        }, { status: 200 });
      }

      const random = results[Math.floor(Math.random() * results.length)];
      const runtimeStr = `${(random.episodes || "?")} eps`;

      return NextResponse.json({
        id: random.id,
        mediaType: "anime",
        title: random.title?.english || random.title?.romaji || "Unknown",
        poster: random.coverImage?.extraLarge || random.coverImage?.large || null,
        backdrop: random.bannerImage || null,
        year: random.startDate?.year ? String(random.startDate.year) : "",
        rating: random.averageScore ? Math.round(random.averageScore) / 10 : 0,
        genres: (random.genres || []).slice(0, 3),
        overview: random.description || "",
        director: "",
        runtime: runtimeStr,
        tagline: "",
        periodLabel,
        spunType: "anime",
        reason,
        tier,
      });
    }

    // ─── TMDB path (movie / tv) ───
    const tmdbType = mediaType as "movie" | "tv";

    // Tier 1: genre + year + exclude
    if (genreIds.length > 0 && yearRange) {
      results = await searchTMDBWithFilters({
        mediaType: tmdbType,
        genreIds,
        yearGte: yearRange.minYear,
        yearLte: yearRange.maxYear,
        excludeIds: watchedIds.tmdbIds,
        periodStart: startDate,
        periodEnd: endDate,
      });
      if (results.length >= 5) {
        tier = 1;
        reason = `You've been into ${topGenres.join(" & ")} lately`;
      }
    }

    // Tier 2: genre + exclude
    if (results.length < 5 && genreIds.length > 0) {
      results = await searchTMDBWithFilters({
        mediaType: tmdbType,
        genreIds,
        excludeIds: watchedIds.tmdbIds,
        periodStart: startDate,
        periodEnd: endDate,
      });
      if (results.length >= 5) {
        tier = 2;
        reason = `You've been into ${topGenres.join(" & ")} lately`;
      }
    }

    // Tier 3: year + exclude
    if (results.length < 5 && yearRange) {
      results = await searchTMDBWithFilters({
        mediaType: tmdbType,
        yearGte: yearRange.minYear,
        yearLte: yearRange.maxYear,
        excludeIds: watchedIds.tmdbIds,
        periodStart: startDate,
        periodEnd: endDate,
      });
      if (results.length >= 5) {
        tier = 3;
        reason = "From your era";
      }
    }

    // Tier 4: exclude only (original logic)
    if (results.length === 0) {
      results = await searchTMDBWithFilters({
        mediaType: tmdbType,
        excludeIds: watchedIds.tmdbIds,
        periodStart: startDate,
        periodEnd: endDate,
      });
      tier = 4;
      reason = "Just something different";
    }

    if (results.length === 0) {
      return NextResponse.json({
        empty: true,
        message: `No popular ${tmdbType === "movie" ? "movies" : "TV shows"} found for ${periodLabel}. Try again!`,
      }, { status: 200 });
    }

    // ─── Random pick + detail ───
    const random = results[Math.floor(Math.random() * results.length)];

    // Fetch full details + credits
    const detailRes = await fetch(
      `${TMDB_API}/${tmdbType}/${random.id}?api_key=${TMDB_KEY}&language=en-US`
    );
    if (!detailRes.ok) {
      return NextResponse.json({ error: "TMDB detail fetch failed" }, { status: 500 });
    }
    const detail = await detailRes.json();

    // Credits for director
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
        ? `https://image.tmdb.org/t/p/original${detail.backdrop_path}`
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
      reason,
      tier,
    });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
