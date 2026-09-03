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

// Direct (uncached) AniList lookup for metadata — unstable_cache wrappers
// (getAnilistId / getAnimeDetail) trigger DYNAMIC_SERVER_USAGE inside
// generateMetadata, so we hit the API directly here instead.
async function fetchAnimeMeta(numId: number): Promise<{ title: string; description: string; posterUrl: string | null } | null> {
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        query: `query($id:Int){Media(id:$id,type:ANIME){title{romaji english native}description coverImage{large}}}`,
        variables: { id: numId },
      }),
      signal: AbortSignal.timeout(8000),
    });
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

  // `/anime/[id]` receives a TMDB id and must resolve it to an AniList id first.
  try {
    const resolveRes = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        query: `query($id:Int){Media(id:$id,type:ANIME){id}}`,
        variables: { id: numId },
      }),
    });
    let anilistId: number | null = null;
    if (resolveRes.ok) {
      const rj = await resolveRes.json();
      anilistId = rj.data?.Media?.id ?? null;
    }
    // If the TMDB id itself isn't an AniList id, resolve via Jikan search.
    if (!anilistId) {
      try {
        const jikanRes = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(String(numId))}&limit=1`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(8000),
        });
        if (jikanRes.ok) {
          const jd = await jikanRes.json();
          const first = jd.data?.[0];
          if (first?.mal_id) {
            const alRes = await fetch("https://graphql.anilist.co", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Accept": "application/json" },
              body: JSON.stringify({
                query: `query($id:Int){Media(idMal:$id,type:ANIME){id}}`,
                variables: { id: first.mal_id },
              }),
            });
            if (alRes.ok) {
              const aj = await alRes.json();
              anilistId = aj.data?.Media?.id ?? null;
            }
          }
        }
      } catch {
        // ignore — fall through to null
      }
    }
    if (!anilistId) return {};

    const meta = await fetchAnimeMeta(anilistId);
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
