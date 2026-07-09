export const revalidate = 86400;
export const fetchCache = 'default-cache';

import { getMovieDetail, isAnimeTV } from "@/lib/tmdb";
import DetailClient from "@/components/DetailClient";
import { getAnimeDetail, getAnimeIds, getAnimeEpisodes, enrichAnimeRelations, getAnilistId } from "@/lib/anilist";
import AnimeDetailClient from "@/components/AnimeDetailClient";
import { notFound, redirect } from "next/navigation";
import { generateMovieJsonLd, generateTVJsonLd, StructuredDataScript } from "@/lib/structured-data";

const TMDB_BASE = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_API_KEY!;

async function getTVSeasonCount(id: number): Promise<number | null> {
  try {
    const res = await fetch(
      `${TMDB_BASE}/tv/${id}?api_key=${API_KEY}&language=en-US`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.number_of_seasons || null;
  } catch {
    return null;
  }
}

// Pre-render top 20 popular anime at build time
export async function generateStaticParams() {
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query { Page(page: 1, perPage: 20) { media(sort: POPULARITY_DESC, type: ANIME) { id } } }`,
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const ids = (json.data?.Page?.media || []).map((m: any) => ({ id: String(m.id) }));
    return ids;
  } catch {
    return [];
  }
}

export default async function TitlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = parseInt(id);
  if (isNaN(numId)) notFound();

  // 1. Try anime first (auto-detect via AniList)
  const anilistId = await getAnilistId(numId);
  if (anilistId) {
    const ids = await getAnimeIds(anilistId);
    const [detail, episodes] = await Promise.all([
      getAnimeDetail(anilistId),
      getAnimeEpisodes(ids.title, ids.titleRomaji, ids.idMal, ids.titleNative, ids.duration),
    ]);
    if (!detail) notFound();

    detail.relations = await enrichAnimeRelations(anilistId, detail.relations);
    const isAnimeMovie = detail.format === "MOVIE";
    const animeJsonLd = isAnimeMovie
      ? generateMovieJsonLd({
          title: detail.title,
          description: detail.overview || "",
          posterUrl: detail.poster,
          rating: detail.rating,
          ratingCount: detail.popularity,
          releaseYear: detail.year,
          genres: detail.genres,
          url: `/title/${numId}`,
        })
      : generateTVJsonLd({
          title: detail.title,
          description: detail.overview || "",
          posterUrl: detail.poster,
          rating: detail.rating,
          ratingCount: detail.popularity,
          releaseYear: detail.year,
          genres: detail.genres,
          url: `/title/${numId}`,
          totalSeasons: 1,
          status: detail.status,
          networks: [],
        });
    return (
      <>
        <StructuredDataScript data={animeJsonLd} />
        <AnimeDetailClient detail={detail} episodes={episodes} />
      </>
    );
  }

  // 2. Try TV — redirect to latest season
  // Also handle type=tv from search results (parameters are ignored, auto-detected)
  if (await isAnimeTV(numId)) {
    redirect(`/title/${numId}?type=anime`);
  }
  const latestSeason = await getTVSeasonCount(numId);
  if (latestSeason) {
    redirect(`/title/${numId}/season/${latestSeason}`);
  }

  // 3. Default: movie
  try {
    const detail = await getMovieDetail(numId);
    const jsonLd = generateMovieJsonLd({
      title: detail.title || "Unknown",
      description: detail.overview || "",
      posterUrl: detail.posterPath || null,
      rating: detail.rating || 0,
      ratingCount: detail.voteCount || 0,
      releaseYear: detail.releaseDate ? parseInt(detail.releaseDate.slice(0, 4)) : 0,
      genres: detail.genres?.map((g: any) => g.name) || [],
      url: `/title/${numId}`,
    });
    return (
      <>
        <StructuredDataScript data={jsonLd} />
        <DetailClient detail={detail} />
      </>
    );
  } catch {
    notFound();
  }
}
