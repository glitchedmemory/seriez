import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername, STAFF_ROLES } from "@/lib/auth-helper";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TMDB_IMAGE = "https://image.tmdb.org/t/p/w185";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY;

async function enrichTitles(
  rows: { tmdb_id: number; media_type: string; count?: number; c?: number; avg_rating?: number; r?: number }[]
) {
  const cache: Record<string, { title: string; poster: string | null; count: number; avg_rating: number | null }> = {};
  for (const row of rows) {
    const key = `${row.media_type}-${row.tmdb_id}`;
    if (cache[key]) {
      cache[key].count += (row.count || row.c || 0);
      continue;
    }
    try {
      const res = await fetch(`${TMDB_API}/${row.media_type}/${row.tmdb_id}?api_key=${TMDB_KEY}`);
      if (!res.ok) continue;
      const d = await res.json();
      cache[key] = {
        title: d.title || d.name || "Unknown",
        poster: d.poster_path ? `${TMDB_IMAGE}${d.poster_path}` : null,
        count: row.count || row.c || 0,
        avg_rating: row.avg_rating ?? row.r ?? null,
      };
    } catch {}
  }
  return Object.entries(cache).map(([key, v]) => {
    const [media_type, tmdb_id] = key.split("-");
    return { tmdb_id: parseInt(tmdb_id), media_type, ...v };
  });
}

export async function GET(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { data: userData } = await supabaseAdmin
      .from("users").select("role").eq("username", username).maybeSingle();
    if (!STAFF_ROLES.includes(userData?.role || "")) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    // Most tracked
    const { data: tracked } = await supabaseAdmin
      .from("media_trackings")
      .select("tmdb_id, media_type")
      .order("tmdb_id");

    const trackedCounts: Record<string, number> = {};
    for (const t of tracked || []) {
      const k = `${t.media_type}-${t.tmdb_id}`;
      trackedCounts[k] = (trackedCounts[k] || 0) + 1;
    }
    const topTracked = Object.entries(trackedCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([key, count]) => {
        const [media_type, tmdb_id] = key.split("-");
        return { tmdb_id: parseInt(tmdb_id), media_type, count };
      });

    // Most reviewed
    const { data: reviewed } = await supabaseAdmin
      .from("reviews")
      .select("tmdb_id, media_type, rating");

    const reviewMap: Record<string, { count: number; totalRating: number }> = {};
    for (const r of reviewed || []) {
      const k = `${r.media_type}-${r.tmdb_id}`;
      if (!reviewMap[k]) reviewMap[k] = { count: 0, totalRating: 0 };
      reviewMap[k].count++;
      reviewMap[k].totalRating += r.rating || 0;
    }
    const topReviewed = Object.entries(reviewMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 50)
      .map(([key, v]) => {
        const [media_type, tmdb_id] = key.split("-");
        return {
          tmdb_id: parseInt(tmdb_id),
          media_type,
          count: v.count,
          avg_rating: Math.round((v.totalRating / v.count) * 10) / 10,
        };
      });

    // Most collected
    const { data: collected } = await supabaseAdmin
      .from("list_items")
      .select("tmdb_id, media_type");
    const collCounts: Record<string, number> = {};
    for (const c of collected || []) {
      const k = `${c.media_type}-${c.tmdb_id}`;
      collCounts[k] = (collCounts[k] || 0) + 1;
    }
    const topCollected = Object.entries(collCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([key, count]) => {
        const [media_type, tmdb_id] = key.split("-");
        return { tmdb_id: parseInt(tmdb_id), media_type, count };
      });

    // Enrich all with TMDB
    const [enrichedTracked, enrichedReviewed, enrichedCollected] = await Promise.all([
      enrichTitles(topTracked),
      enrichTitles(topReviewed.map(r => ({ ...r, c: r.count, r: r.avg_rating }))),
      enrichTitles(topCollected),
    ]);

    return NextResponse.json({
      most_tracked: enrichedTracked.sort((a, b) => b.count - a.count),
      most_reviewed: enrichedReviewed.sort((a, b) => b.count - a.count),
      most_collected: enrichedCollected.sort((a, b) => b.count - a.count),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
