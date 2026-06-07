import { getMovieDetail } from "@/lib/tmdb";
import DetailClient from "@/components/DetailClient";
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

  // Anime detail not yet supported — show friendly message
  if (type === "anime") {
    return (
      <div className="max-w-lg mx-auto min-h-screen flex items-center justify-center px-4 pb-24">
        <div className="text-center">
          <p className="text-6xl mb-4">🎌</p>
          <h1 className="text-xl font-bold text-white mb-2">Anime detail coming soon</h1>
          <p className="text-sm text-[#9ca3af] mb-4">AniList integration is in development</p>
          <a href="/search" className="text-[#6366f1] hover:underline text-sm">← Back to search</a>
        </div>
      </div>
    );
  }

  try {
    const detail = await getMovieDetail(numId);
    return <DetailClient detail={detail} />;
  } catch {
    notFound();
  }
}
