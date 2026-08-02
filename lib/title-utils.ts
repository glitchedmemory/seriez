// Shared helpers for title route resolution (movie/TV/anime split)
const TMDB_BASE = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_API_KEY!;

export type TitleInfo = { exists: boolean; voteCount: number };

// movie endpoint existence + vote_count
export async function getMovieInfo(id: number): Promise<TitleInfo | null> {
  try {
    const res = await fetch(`${TMDB_BASE}/movie/${id}?api_key=${API_KEY}&language=en-US`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const d = await res.json();
    return { exists: true, voteCount: d.vote_count || 0 };
  } catch {
    return null;
  }
}

// tv endpoint existence + vote_count
export async function getTVInfo(id: number): Promise<TitleInfo | null> {
  try {
    const res = await fetch(`${TMDB_BASE}/tv/${id}?api_key=${API_KEY}&language=en-US`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const d = await res.json();
    return { exists: true, voteCount: d.vote_count || 0 };
  } catch {
    return null;
  }
}

// Resolve movie/TV conflict for type-less access — higher vote_count wins
export async function resolveConflict(id: number): Promise<"movie" | "tv"> {
  const [movie, tv] = await Promise.all([getMovieInfo(id), getTVInfo(id)]);
  if (movie && !tv) return "movie";
  if (!movie && tv) return "tv";
  if (movie && tv) {
    return movie.voteCount >= tv.voteCount ? "movie" : "tv";
  }
  return "movie"; // neither exists — default (caller handles notFound)
}

// Build detail page URL from media type (route split: /movie /tv /anime)
export function titleHref(id: number | string, type?: string | null): string {
  if (type === "tv") return `/tv/${id}/season/1`;
  if (type === "anime") return `/anime/${id}`;
  return `/movie/${id}`;
}
