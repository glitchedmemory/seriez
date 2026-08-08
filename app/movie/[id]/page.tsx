export const revalidate = 86400;

import { getMovieDetail } from "@/lib/tmdb";
import MovieHero from "@/components/MovieHero";
import MovieInfo from "@/components/MovieInfo";
import MovieOverview from "@/components/MovieOverview";
import MovieTrailers from "@/components/MovieTrailers";
import MovieCast from "@/components/MovieCast";
import MovieRecommendations from "@/components/MovieRecommendations";
import DetailInteractive from "@/components/DetailInteractive";
import { notFound } from "next/navigation";
import { generateMovieJsonLd, StructuredDataScript } from "@/lib/structured-data";
import VisitTracker from "@/components/VisitTracker";

const TMDB_BASE = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_API_KEY!;

// Pre-render popular movies at build time
export async function generateStaticParams() {
  const ids: { id: string }[] = [];
  try {
    for (let page = 1; page <= 335; page++) {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&language=en-US&page=${page}`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (res.ok) {
          const json = await res.json();
          (json.results || []).forEach((m: any) => ids.push({ id: String(m.id) }));
        }
      } catch {
        // API timeout / rate-limit: skip this page so the build never hangs. Keep going.
      }
    }
  } catch {}
  return ids;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MoviePage({ params }: Props) {
  const { id } = await params;
  const numId = parseInt(id);
  if (isNaN(numId)) notFound();

  try {
    const detail = await getMovieDetail(numId);
    const jsonLd = generateMovieJsonLd({
      title: detail.title || "Unknown",
      description: detail.overview || "",
      posterUrl: detail.poster || null,
      rating: detail.rating || 0,
      ratingCount: detail.voteCount || 0,
      releaseYear: detail.year || 0,
      genres: detail.genres || [],
      url: `/movie/${numId}`,
    });
    return (
      <>
        <StructuredDataScript data={jsonLd} />
        <VisitTracker tmdbId={numId} mediaType="movie" />
        <div className="max-w-lg md:max-w-4xl mx-auto min-h-screen pb-24">
          <MovieHero detail={detail}>
            <DetailInteractive mode="buttons-only" detail={{ id: detail.id, type: detail.type, daysUntil: detail.daysUntil }} />
            <MovieInfo detail={detail} />
          </MovieHero>
          <div className="px-4 md:px-0">
            <MovieOverview overview={detail.overview} />
            <DetailInteractive mode="reviews-only" detail={{ id: detail.id, type: detail.type, daysUntil: detail.daysUntil }} />
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
