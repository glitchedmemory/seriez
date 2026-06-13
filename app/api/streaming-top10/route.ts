import { NextResponse } from "next/server";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

interface RawItem {
  rank: number;
  title: string;
  score: number;
  poster?: string; // FlixPatrol poster URL
}

interface EnrichedItem extends RawItem {
  tmdbId?: number;
  tmdbPoster?: string; // TMDB poster (fallback)
  mediaType?: string;
}

interface PlatformData {
  movies: RawItem[];
  tv: RawItem[];
}

interface EnrichedPlatformData {
  movies: EnrichedItem[];
  tv: EnrichedItem[];
}

async function searchTMDB(
  title: string,
  knownType: string
): Promise<{ id: number; poster: string; mediaType: string } | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  try {
    const searchType = knownType === "tv" ? "tv" : "movie";
    const url = `https://api.themoviedb.org/3/search/${searchType}?api_key=${apiKey}&query=${encodeURIComponent(title)}&language=en-US&page=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const match = data.results?.[0];
    if (match && match.poster_path) {
      return {
        id: match.id,
        poster: `${TMDB_IMAGE_BASE}${match.poster_path}`,
        mediaType: searchType,
      };
    }
  } catch {}
  return null;
}

export async function GET() {
  try {
    const filePath = join(process.cwd(), "data", "streaming-top10.json");

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: "Data not available yet" },
        { status: 503 }
      );
    }

    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const rawData: Record<string, PlatformData> = parsed.data;

    // Try to load enriched cache
    const enrichedPath = join(process.cwd(), "data", "streaming-top10-enriched.json");
    let enriched: Record<string, EnrichedPlatformData> | null = null;

    if (existsSync(enrichedPath)) {
      try {
        const cached = JSON.parse(readFileSync(enrichedPath, "utf-8"));
        if (cached.updated_at === parsed.updated_at) {
          enriched = cached.data;
        }
      } catch {}
    }

    // If no cache, enrich with TMDB — but keep FlixPatrol posters as primary
    if (!enriched) {
      enriched = {};
      for (const [platform, platformData] of Object.entries(rawData)) {
        const enrichedPlatform: EnrichedPlatformData = { movies: [], tv: [] };

        const enrichItems = async (items: RawItem[], type: string) => {
          const result: EnrichedItem[] = [];
          for (const item of items) {
            const flixPoster = item.poster; // FlixPatrol poster (fallback only)
            const tmdb = await searchTMDB(item.title, type);
            result.push({
              ...item,
              // Prefer TMDB posters — FlixPatrol URLs often blocked by browsers
              poster: tmdb?.poster || flixPoster,
              tmdbPoster: tmdb?.poster,
              tmdbId: tmdb?.id,
              mediaType: tmdb?.mediaType,
            });
          }
          return result;
        };

        enrichedPlatform.movies = await enrichItems(platformData.movies || [], "movie");
        enrichedPlatform.tv = await enrichItems(platformData.tv || [], "tv");

        enriched[platform] = enrichedPlatform;
      }

      // Save cache
      try {
        writeFileSync(
          enrichedPath,
          JSON.stringify({ updated_at: parsed.updated_at, data: enriched }, null, 2)
        );
      } catch {}
    }

    return NextResponse.json(
      { updated_at: parsed.updated_at, data: enriched },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200",
        },
      }
    );
  } catch (e) {
    console.error("Failed to read streaming top 10 data:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
