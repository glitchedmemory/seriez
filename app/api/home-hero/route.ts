import { NextResponse } from "next/server";
import { getTrending } from "@/lib/tmdb";
import type { TmdbResult } from "@/lib/tmdb";
import { getAnimeTrending } from "@/lib/anilist";

export const dynamic = "force-dynamic";

// Return a fresh random hero + right-now pick from the same pool the homepage
// uses (TMDB movie/TV trending + AniList anime trending). no-store so the client
// always gets a new random pick on reload, independent of the CDN-cached HTML.
export async function GET() {
  let trending: TmdbResult[] = [];
  try {
    const [moviesAndTV, anime] = await Promise.all([
      getTrending(),
      getAnimeTrending(),
    ]);
    trending = [...moviesAndTV, ...anime];
  } catch {
    // fall through — return nulls; client keeps its server-rendered pick
  }

  if (trending.length === 0) {
    return NextResponse.json(
      { hero: null, nextHero: null },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }

  const heroIndex = Math.floor(Math.random() * trending.length);
  const hero = trending[heroIndex];
  const pool = trending.filter((_, i) => i !== heroIndex);
  const nextHero = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;

  return NextResponse.json(
    { hero, nextHero },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
