import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const supabase = await createClient();

  try {
    const { data: reviews, error } = await supabase
      .from("reviews")
      .select("tmdb_id, media_type, content, rating, created_at")
      .eq("username", username)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
    }

    if (!reviews || reviews.length === 0) {
      return NextResponse.json({ reviews: [] });
    }

    // Gather unique tmdb_id + media_type pairs
    const pairs = reviews.map(r => ({ tmdb_id: r.tmdb_id, media_type: r.media_type }));

    // Look up title/poster/year from media_trackings
    const { data: trackings, error: trErr } = await supabase
      .from("media_trackings")
      .select("tmdb_id, media_type, title, poster, year")
      .or(pairs.map(p => `and(tmdb_id.eq.${p.tmdb_id},media_type.eq.${p.media_type})`).join(","));

    const metaMap: Record<string, { title: string; poster: string | null; year: number | null }> = {};
    if (trackings) {
      for (const t of trackings) {
        const key = `${t.tmdb_id}-${t.media_type}`;
        if (!metaMap[key]) metaMap[key] = { title: t.title, poster: t.poster, year: t.year };
      }
    }

    const enriched = reviews.map(r => {
      const key = `${r.tmdb_id}-${r.media_type}`;
      const meta = metaMap[key] || { title: `${r.media_type === "anime" ? "Anime" : r.media_type === "tv" ? "TV Show" : "Movie"} #${r.tmdb_id}`, poster: null, year: null };
      return { ...r, title: meta.title, poster: meta.poster, year: meta.year };
    });

    return NextResponse.json({ reviews: enriched });
  } catch (err: any) {
    console.error("Reviews fetch error:", err);
    return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
  }
}
