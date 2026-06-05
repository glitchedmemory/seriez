import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// rating is stored as integer × 10 (e.g. 3.5 → 35) because column is integer
// Legacy: old ratings stored as plain integers (2,3,4,5) before half‑star support
const TO_DB = (r: number) => Math.round(r * 10);
const FROM_DB = (v: number) => v >= 10 ? v / 10 : v;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tmdbId = searchParams.get("tmdbId");
  const mediaType = searchParams.get("mediaType");
  const statsOnly = searchParams.get("stats") === "true";

  if (!tmdbId || !mediaType) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const tmdbIdNum = parseInt(tmdbId);

  if (statsOnly) {
    const { data, error } = await supabase
      .from("reviews")
      .select("rating")
      .eq("tmdb_id", tmdbIdNum)
      .eq("media_type", mediaType);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // distribution: half-star buckets 0.5…5.0
    const distribution: Record<number, number> = {};
    for (let i = 1; i <= 10; i++) distribution[i / 2] = 0;

    let total = 0;
    let sum = 0;
    for (const r of data) {
      const realRating = FROM_DB(r.rating);
      const bucket = Math.round(realRating * 2) / 2; // snap to nearest 0.5
      if (bucket >= 0.5 && bucket <= 5.0) {
        distribution[bucket]++;
        total++;
        sum += realRating;
      }
    }
    const average = total > 0 ? Math.round((sum / total) * 10) / 10 : 0;

    return NextResponse.json({ average, total, distribution });
  }

  // Full reviews list
  const { data, error } = await supabase
    .from("reviews")
    .select("id, username, content, rating, likes_count, created_at")
    .eq("tmdb_id", tmdbIdNum)
    .eq("media_type", mediaType)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    data.map((r) => ({
      id: r.id,
      username: r.username || "Anonymous",
      content: r.content,
      rating: FROM_DB(r.rating || 0),
      likes: r.likes_count || 0,
      createdAt: r.created_at,
    }))
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tmdbId, mediaType, username, content, rating } = body;

    if (!tmdbId || !mediaType || !username?.trim() || !content?.trim() || rating === undefined || rating === null) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    }
    // Validate rating: 0.5–5.0, 0.5 increments
    if (typeof rating !== "number" || rating < 0.5 || rating > 5 || (rating * 2) % 1 !== 0) {
      return NextResponse.json({ error: "Rating must be 0.5–5 in 0.5 steps" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("reviews")
      .insert({
        tmdb_id: tmdbId,
        media_type: mediaType,
        username: username.trim().slice(0, 20),
        content: content.trim().slice(0, 2000),
        rating: TO_DB(rating),
      })
      .select("id, username, content, rating, likes_count, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        id: data.id,
        username: data.username,
        content: data.content,
        rating: FROM_DB(data.rating),
        likes: data.likes_count || 0,
        createdAt: data.created_at,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { reviewId, action } = body;

    if (!reviewId) {
      return NextResponse.json({ error: "Missing reviewId" }, { status: 400 });
    }

    if (action === "like") {
      const { data, error } = await supabase.rpc("increment_likes", {
        review_id: reviewId,
      });

      if (error) {
        const { data: current } = await supabase
          .from("reviews")
          .select("likes_count")
          .eq("id", reviewId)
          .single();

        const { data: updated, error: updateErr } = await supabase
          .from("reviews")
          .update({ likes_count: (current?.likes_count || 0) + 1 })
          .eq("id", reviewId)
          .select("likes_count")
          .single();

        if (updateErr) {
          return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }
        return NextResponse.json({ likes: updated?.likes_count || 0 });
      }

      return NextResponse.json({ likes: data });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
