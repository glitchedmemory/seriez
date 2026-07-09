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

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function TitlePage({ params, searchParams }: Props) {
  const [{ id }, { type }] = await Promise.all([params, searchParams]);
  const numId = parseInt(id);
  if (isNaN(numId)) notFound();

  // TV shows — check if actually anime first
  if (type === "tv") {
    // If this TV show is Japanese anime, redirect to anime page
    if (await isAnimeTV(numId)) {
      redirect(`/title/${numId}?type=anime`);
    }
    const latestSeason = await getTVSeasonCount(numId);
    if (latestSeason) {
      redirect(`/title/${numId}/season/${latestSeason}`);
    }
    notFound();
  }

  // When no type specified, auto-detect: try anime first
  if (!type) {
    const anilistId = await getAnilistId(numId);
    if (anilistId) {
      redirect(`/title/${numId}?type=anime`);
    }
  }

  // Anime detail — resolve TMDB ID to AniList ID first
  if (type === "anime") {
    const anilistId = await getAnilistId(numId);
    if (!anilistId) notFound();
    // Fetch ids first (lightweight), then detail + episodes in parallel
    const ids = await getAnimeIds(anilistId);
    const [detail, episodes] = await Promise.all([
      getAnimeDetail(anilistId),
      getAnimeEpisodes(ids.title, ids.titleRomaji, ids.idMal, ids.titleNative, ids.duration),
    ]);
    if (!detail) notFound();

    // Enrich relations: fetch 2 levels deep to catch all seasons
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
          url: `/title/${numId}?type=anime`,
        })
      : generateTVJsonLd({
          title: detail.title,
          description: detail.overview || "",
          posterUrl: detail.poster,
          rating: detail.rating,
          ratingCount: detail.popularity,
          releaseYear: detail.year,
          genres: detail.genres,
          url: `/title/${numId}?type=anime`,
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
