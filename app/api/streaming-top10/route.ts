import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmdbGet } from "@/lib/tmdb";

// FlixPatrol CDN returns 403 to every request (hotlink protection, even server-side),
// so posters must be swapped for TMDB image URLs. Every item has a tmdbId.
async function resolvePoster(item: {
  poster?: string;
  tmdbId?: number;
  mediaType?: string;
}): Promise<string | undefined> {
  if (!item.tmdbId) return item.poster;
  try {
    const type = item.mediaType === "tv" ? "tv" : "movie";
    const d = await tmdbGet(`/${type}/${item.tmdbId}`);
    const path = d?.poster_path as string | null | undefined;
    if (path) return `https://image.tmdb.org/t/p/w342${path}`;
  } catch {
    /* keep original poster if TMDB lookup fails */
  }
  return item.poster;
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

    // Resolve TMDB posters in small parallel batches to avoid TMDB rate limits
    const platforms = parsed.data as Record<
      string,
      { movies: any[]; tv: any[] }
    >;
    const allItems = Object.values(platforms).flatMap((p) => [
      ...p.movies,
      ...p.tv,
    ]);
    const CHUNK = 10;
    for (let i = 0; i < allItems.length; i += CHUNK) {
      const chunk = allItems.slice(i, i + CHUNK);
      await Promise.all(chunk.map(async (item) => {
        item.poster = await resolvePoster(item);
      }));
    }

    return NextResponse.json(
      { updated_at: parsed.updated_at, data: platforms },
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
