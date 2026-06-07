import { NextResponse } from "next/server";

const ANILIST_API = "https://graphql.anilist.co";

const TRENDING_QUERY = `
query TrendingAnime($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
      id
      title { romaji english }
      coverImage { large }
      bannerImage
      averageScore
      seasonYear
      description
      genres
    }
  }
}
`;

export async function GET() {
  try {
    const res = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: TRENDING_QUERY,
        variables: { page: 1, perPage: 20 },
      }),
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({ results: [] });
    }

    const json = await res.json();
    const media = json.data?.Page?.media || [];

    const results = media.map((m: any) => ({
      id: m.id,
      title: m.title?.english || m.title?.romaji || "Unknown",
      poster: m.coverImage?.large || null,
      backdrop: m.bannerImage || null,
      rating: Math.round((m.averageScore / 10) * 10) / 10 || 0,
      year: m.seasonYear || 0,
      type: "anime" as const,
      overview: m.description?.replace(/<[^>]*>/g, "").slice(0, 300) || "",
      genres: m.genres?.slice(0, 5) || [],
      daysUntil: null,
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
