export const revalidate = 86400;

import { getAnimeDetail, getAnimeIds, getAnimeEpisodes, enrichAnimeRelations, getAnilistId } from "@/lib/anilist";
import AnimeHero from "@/components/AnimeHero";
import AnimeOverview from "@/components/AnimeOverview";
import AnimeSeasons from "@/components/AnimeSeasons";
import AnimeCharacters from "@/components/AnimeCharacters";
import AnimeRecommendations from "@/components/AnimeRecommendations";
import AnimeTrailer from "@/components/AnimeTrailer";
import AnimeInteractive from "@/components/AnimeInteractive";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { generateMovieJsonLd, generateTVJsonLd, StructuredDataScript } from "@/lib/structured-data";
import VisitTracker from "@/components/VisitTracker";
import ShareButton from "@/components/ShareButton";

// Pre-render popular anime at build time (top ~100 only — keep build light on 3.7GB RAM)
export async function generateStaticParams() {
  const ids: { id: string }[] = [];
  try {
    for (let page = 1; page <= 2; page++) {
      try {
        const res = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            query: `query { Page(page: ${page}, perPage: 50) { media(sort: POPULARITY_DESC, type: ANIME) { id } } }`,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          (json.data?.Page?.media || []).forEach((m: any) => ids.push({ id: String(m.id) }));
        }
      } catch {
        // AniList timeout / rate-limit: skip this page so the build never hangs. Keep going.
      }
    }
  } catch {}
  return ids;
}

interface Props {
  params: Promise<{ id: string }>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://seriez.app";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const numId = parseInt(id);
  if (isNaN(numId)) return {};

  try {
    const anilistId = await getAnilistId(numId);
    if (!anilistId) return {};
    const detail = await getAnimeDetail(anilistId);
    if (!detail) return {};
    const title = detail.title || "Seriez";
    const description = detail.overview || "Track movies, TV shows, and anime in one place.";
    const posterUrl = detail.poster || null;
    return {
      title,
      description,
      alternates: { canonical: `${SITE_URL}/anime/${numId}` },
      openGraph: {
        title,
        description,
        type: "website",
        siteName: "Seriez",
        url: `${SITE_URL}/anime/${numId}`,
        ...(posterUrl ? { images: [{ url: posterUrl, alt: title }] } : {}),
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        ...(posterUrl ? { images: [posterUrl] } : {}),
      },
    };
  } catch {
    return {};
  }
}

export default async function AnimePage({ params }: Props) {
  const { id } = await params;
  const numId = parseInt(id);
  if (isNaN(numId)) notFound();

  const anilistId = await getAnilistId(numId);
  if (!anilistId) notFound();
  const ids = await getAnimeIds(anilistId);
  const [detail, episodes] = await Promise.all([
    getAnimeDetail(anilistId),
    getAnimeEpisodes(ids.title, ids.titleRomaji, ids.idMal, ids.titleNative, ids.duration),
  ]);
  if (!detail) notFound();

  detail.relations = await enrichAnimeRelations(anilistId, detail.relations, detail.year);
  const isAnimeMovie = detail.format === "MOVIE";
  const animeJsonLd = isAnimeMovie
    ? generateMovieJsonLd({
        title: detail.title, description: detail.overview || "", posterUrl: detail.poster,
        rating: detail.rating, ratingCount: detail.popularity, releaseYear: detail.year,
        genres: detail.genres, url: `/anime/${numId}`,
      })
    : generateTVJsonLd({
        title: detail.title, description: detail.overview || "", posterUrl: detail.poster,
        rating: detail.rating, ratingCount: detail.popularity, releaseYear: detail.year,
        genres: detail.genres, url: `/anime/${numId}`,
        totalSeasons: 1, status: detail.status, networks: [],
      });
  return (
    <>
      <StructuredDataScript data={animeJsonLd} />
      <VisitTracker tmdbId={numId} mediaType="anime" />
      <div className="max-w-lg md:max-w-4xl mx-auto min-h-screen pb-24">
        <AnimeHero detail={detail} shareUrl={`${SITE_URL}/anime/${numId}`}>
          <AnimeInteractive mode="buttons-only" detail={detail} episodes={episodes} />
        </AnimeHero>
        <AnimeSeasons relations={detail.relations} currentId={detail.id} currentTitle={detail.title} currentYear={detail.year} />
        <AnimeOverview overview={detail.overview} />
        <AnimeInteractive mode="episodes-only" detail={detail} episodes={episodes} />
        <AnimeInteractive mode="reviews-only" detail={detail} episodes={episodes} />
        <AnimeTrailer trailer={detail.trailer} />
        <AnimeCharacters characters={detail.characters} />
        <AnimeRecommendations recommendations={detail.recommendations} />
      </div>
    </>
  );
}
