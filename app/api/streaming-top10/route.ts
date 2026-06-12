import { NextResponse } from "next/server";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w92";

interface RawItem {
  rank: number;
  title: string;
  score: number;
}

interface EnrichedItem {
  rank: number;
  title: string;
  score: number;
  tmdbId?: number;
  poster?: string;
  mediaType?: string;
}

async function searchTMDB(title: string): Promise<{ id: number; poster: string; mediaType: string } | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(title)}&language=en-US&page=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const match = data.results?.[0];
    if (match && match.poster_path) {
      return {
        id: match.id,
        poster: `${TMDB_IMAGE_BASE}${match.poster_path}`,
        mediaType: match.media_type === "tv" ? "tv" : "movie",
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
    const rawData: Record<string, RawItem[]> = parsed.data;

    // Try to load enriched cache
    const enrichedPath = join(process.cwd(), "data", "streaming-top10-enriched.json");
    let enriched: Record<string, EnrichedItem[]> | null = null;

    if (existsSync(enrichedPath)) {
      try {
        const cached = JSON.parse(readFileSync(enrichedPath, "utf-8"));
        // Only use cache if data timestamp matches
        if (cached.updated_at === parsed.updated_at) {
          enriched = cached.data;
        }
      } catch {}
    }

    // If no cache, enrich with TMDB
    if (!enriched) {
      enriched = {};
      for (const [platform, items] of Object.entries(rawData)) {
        const enrichedItems: EnrichedItem[] = [];
        for (const item of items as RawItem[]) {
          const tmdb = await searchTMDB(item.title);
          enrichedItems.push({
            ...item,
            tmdbId: tmdb?.id,
            poster: tmdb?.poster,
            mediaType: tmdb?.mediaType,
          });
        }
        enriched[platform] = enrichedItems;
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
