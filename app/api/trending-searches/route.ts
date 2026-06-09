import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTrending } from "@/lib/tmdb";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    // Try to get real search logs from our database
    const { data: logs, error } = await supabaseAdmin
      .from("search_logs")
      .select("query, tmdb_id, media_type, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error && logs && logs.length > 0) {
      // Count queries, dedupe by query text
      const countMap = new Map<string, { count: number; tmdbId: number | null; mediaType: string | null }>();
      for (const row of logs) {
        const key = row.query.toLowerCase().trim();
        const existing = countMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          countMap.set(key, { count: 1, tmdbId: row.tmdb_id, mediaType: row.media_type });
        }
      }
      // Sort by count desc, take top 15
      const sorted = Array.from(countMap.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 15)
        .map(([query, info]) => ({
          id: info.tmdbId || 0,
          title: query.charAt(0).toUpperCase() + query.slice(1),
          type: info.mediaType || "movie",
        }));
      return NextResponse.json({ searches: sorted });
    }

    // Fallback to TMDB trending if no search logs yet
    const items = await getTrending();
    const searches = items.slice(0, 15).map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
    }));
    return NextResponse.json({ searches });
  } catch {
    // Ultimate fallback
    try {
      const items = await getTrending();
      const searches = items.slice(0, 15).map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
      }));
      return NextResponse.json({ searches });
    } catch {
      return NextResponse.json({ searches: [] });
    }
  }
}
