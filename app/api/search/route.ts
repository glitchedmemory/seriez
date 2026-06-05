import { NextRequest, NextResponse } from "next/server";

const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q?.trim()) {
    return NextResponse.json({ results: [] });
  }

  const url = `${TMDB_BASE}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q.trim())}&language=en-US&page=1`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return NextResponse.json({ results: [] }, { status: res.status });

  const data = await res.json();
  const results = (data.results || [])
    .filter((r: any) => r.media_type === "movie" || r.media_type === "tv")
    .slice(0, 8)
    .map((r: any) => ({
      id: r.id,
      title: r.title || r.name || "Unknown",
      year: (r.release_date || r.first_air_date || "").slice(0, 4),
      type: r.media_type,
      poster: r.poster_path
        ? `https://image.tmdb.org/t/p/w92${r.poster_path}`
        : null,
      rating: Math.round((r.vote_average || 0) * 10) / 10,
      genres: [],
    }));

  return NextResponse.json({ results });
}
