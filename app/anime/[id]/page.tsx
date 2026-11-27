export const revalidate = 86400;

import { getAnimeDetail, getAnimeIds, getAnimeEpisodes, enrichAnimeRelations, anilistFetch } from "@/lib/anilist";
import { unstable_cache } from "next/cache";
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
        const res = await anilistFetch(`query { Page(page: ${page}, perPage: 50) { media(sort: POPULARITY_DESC, type: ANIME) { id } } }`, {}, { signal: AbortSignal.timeout(8000) });
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

// Direct (uncached) AniList lookup for metadata — unstable_cache wrappers
// (getAnilistId / getAnimeDetail) trigger DYNAMIC_SERVER_USAGE inside
// generateMetadata, so we hit the API directly here instead.
const fetchAnimeMetaCached = unstable_cache(
  async (numId: number) => fetchAnimeMetaUncached(numId),
  ["anime-meta"],
  { revalidate: 3600 }
);

async function fetchAnimeMetaUncached(numId: number): Promise<{ title: string; description: string; posterUrl: string | null } | null> {
  try {
    const res = await anilistFetch(`query($id:Int){Media(id:$id,type:ANIME){title{romaji english native}description coverImage{large}}}`, { id: numId }, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const json = await res.json();
    const media = json.data?.Media;
    if (!media) return null;
    const title = media.title?.english || media.title?.romaji || media.title?.native || "Seriez";
    const description = (media.description || "").replace(/<[^>]*>/g, "").slice(0, 300) || "Track movies, TV shows, and anime in one place.";
    return { title, description, posterUrl: media.coverImage?.large || null };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const numId = parseInt(id);
  if (isNaN(numId)) return {};

  // `/anime/[id]` URL id IS the AniList id (see render fn below — same assumption),
  // so no TMDB→AniList resolution is needed here. Previously this fired 1-2 extra
  // AniList calls per page load, burning the 30 req/min limit.
  try {
    // Jikan fallback removed: the URL id is always a valid AniList id here, so
    // this branch was dead code that also held a 8s-timeout Jikan call.
    const meta = await fetchAnimeMetaCached(numId);
    if (!meta) return {};

    return {
      title: meta.title,
      description: meta.description,
      alternates: { canonical: `${SITE_URL}/anime/${numId}` },
      openGraph: {
        title: meta.title,
        description: meta.description,
        type: "website",
        siteName: "Seriez",
        url: `${SITE_URL}/anime/${numId}`,
        ...(meta.posterUrl ? { images: [{ url: meta.posterUrl, alt: meta.title }] } : {}),
      },
      twitter: {
        card: "summary_large_image",
        title: meta.title,
        description: meta.description,
        ...(meta.posterUrl ? { images: [meta.posterUrl] } : {}),
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

  // `/anime/[id]` id IS the AniList ID (anime URLs always use AniList IDs).
  // No TMDB→AniList resolution needed — and getAnilistId would return null
  // when AniList is down, breaking the page before the Kitsu fallback runs.
  const anilistId = numId;
  const ids = await getAnimeIds(anilistId);
  // enrichAnimeRelations is a Kitsu BFS walk that used to run serially AFTER the
  // two calls below had settled. On a cold cache that was the difference between
  // a 40ms page and a 2.5s one. It queries AniList for the season chain itself
  // and only needs this anime's own id/year, so it is a third independent
  // request — run it in the same Promise.all and apply the result afterwards.
  const [detail, episodes, enrichedRelations] = await Promise.all([
    getAnimeDetail(anilistId),
    getAnimeEpisodes(ids.title, ids.titleRomaji, ids.idMal, ids.titleNative, ids.duration, anilistId),
    enrichAnimeRelations(anilistId, [], 0),
  ]);
  if (!detail) notFound();

  detail.relations = enrichedRelations.length > 0 ? enrichedRelations : detail.relations;
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
        <AnimeSeasons relations={detail.relations} currentId={detail.id} currentTitle={detail.title} currentYear={detail.year} currentSeason={detail.season} />
        <AnimeOverview overview={detail.overview} />
        <AnimeInteractive mode="reviews-only" detail={detail} episodes={episodes} />
        <AnimeInteractive mode="episodes-only" detail={detail} episodes={episodes} />
        <AnimeTrailer trailers={detail.trailers} />
        <AnimeCharacters staff={detail.staff} characters={detail.characters} />
        <AnimeRecommendations recommendations={detail.recommendations} />
      </div>
    </>
  );
}
