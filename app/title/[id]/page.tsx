export const revalidate = 86400;

import { getMovieDetail, isAnimeTV } from "@/lib/tmdb";
import MovieHero from "@/components/MovieHero";
import MovieInfo from "@/components/MovieInfo";
import MovieOverview from "@/components/MovieOverview";
import MovieTrailers from "@/components/MovieTrailers";
import MovieCast from "@/components/MovieCast";
import MovieRecommendations from "@/components/MovieRecommendations";
import DetailInteractive from "@/components/DetailInteractive";
import { getAnimeDetail, getAnimeIds, getAnimeEpisodes, enrichAnimeRelations, getAnilistId } from "@/lib/anilist";
import AnimeHero from "@/components/AnimeHero";
import AnimeOverview from "@/components/AnimeOverview";
import AnimeSeasons from "@/components/AnimeSeasons";
import AnimeCharacters from "@/components/AnimeCharacters";
import AnimeRecommendations from "@/components/AnimeRecommendations";
import AnimeTrailer from "@/components/AnimeTrailer";
import AnimeInteractive from "@/components/AnimeInteractive";
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

async function isMovie(id: number): Promise<boolean> {
  try {
    const res = await fetch(
      `${TMDB_BASE}/movie/${id}?api_key=${API_KEY}&language=en-US`,
      { next: { revalidate: 86400 } }
    );
    return res.ok;
  } catch {
    return false;
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

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function TitlePage({ params, searchParams }: Props) {
  const [{ id }, { type }] = await Promise.all([params, searchParams]);
  const numId = parseInt(id);
  if (isNaN(numId)) notFound();

  // TV shows — redirect to season page
  if (type === "tv") {
    if (await isAnimeTV(numId)) {
      redirect(`/title/${numId}?type=anime`);
    }
    const latestSeason = await getTVSeasonCount(numId);
    if (latestSeason) {
      redirect(`/title/${numId}/season/${latestSeason}`);
    }
    notFound();
  }

  // Anime detail
  if (type === "anime") {
    const anilistId = await getAnilistId(numId);
    if (!anilistId) notFound();
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
          title: detail.title, description: detail.overview || "", posterUrl: detail.poster,
          rating: detail.rating, ratingCount: detail.popularity, releaseYear: detail.year,
          genres: detail.genres, url: `/title/${numId}?type=anime`,
        })
      : generateTVJsonLd({
          title: detail.title, description: detail.overview || "", posterUrl: detail.poster,
          rating: detail.rating, ratingCount: detail.popularity, releaseYear: detail.year,
          genres: detail.genres, url: `/title/${numId}?type=anime`,
          totalSeasons: 1, status: detail.status, networks: [],
        });
    return (
      <>
        <StructuredDataScript data={animeJsonLd} />
        <div className="max-w-lg md:max-w-4xl mx-auto min-h-screen pb-24">
          <AnimeHero detail={detail} />
          <AnimeOverview overview={detail.overview} />
          <AnimeSeasons relations={detail.relations} currentId={detail.id} />
          <AnimeCharacters characters={detail.characters} />
          <AnimeRecommendations recommendations={detail.recommendations} />
          <AnimeTrailer trailer={detail.trailer} />
          <AnimeInteractive detail={detail} episodes={episodes} />
        </div>
      </>
    );
  }

  // Movie detail (explicit or auto-detect)
  if (type === "movie" || !type) {
    // Auto-detect: check if movie endpoint returns successfully before trying TV
    if (!type) {
      // Try anime auto-detect first (for anime search results without type)
      const anilistId = await getAnilistId(numId);
      if (anilistId) {
        redirect(`/title/${numId}?type=anime`);
      }
      // Only try TV if it's NOT a valid movie ID (prevents movie/TV ID conflict)
      const isMovieId = await isMovie(numId);
      if (!isMovieId) {
        const latestSeason = await getTVSeasonCount(numId);
        if (latestSeason) {
          redirect(`/title/${numId}/season/${latestSeason}`);
        }
      }
    }

    try {
      const detail = await getMovieDetail(numId);
      const jsonLd = generateMovieJsonLd({
        title: detail.title || "Unknown", description: detail.overview || "",
        posterUrl: detail.posterPath || null, rating: detail.rating || 0,
        ratingCount: detail.voteCount || 0,
        releaseYear: detail.releaseDate ? parseInt(detail.releaseDate.slice(0, 4)) : 0,
        genres: detail.genres?.map((g: any) => g.name) || [], url: `/title/${numId}`,
      });
      return (
        <>
          <StructuredDataScript data={jsonLd} />
          <div className="max-w-lg md:max-w-4xl mx-auto min-h-screen pb-24">
            <MovieHero detail={detail} />
            <div className="px-4 md:px-0">
              <DetailInteractive detail={{ id: detail.id, type: detail.type, daysUntil: detail.daysUntil }} />
              <MovieInfo detail={detail} />
              <MovieOverview overview={detail.overview} />
              <MovieTrailers videos={detail.videos} />
              <MovieCast cast={detail.cast} />
              <MovieRecommendations items={detail.similar} />
              <div className="mt-8 pt-4 border-t border-white/5 text-center">
                <p className="text-[10px] text-text-secondary">
                  <a href="https://seriez.app" className="text-accent hover:underline font-medium">Seriez</a> — Track Movies, TV Shows &amp; Anime in One Place
                </p>
              </div>
            </div>
          </div>
        </>
      );
    } catch {
      notFound();
    }
  }

  notFound();
}
