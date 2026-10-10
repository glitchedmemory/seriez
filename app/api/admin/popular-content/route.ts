import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername, STAFF_ROLES } from "@/lib/auth-helper";
import { tmdbGet } from "@/lib/tmdb";
import { anilistFetch, getAnimeDetailFromKitsu } from "@/lib/anilist";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TMDB_IMAGE = "https://image.tmdb.org/t/p/w185";

// 애니가 저장하는 번호는 AniList 번호라서 TMDB로 조회하면 404가 나고, 그 작품이
// 관리자 인기 목록에서 통째로 빠진다. 애니는 AniList에서 가져온다.
async function getAnimeMeta(anilistId: number): Promise<{ title: string; poster: string | null } | null> {
  try {
    const res = await anilistFetch(
      `query($id:Int){Media(id:$id){title{english romaji}coverImage{extraLarge}}}`,
      { id: anilistId }
    );
    if (res.ok) {
      const json = await res.json();
      const m = json.data?.Media;
      if (m) {
        return {
          title: m.title?.english || m.title?.romaji || "Unknown",
          poster: m.coverImage?.extraLarge || null,
        };
      }
    }
  } catch {}
  try {
    const kd = await getAnimeDetailFromKitsu(anilistId);
    if (kd) return { title: kd.title, poster: kd.poster };
  } catch {}
  return null;
}

async function getTmdbMeta(mediaType: string, tmdbId: number): Promise<{ title: string; poster: string | null } | null> {
  const d = await tmdbGet(`/${mediaType}/${tmdbId}`);
  if (!d) return null;
  return {
    title: d.title || d.name || "Unknown",
    poster: d.poster_path ? `${TMDB_IMAGE}${d.poster_path}` : null,
  };
}

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
      const meta = row.media_type === "anime"
        ? await getAnimeMeta(row.tmdb_id)
        : await getTmdbMeta(row.media_type, row.tmdb_id);
      if (!meta) continue;
      cache[key] = {
        title: meta.title,
        poster: meta.poster,
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
