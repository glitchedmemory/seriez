import { NextRequest, NextResponse } from "next/server";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || "";
const ANILIST_API = "https://graphql.anilist.co";

async function fetchTmdb(url: string): Promise<string[]> {
  const res = await fetch(url);
  const data = await res.json();
  return (data.results || [])
    .filter((item: any) => item.poster_path)
    .slice(0, 12)
    .map((item: any) => `https://image.tmdb.org/t/p/w342${item.poster_path}`);
}

async function fetchAnilist(year: string): Promise<string[]> {
  const query = `
    query($year: Int, $season: MediaSeason) {
      Page(perPage: 12) {
        media(seasonYear: $year, season: $season, sort: POPULARITY_DESC, type: ANIME, format_in: [TV, MOVIE]) {
          coverImage { large }
        }
      }
    }`;

  // Try current season, fall back through seasons until we find results
  const seasons = ["SPRING", "SUMMER", "FALL", "WINTER"];
  for (const season of seasons) {
    try {
      const res = await fetch(ANILIST_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          variables: { year: parseInt(year), season },
        }),
      });
      const json = await res.json();
      const posters = (json.data?.Page?.media || [])
        .filter((m: any) => m.coverImage?.large)
        .map((m: any) => m.coverImage.large);
      if (posters.length >= 6) return posters;
    } catch {}
  }
  return [];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") || new Date().getFullYear().toString();
  const type = searchParams.get("type") || "movie";

  try {
    if (type === "anime") {
      const posters = await fetchAnilist(year);
      return NextResponse.json({ posters });
    }

    if (!TMDB_KEY) {
      return NextResponse.json({ posters: [] });
    }

    let url: string;
    if (type === "movie") {
      url = `${TMDB_BASE}/discover/movie?api_key=${TMDB_KEY}&language=en-US&sort_by=popularity.desc&primary_release_year=${year}&vote_count.gte=100&page=1`;
    } else if (type === "tv") {
      url = `${TMDB_BASE}/discover/tv?api_key=${TMDB_KEY}&language=en-US&sort_by=popularity.desc&first_air_date_year=${year}&vote_count.gte=50&page=1`;
    } else {
      url = `${TMDB_BASE}/trending/all/week?api_key=${TMDB_KEY}&language=en-US`;
    }

    const posters = await fetchTmdb(url);
    return NextResponse.json({ posters });
  } catch {
    return NextResponse.json({ posters: [] });
  }
}
