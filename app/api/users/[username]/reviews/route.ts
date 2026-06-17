import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TMDB_API_KEY = process.env.TMDB_API_KEY;

async function getTmdbMeta(tmdbId: number, mediaType: string) {
  const isAnime = mediaType === "anime";
  const endpoint = isAnime ? "tv" : mediaType === "tv" ? "tv" : "movie";
  const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return { title: `${mediaType === "anime" ? "Anime" : mediaType === "tv" ? "TV Show" : "Movie"} #${tmdbId}`, poster: null, year: null };
    const data = await res.json();
    return {
      title: data.title || data.name || `Title #${tmdbId}`,
      poster: data.poster_path ? `https://image.tmdb.org/t/p/w185${data.poster_path}` : null,
      year: data.release_date ? new Date(data.release_date).getFullYear() : (data.first_air_date ? new Date(data.first_air_date).getFullYear() : null),
    };
  } catch {
    return { title: `Title #${tmdbId}`, poster: null, year: null };
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const supabase = await createClient();

  try {
    const { data: reviews, error } = await supabase
      .from("reviews")
      .select("tmdb_id, media_type, content, rating, created_at")
      .eq("username", username)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
    }

    if (!reviews || reviews.length === 0) {
      return NextResponse.json({ reviews: [] });
    }

    // Deduplicate and batch-lookup TMDB metadata
    const seen = new Set<string>();
    const lookups: Promise<any>[] = [];
    const lookupKeys: string[] = [];

    for (const r of reviews) {
      const key = `${r.tmdb_id}-${r.media_type}`;
      if (!seen.has(key)) {
        seen.add(key);
        lookups.push(getTmdbMeta(r.tmdb_id, r.media_type));
        lookupKeys.push(key);
      }
    }

    const metaResults = await Promise.all(lookups);
    const metaMap: Record<string, { title: string; poster: string | null; year: number | null }> = {};
    for (let i = 0; i < lookupKeys.length; i++) {
      metaMap[lookupKeys[i]] = metaResults[i];
    }

    const enriched = reviews.map(r => {
      const key = `${r.tmdb_id}-${r.media_type}`;
      const meta = metaMap[key] || { title: `Title #${r.tmdb_id}`, poster: null, year: null };
      return { ...r, title: meta.title, poster: meta.poster, year: meta.year };
    });

    return NextResponse.json({ reviews: enriched });
  } catch (err: any) {
    console.error("Reviews fetch error:", err);
    return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
  }
}
