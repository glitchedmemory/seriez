import { NextRequest, NextResponse } from "next/server";
import { resolveUserId } from "@/lib/user-utils";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_IMAGE = "https://image.tmdb.org/t/p/w500";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");

  try {
    let tmdbId: number;
    let mediaType: string;

    if (username) {
      const userId = await resolveUserId(username);
      if (!userId) {
        return NextResponse.json({ empty: true, message: "User not found" }, { status: 200 });
      }
      // Pick a random item from user's watchlist
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/media_trackings?select=tmdb_id,media_type&status=eq.plan_to_watch&username=eq.${encodeURIComponent(userId)}`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        }
      );

      if (!res.ok) {
        return NextResponse.json({ error: "Failed to fetch watchlist" }, { status: 500 });
      }

      const watchlist: { tmdb_id: number; media_type: string }[] = await res.json();

      if (watchlist.length === 0) {
        return NextResponse.json({ empty: true, message: "Your watchlist is empty. Add movies to spin!" }, { status: 200 });
      }

      const random = watchlist[Math.floor(Math.random() * watchlist.length)];
      tmdbId = random.tmdb_id;
      mediaType = random.media_type;
    } else {
      return NextResponse.json({ empty: true, message: "Sign in to spin your watchlist!" }, { status: 200 });
    }

    // Fetch TMDB details
    const detailRes = await fetch(
      `${TMDB_API}/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}&language=en-US`
    );
    if (!detailRes.ok) {
      return NextResponse.json({ error: "TMDB fetch failed" }, { status: 500 });
    }
    const detail = await detailRes.json();

    // Fetch credits for director
    let director = "Unknown";
    try {
      const creditsRes = await fetch(
        `${TMDB_API}/${mediaType}/${tmdbId}/credits?api_key=${TMDB_KEY}`
      );
      if (creditsRes.ok) {
        const credits = await creditsRes.json();
        const dir = credits.crew?.find(
          (c: any) => c.job === "Director"
        );
        if (dir) director = dir.name;
      }
    } catch {}

    const runtime = detail.runtime || detail.episode_run_time?.[0] || 0;
    const runtimeStr = runtime
      ? mediaType === "movie"
        ? `${runtime} min`
        : `${runtime}m / ep`
      : "";

    return NextResponse.json({
      id: detail.id,
      mediaType,
      title: detail.title || detail.name,
      poster: detail.poster_path ? `${TMDB_IMAGE}${detail.poster_path}` : null,
      backdrop: detail.backdrop_path ? `https://image.tmdb.org/t/p/w780${detail.backdrop_path}` : null,
      year: (detail.release_date || detail.first_air_date || "").slice(0, 4),
      rating: Math.round((detail.vote_average || 0) * 10) / 10,
      genres: (detail.genres || []).slice(0, 3).map((g: any) => g.name),
      overview: detail.overview || "",
      director,
      runtime: runtimeStr || null,
      tagline: detail.tagline || "",
      watchlistCount: 0, // placeholder, set by client if needed
    });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
