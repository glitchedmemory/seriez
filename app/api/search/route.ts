import { NextRequest, NextResponse } from "next/server";

const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const ANILIST_API = "https://graphql.anilist.co";

const ANILIST_SEARCH_QUERY = `
query($search: String) {
  Page(perPage: 10) {
    media(search: $search, type: ANIME) {
      id
      title { romaji english native }
      startDate { year }
      coverImage { extraLarge }
      averageScore
    }
  }
}
`;

async function searchAniList(query: string) {
  try {
    const res = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: ANILIST_SEARCH_QUERY,
        variables: { search: query },
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const media = json.data?.Page?.media || [];
    return media.map((m: any) => ({
        id: m.id,
        title: m.title.english || m.title.romaji || "Unknown",
        year: m.startDate?.year?.toString() || "",
        type: "anime",
        poster: m.coverImage?.extraLarge || m.coverImage?.large || null,
        rating: (m.averageScore || 0) / 10,
      }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q?.trim()) {
    return NextResponse.json({ results: [] });
  }

  const tmdbUrl = `${TMDB_BASE}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q.trim())}&language=en-US&page=1`;

  const [tmdbRes, animeResults] = await Promise.all([
    fetch(tmdbUrl, { next: { revalidate: 3600 } }),
    searchAniList(q.trim()),
  ]);

  let tmdbResults: any[] = [];
  if (tmdbRes.ok) {
    const data = await tmdbRes.json();
    tmdbResults = (data.results || [])
      .filter((r: any) => r.media_type === "movie" || r.media_type === "tv")
      .map((r: any) => ({
        id: r.id,
        title: r.title || r.name || "Unknown",
        year: (r.release_date || r.first_air_date || "").slice(0, 4),
        type: r.media_type,
        poster: r.poster_path
          ? `https://image.tmdb.org/t/p/w500${r.poster_path}`
          : null,
        rating: Math.round((r.vote_average || 0) * 10) / 10,
        _rawGenreIds: r.genre_ids || [] as number[],
        _origLang: r.original_language || "",
      }));
  }

  // ─── Filter out Japanese anime (genre 16 Animation + JP origin) from TMDB ───
  // Anime titles only come from AniList; TMDB should only return live-action/non-anime content
  const filteredTmdb = tmdbResults.filter((tmdb: any) => {
    const genreIds: number[] = tmdb._rawGenreIds || [];
    const origLang: string = tmdb._origLang || "";
    return !(genreIds.includes(16) && origLang === "ja");
  }).slice(0, 6);

  // Clean up internal fields from results
  const cleanTmdb = filteredTmdb.map(({ _rawGenreIds, _origLang, ...rest }: any) => rest);
  const cleanAnime = animeResults.slice(0, 10);

  // AniList first, then TMDB
  const results = [...cleanAnime, ...cleanTmdb];

  return NextResponse.json({ results });
}
