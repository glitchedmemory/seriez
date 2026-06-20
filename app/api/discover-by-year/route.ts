import { NextRequest, NextResponse } from "next/server";

const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const ANILIST_API = "https://graphql.anilist.co";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function fetchTmdb(path: string) {
  const url = `${TMDB_BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${TMDB_API_KEY}&language=en-US`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  return res.json();
}

async function fetchAniListByDecade(startYear: number, endYear: number) {
  const query = `query($startGreater: FuzzyDateInt, $startLesser: FuzzyDateInt) {
    Page(perPage: 10) {
      media(type: ANIME, startDate_greater: $startGreater, startDate_lesser: $startLesser, sort: POPULARITY_DESC) {
        id
        title { romaji english native }
        startDate { year }
        coverImage { extraLarge }
        averageScore
        format
      }
    }
  }`;

  try {
    const res = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: {
          startGreater: startYear * 10000,
          startLesser: (endYear + 1) * 10000,
        },
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const media = json.data?.Page?.media || [];
    return media.map((m: any) => ({
      id: m.id,
      title: m.title.english || m.title.romaji || "Unknown",
      year: m.startDate?.year?.toString() || "",
      type: "anime" as const,
      poster: m.coverImage?.extraLarge || m.coverImage?.large || null,
      rating: (m.averageScore || 0) / 10,
      _aliases: [
        (m.title.romaji || "").toLowerCase(),
        (m.title.english || "").toLowerCase(),
        (m.title.native || "").toLowerCase(),
      ].filter(Boolean),
    }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startYear = parseInt(searchParams.get("startYear") || "");
  const endYear = parseInt(searchParams.get("endYear") || "");

  if (isNaN(startYear) || isNaN(endYear) || startYear > endYear) {
    return NextResponse.json(
      { error: "Invalid year range. Provide startYear and endYear." },
      { status: 400 }
    );
  }

  // Fetch TMDB movies, TV shows, and AniList anime in parallel
  const [movieData, tvData, animeResults] = await Promise.all([
    fetchTmdb(
      `/discover/movie?primary_release_date.gte=${startYear}-01-01&primary_release_date.lte=${endYear}-12-31&sort_by=popularity.desc&vote_count.gte=50&page=1`
    ),
    fetchTmdb(
      `/discover/tv?first_air_date.gte=${startYear}-01-01&first_air_date.lte=${endYear}-12-31&sort_by=popularity.desc&vote_count.gte=50&page=1`
    ),
    fetchAniListByDecade(startYear, endYear),
  ]);

  const results: {
    id: number;
    title: string;
    year: string;
    type: string;
    poster: string | null;
    rating: number;
  }[] = [];

  // Anime first — build dedup set
  const animeTitles = new Set<string>();
  for (const a of animeResults) {
    if (!a.poster) continue;
    animeTitles.add(normalize(a.title));
    results.push({
      id: a.id,
      title: a.title,
      year: a.year,
      type: "anime",
      poster: a.poster,
      rating: a.rating,
    });
  }

  // TMDB movies — skip if title matches an anime
  for (const item of movieData?.results || []) {
    if (!item.poster_path) continue;
    if ((item.genre_ids || []).includes(16) && item.original_language === "ja") continue;
    if (animeTitles.has(normalize(item.title))) continue;
    results.push({
      id: item.id,
      title: item.title,
      year: (item.release_date || "").slice(0, 4),
      type: "movie",
      poster: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
      rating: Math.round((item.vote_average || 0) * 10) / 10,
    });
  }

  // TMDB TV shows — skip if title matches an anime
  for (const item of tvData?.results || []) {
    if (!item.poster_path) continue;
    if ((item.genre_ids || []).includes(16) && item.original_language === "ja") continue;
    if (animeTitles.has(normalize(item.name))) continue;
    results.push({
      id: item.id,
      title: item.name,
      year: (item.first_air_date || "").slice(0, 4),
      type: "tv",
      poster: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
      rating: Math.round((item.vote_average || 0) * 10) / 10,
    });
  }

  // Preserve source ordering (popularity from TMDB/AniList requests)
  const top30 = results.slice(0, 30);

  return NextResponse.json({
    decade: `${startYear}s`,
    results: top30,
    count: results.length,
  });
}
