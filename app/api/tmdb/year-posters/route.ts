import { NextRequest, NextResponse } from "next/server";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN || "";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") || new Date().getFullYear().toString();
  const type = searchParams.get("type") || "movie";

  if (!TMDB_TOKEN) {
    return NextResponse.json({ posters: [] });
  }

  try {
    let url: string;
    if (type === "movie") {
      url = `${TMDB_BASE}/discover/movie?language=en-US&sort_by=popularity.desc&primary_release_year=${year}&vote_count.gte=100&page=1`;
    } else if (type === "tv") {
      url = `${TMDB_BASE}/discover/tv?language=en-US&sort_by=popularity.desc&first_air_date_year=${year}&vote_count.gte=50&page=1`;
    } else {
      url = `${TMDB_BASE}/trending/all/week?language=en-US`;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${TMDB_TOKEN}`,
    };

    const res = await fetch(url, { headers });
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
