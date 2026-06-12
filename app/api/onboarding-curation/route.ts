import { NextRequest, NextResponse } from "next/server";
import { GENRE_MAP, type TmdbResult } from "@/lib/tmdb";

const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";

async function tmdbGet(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

const poster = (path: string | null) =>
  path ? `https://image.tmdb.org/t/p/w780${path}` : null;

const backdrop = (path: string | null) =>
  path ? `https://image.tmdb.org/t/p/original${path}` : null;

function formatItem(item: any, mediaType: "movie" | "tv"): TmdbResult {
  const dateStr = item.release_date || item.first_air_date || "";
  return {
    id: item.id,
    title: item.title || item.name || "Unknown",
    poster: poster(item.poster_path),
    backdrop: backdrop(item.backdrop_path),
    rating: Math.round((item.vote_average || 0) * 10) / 10,
    year: dateStr ? parseInt(dateStr.slice(0, 4)) : 0,
    type: mediaType,
    overview: item.overview || "",
    genres: (item.genre_ids || []).map((id: number) => GENRE_MAP[id] || "").filter(Boolean).slice(0, 3),
    daysUntil: null,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const genres = searchParams.get("genres");
  const exclude = searchParams.get("exclude");

  const genreIds = (genres || "").split(",").map(Number).filter((id) => !isNaN(id));
  const excludeIds = new Set((exclude || "").split(",").map(Number).filter((id) => !isNaN(id)));
  const hasAnime = genreIds.includes(0);
  const realGenreIds = genreIds.filter((id) => id !== 0);

  try {
    const genreStr = realGenreIds.length > 0 ? realGenreIds.slice(0, 3).join(",") : "";
    const params: Record<string, string> = {
      sort_by: "vote_average.desc",
      "vote_count.gte": "200",
    };
    if (genreStr) params.with_genres = genreStr;

    const fetches: Promise<any>[] = [];
    if (realGenreIds.length > 0 || !hasAnime) {
      // Only run regular discover if there are real genres or anime isn't the sole pick
      fetches.push(tmdbGet("/discover/movie", params));
      fetches.push(tmdbGet("/discover/tv", params));
    }

    // If Anime is selected, add an anime-specific discover call
    if (hasAnime) {
      const animeParams: Record<string, string> = {
        sort_by: "vote_average.desc",
        "vote_count.gte": "30",
        with_genres: "16", // Animation
        with_original_language: "ja",
      };
      fetches.push(tmdbGet("/discover/movie", animeParams));
      fetches.push(tmdbGet("/discover/tv", animeParams));
    }

    const results = await Promise.all(fetches);
    let idx = 0;
    const movies = hasAnime && realGenreIds.length === 0 ? { results: [] } : results[idx++];
    const tv = hasAnime && realGenreIds.length === 0 ? { results: [] } : results[idx++];
    const animeMovies = hasAnime ? results[idx++] : { results: [] };
    const animeTV = hasAnime ? results[idx++] : { results: [] };

    // Combine, exclude watched, and pick the top-rated one
    const candidates: { item: TmdbResult; score: number }[] = [];

    for (const m of (movies.results || []).slice(0, 20)) {
      if (excludeIds.has(m.id)) continue;
      const item = formatItem(m, "movie");
      candidates.push({ item, score: item.rating * (m.vote_count || 0) / 1000 });
    }
    for (const t of (tv.results || []).slice(0, 20)) {
      if (excludeIds.has(t.id)) continue;
      const item = formatItem(t, "tv");
      candidates.push({ item, score: item.rating * (t.vote_count || 0) / 1000 });
    }
    // Add anime results if available
    if (hasAnime) {
      for (const m of (animeMovies?.results || []).slice(0, 10)) {
        if (excludeIds.has(m.id)) continue;
        const item = formatItem(m, "movie");
        candidates.push({ item, score: item.rating * (m.vote_count || 0) / 1000 * 2.0 }); // Boost anime
      }
      for (const t of (animeTV?.results || []).slice(0, 10)) {
        if (excludeIds.has(t.id)) continue;
        const item = formatItem(t, "tv");
        candidates.push({ item, score: item.rating * (t.vote_count || 0) / 1000 * 2.0 });
      }
    }

    // Sort by weighted score (rating * popularity)
    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length === 0) {
      return NextResponse.json({ error: "No recommendations found" }, { status: 404 });
    }

    const best = candidates[0].item;
    const topGenre = best.genres[0] || "your taste";
    const genreNames = genreIds.map((id) => id === 0 ? "Anime" : (GENRE_MAP[id] || String(id)));
    const reason = genreIds.length > 0 && genreIds.length <= 3
      ? `Based on your love for ${genreNames.join(", ")}`
      : `Because you enjoy ${topGenre} stories`;

    return NextResponse.json({ item: best, reason });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Curation failed" }, { status: 500 });
  }
}
