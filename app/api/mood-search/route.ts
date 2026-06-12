import { NextRequest, NextResponse } from "next/server";

const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";

// Mood → TMDB genre IDs + discover params
const MOOD_CONFIG: Record<string, {
  with_genres: string;
  sort_by: string;
  vote_count_gte: number;
  vote_average_gte: number;
}> = {
  intense: {
    with_genres: "28,53,10752",  // Action, Thriller, War
    sort_by: "popularity.desc",
    vote_count_gte: 200,
    vote_average_gte: 7.0,
  },
  easy: {
    with_genres: "35,10751,10770",  // Comedy, Family, TV Movie
    sort_by: "popularity.desc",
    vote_count_gte: 100,
    vote_average_gte: 6.5,
  },
  mindbend: {
    with_genres: "9648,878,53",  // Mystery, Sci-Fi, Thriller
    sort_by: "popularity.desc",
    vote_count_gte: 150,
    vote_average_gte: 7.5,
  },
  light: {
    with_genres: "35,16,10751",  // Comedy, Animation, Family
    sort_by: "popularity.desc",
    vote_count_gte: 100,
    vote_average_gte: 6.5,
  },
  emotional: {
    with_genres: "18,10749,10402",  // Drama, Romance, Music
    sort_by: "popularity.desc",
    vote_count_gte: 150,
    vote_average_gte: 7.0,
  },
};

async function fetchTmdb(path: string) {
  const url = `${TMDB_BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${TMDB_API_KEY}&language=en-US`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

interface MoodResult {
  id: number;
  title: string;
  poster: string | null;
  year: string;
  rating: number;
  type: "movie" | "tv";
  genres: string[];
  description: string;
  matchPercent: number;
  emoji: string;
}

function generateDescription(item: any, mood: string): string {
  const title = item.title || item.name;
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  const genres = (item.genre_ids || []).slice(0, 2);

  const descriptions: Record<string, Record<string, string>> = {
    intense: {
      "28": "Non-stop action that keeps your pulse racing.",
      "53": "Edge-of-your-seat tension from start to finish.",
      "10752": "Brutal and unflinching war drama.",
      _default: "Pure adrenaline — every scene hits hard.",
    },
    easy: {
      "35": "Lighthearted laughs that lift your mood instantly.",
      "10751": "A feel-good watch the whole family can enjoy.",
      _default: "Easy, breezy entertainment — no stress required.",
    },
    mindbend: {
      "9648": "A puzzle that keeps you guessing until the very end.",
      "878": "Big ideas that will keep you thinking for days.",
      "53": "A cerebral thriller that rewards careful attention.",
      _default: "Prepare to question everything you just watched.",
    },
    light: {
      "16": "Colorful, vibrant animation that's pure joy.",
      "35": "Bright humor that never takes itself too seriously.",
      "10751": "Warm and cozy — perfect for a relaxing evening.",
      _default: "Light as air — pure, simple entertainment.",
    },
    emotional: {
      "18": "Deeply moving — hits you right in the heart.",
      "10749": "A love story that will stay with you long after.",
      "10402": "Music that carries all the emotions words can't.",
      _default: "Beautiful and heartfelt — bring tissues.",
    },
  };

  const moodDesc = descriptions[mood] || descriptions.intense;
  for (const [genreId, desc] of Object.entries(moodDesc)) {
    if (genreId === "_default") continue;
    if (genres.includes(Number(genreId))) return `${title} (${year}). ${desc}`;
  }
  return `${title} (${year}). ${moodDesc._default}`;
}

function getMoodEmoji(mood: string): string {
  const emojis: Record<string, string> = {
    intense: "⚡",
    easy: "😌",
    mindbend: "🧠",
    light: "🍿",
    emotional: "🎭",
  };
  return emojis[mood] || "🎬";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mood = searchParams.get("mood")?.toLowerCase();

  if (!mood || !MOOD_CONFIG[mood]) {
    return NextResponse.json(
      { error: "Invalid mood. Valid: intense, easy, mindbend, light, emotional" },
      { status: 400 }
    );
  }

  const config = MOOD_CONFIG[mood];
  const moodEmoji = getMoodEmoji(mood);

  // Fetch movies + TV in parallel
  const [movieData, tvData] = await Promise.all([
    fetchTmdb(
      `/discover/movie?with_genres=${config.with_genres}&sort_by=${config.sort_by}&vote_count.gte=${config.vote_count_gte}&vote_average.gte=${config.vote_average_gte}&page=1`
    ),
    fetchTmdb(
      `/discover/tv?with_genres=${config.with_genres}&sort_by=${config.sort_by}&vote_count.gte=${config.vote_count_gte}&vote_average.gte=${config.vote_average_gte}&page=1`
    ),
  ]);

  // Merge + sort by popularity, take top 10
  const allResults: MoodResult[] = [];

  for (const item of (movieData?.results || []).slice(0, 8)) {
    if (!item.poster_path) continue;
    const genreNames = getGenreNames(item.genre_ids);
    const matchCount = countGenreMatches(item.genre_ids, config.with_genres);
    allResults.push({
      id: item.id,
      title: item.title,
      poster: `https://image.tmdb.org/t/p/w780${item.poster_path}`,
      year: (item.release_date || "").slice(0, 4),
      rating: Math.round(item.vote_average * 10) / 10,
      type: "movie",
      genres: genreNames,
      description: generateDescription({ ...item, genre_ids: item.genre_ids }, mood),
      matchPercent: Math.min(99, 70 + matchCount * 10),
      emoji: moodEmoji,
    });
  }

  for (const item of (tvData?.results || []).slice(0, 8)) {
    if (!item.poster_path) continue;
    if (allResults.find(r => r.title === item.name)) continue; // dedup
    const genreNames = getGenreNames(item.genre_ids);
    const matchCount = countGenreMatches(item.genre_ids, config.with_genres);
    allResults.push({
      id: item.id,
      title: item.name,
      poster: `https://image.tmdb.org/t/p/w780${item.poster_path}`,
      year: (item.first_air_date || "").slice(0, 4),
      rating: Math.round(item.vote_average * 10) / 10,
      type: "tv",
      genres: genreNames,
      description: generateDescription({ ...item, genre_ids: item.genre_ids, name: item.name }, mood),
      matchPercent: Math.min(99, 70 + matchCount * 10),
      emoji: moodEmoji,
    });
  }

  // Sort by match % desc, then rating desc
  allResults.sort((a, b) => b.matchPercent - a.matchPercent || b.rating - a.rating);
  const top10 = allResults.slice(0, 10);

  return NextResponse.json({
    mood,
    results: top10,
    count: top10.length,
  });
}

function countGenreMatches(genreIds: number[], configGenres: string): number {
  const cfgIds = configGenres.split(",").map(Number);
  return genreIds.filter(id => cfgIds.includes(id)).length;
}

function getGenreNames(ids: number[]): string[] {
  const map: Record<number, string> = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
    80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
    14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
    9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie",
    53: "Thriller", 10752: "War", 37: "Western",
  };
  return ids.slice(0, 3).map(id => map[id] || "").filter(Boolean);
}
