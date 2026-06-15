import { NextRequest, NextResponse } from "next/server";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || "";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") || new Date().getFullYear().toString();
  const type = searchParams.get("type") || "movie";

  if (!TMDB_KEY) {
    return NextResponse.json({ posters: [] });
  }

  try {
    let url: string;
    if (type === "movie") {
      url = `${TMDB_BASE}/discover/movie?api_key=${TMDB_KEY}&language=en-US&sort_by=popularity.desc&primary_release_year=${year}&vote_count.gte=100&page=1`;
    } else if (type === "tv") {
      url = `${TMDB_BASE}/discover/tv?api_key=${TMDB_KEY}&language=en-US&sort_by=popularity.desc&first_air_date_year=${year}&vote_count.gte=50&page=1`;
    } else if (type === "anime") {
      url = `${TMDB_BASE}/discover/movie?api_key=${TMDB_KEY}&language=en-US&sort_by=popularity.desc&primary_release_year=${year}&with_genres=16&vote_count.gte=50&page=1`;
    } else {
      url = `${TMDB_BASE}/trending/all/week?api_key=${TMDB_KEY}&language=en-US`;
    }

    const res = await fetch(url);
    const data = await res.json();

    const posters = (data.results || [])
      .filter((item: any) => item.poster_path)
      .slice(0, 12)
      .map((item: any) => `https://image.tmdb.org/t/p/w342${item.poster_path}`);

    return NextResponse.json({ posters });
  } catch {
    return NextResponse.json({ posters: [] });
  }
}
