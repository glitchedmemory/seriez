import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId } from "@/lib/user-utils";
import { resolveUsername } from "@/lib/auth-helper";
import { getAnimeDetailFromKitsu } from "@/lib/anilist";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const PAGE_SIZE = 48;

// AniList 도메인(s4.anilist.co) 포스터는 AniList 다운 시 로드되지 않으므로 교체 대상.
// media.kitsu.app은 Kitsu CDN이라 정상 로드됨 — 유지.
async function resolveAnimePoster(anilistId: number, currentPoster: string | null): Promise<string | null> {
  // poster가 null이거나 AniList 도메인이면 Kitsu에서 재조회
  if (currentPoster && !currentPoster.includes("s4.anilist.co")) {
    return currentPoster;
  }
  try {
    const kd = await getAnimeDetailFromKitsu(anilistId);
    return kd?.poster || null;
  } catch {
    return null;
  }
}

async function resolveTmdbPoster(tmdbId: number, mediaType: string, currentPoster: string | null): Promise<string | null> {
  if (currentPoster) return currentPoster;
  try {
    const ep = mediaType === "tv" ? "tv" : "movie";
    const res = await fetch(`https://api.themoviedb.org/3/${ep}/${tmdbId}?api_key=${process.env.TMDB_API_KEY}`, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const d = await res.json();
    return d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username") || await resolveUsername(req);
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1") || 1;
  const limit = Math.min(parseInt(searchParams.get("limit") || String(PAGE_SIZE)) || PAGE_SIZE, PAGE_SIZE);

  if (!username) return NextResponse.json({ error: "Missing username" }, { status: 400 });

  const userId = await resolveUserId(username);
  if (!userId) return NextResponse.json({ items: [], total: 0, page, totalPages: 0 });

  // Count total
  let countQuery = supabaseAdmin.from("media_trackings").select("*", { count: "exact", head: true }).eq("username", userId);
  if (status) countQuery = countQuery.eq("status", status);
  const { count: total, error: countErr } = await countQuery;
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  if (!total) return NextResponse.json({ items: [], total: 0, page, totalPages: 0 });

  // Fetch page
  let query = supabaseAdmin.from("media_trackings").select("*").eq("username", userId).order("updated_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ items: [], total: total || 0, page, totalPages: Math.ceil((total || 0) / limit) });

  // Map DB rows, backfilling missing/dead posters via Kitsu (anime) or TMDB (movie/tv)
  const items = await Promise.all(data.map(async (t: any) => {
    let poster = t.poster_url || null;
    if (t.media_type === "anime") {
      // Refetch from Kitsu if poster is missing/AniList-domain (AniList may be down)
      poster = await resolveAnimePoster(t.tmdb_id, poster);
    } else if (!poster) {
      // movie/tv missing poster → TMDB backfill
      poster = await resolveTmdbPoster(t.tmdb_id, t.media_type, poster);
    }

    return {
      tmdbId: t.tmdb_id,
      mediaType: t.media_type,
      seasonNumber: t.season_number,
      seasonName: t.season_number > 0 ? `Season ${t.season_number}` : null,
      seasonPoster: t.season_poster || null,
      status: t.status,
      rating: t.rating,
      progress: t.progress,
      updatedAt: t.updated_at,
      title: t.title || "Untitled",
      poster,
      year: t.year || null,
      tmdbRating: t.tmdb_rating || 0,
    };
  }));

  return NextResponse.json({ items, total: total || 0, page, totalPages: Math.ceil((total || 0) / limit) });
}
