import { getMovieDetail } from "@/lib/tmdb";
import DetailClient from "@/components/DetailClient";
import { getAnimeDetail, getAnimeEpisodes } from "@/lib/anilist";
import AnimeDetailClient from "@/components/AnimeDetailClient";
import { notFound, redirect } from "next/navigation";

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

async function findTMDBByTitle(title: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${TMDB_BASE}/search/tv?api_key=${API_KEY}&query=${encodeURIComponent(title)}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0]?.id || null;
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

  // TV shows have no main page — redirect to latest season
  if (type === "tv") {
    const latestSeason = await getTVSeasonCount(numId);
    if (latestSeason) {
      redirect(`/title/${numId}/season/${latestSeason}`);
    }
    notFound();
  }

  // Anime detail — try TMDB first (richer: seasons, episode stills), fallback to AniList
  if (type === "anime") {
    const detail = await getAnimeDetail(numId);
    if (!detail) notFound();

    // Try to find the TMDB version using native Japanese title
    if (detail.titleNative) {
      const tmdbId = await findTMDBByTitle(detail.titleNative);
      if (tmdbId) {
        const latestSeason = await getTVSeasonCount(tmdbId);
        if (latestSeason) {
          redirect(`/title/${tmdbId}/season/${latestSeason}`);
        }
      }
    }

    // Fallback: render from AniList
    const episodes = await getAnimeEpisodes(
      detail.title,
      detail.titleRomaji,
      detail.idMal,
      detail.titleNative
    );
    return <AnimeDetailClient detail={detail} episodes={episodes} />;
  }

  try {
    const detail = await getMovieDetail(numId);
    return <DetailClient detail={detail} />;
  } catch {
    notFound();
  }
}
