import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GENRE_MAP, discoverByGenres, type TmdbResult } from "@/lib/tmdb";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";

const supabase = createClient(supabaseUrl, supabaseKey);

async function tmdbGet(endpoint: string) {
  const url = `${TMDB_BASE}${endpoint}?api_key=${TMDB_API_KEY}&language=en-US`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");

  if (!username?.trim()) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  // 1. Get all reviews by this user
  const { data: reviews, error: reviewsError } = await supabase
    .from("reviews")
    .select("tmdb_id, media_type, rating")
    .eq("username", username.trim())
    .order("created_at", { ascending: false })
    .limit(30);

  if (reviewsError) {
    return NextResponse.json({ error: reviewsError.message }, { status: 500 });
  }

  if (!reviews?.length) {
    return NextResponse.json({
      items: [],
      genres: [],
      reason: "Rate some titles to get personalized recommendations",
    });
  }

  // 2. Fetch TMDB details for each rated item to collect genres
  const genreCounts: Record<number, number> = {};
  const ratedIds = new Set<number>();

  for (const review of reviews) {
    if (ratedIds.has(review.tmdb_id)) continue;
    ratedIds.add(review.tmdb_id);

    try {
      const endpoint =
        review.media_type === "movie"
          ? `/movie/${review.tmdb_id}`
          : `/tv/${review.tmdb_id}`;
      const detail = await tmdbGet(endpoint);
      for (const g of detail.genres || []) {
        genreCounts[g.id] = (genreCounts[g.id] || 0) + 1;
      }
    } catch {
      // skip unavailable items
    }
  }

  // 3. Get top 3 genres
  const topGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([id]) => parseInt(id));

  if (!topGenres.length) {
    return NextResponse.json({
      items: [],
      genres: [],
      reason: "Could not determine your preferences yet",
    });
  }

  // 4. Discover recommendations by top genres & exclude already-rated
  let items: TmdbResult[] = [];
  try {
    items = await discoverByGenres(topGenres);
    // Filter out titles the user already rated
    items = items.filter((item) => !ratedIds.has(item.id));
  } catch {
    return NextResponse.json({
      items: [],
      genres: topGenres.map((id) => GENRE_MAP[id] || String(id)),
      reason: "Discovery service temporarily unavailable",
    });
  }

  const genreNames = topGenres.map((id) => GENRE_MAP[id] || String(id));

  return NextResponse.json({ items, genres: genreNames });
}
