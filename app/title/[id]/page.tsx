import { getMovieDetail, isAnimeTV } from "@/lib/tmdb";
import DetailClient from "@/components/DetailClient";
import { getAnimeDetail, getAnimeEpisodes, enrichAnimeRelations } from "@/lib/anilist";
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

// Resolve TMDB ID → AniList ID via media_trackings, then Jikan/Kitsu fallback
async function resolveAnilistId(tmdbId: number): Promise<number | null> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase
      .from("media_trackings")
      .select("anilist_id")
      .eq("tmdb_id", tmdbId)
      .not("anilist_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (data?.anilist_id) return data.anilist_id;
  } catch {}

  // Fallback: search AniList via Jikan (MAL ID → AniList)
  try {
    const jikanRes = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(String(tmdbId))}&limit=1`);
    if (jikanRes.ok) {
      const jd = await jikanRes.json();
      const malId = jd?.data?.[0]?.mal_id;
      if (malId) {
        const anilistRes = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({
            query: `query($idMal:Int){Media(idMal:$idMal,type:ANIME){id}}`,
            variables: { idMal: malId },
          }),
        });
        if (anilistRes.ok) {
          const aj = await anilistRes.json();
          return aj.data?.Media?.id || null;
        }
      }
    }
  } catch {}

  return null;
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

  // Anime detail — resolve TMDB ID to AniList ID first
  if (type === "anime") {
    const anilistId = await resolveAnilistId(numId);
    if (!anilistId) notFound();
    const detail = await getAnimeDetail(anilistId);
    if (!detail) notFound();

    // Enrich relations: fetch 2 levels deep to catch all seasons
    detail.relations = await enrichAnimeRelations(anilistId, detail.relations);

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
