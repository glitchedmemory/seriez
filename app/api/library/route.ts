import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId } from "@/lib/user-utils";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const PAGE_SIZE = 50;

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

  // Map DB rows directly — metadata stored at track time
  const items = data.map((t: any) => ({
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
    poster: t.poster_url || null,
    year: t.year || null,
    tmdbRating: t.tmdb_rating || 0,
  }));

  return NextResponse.json({ items, total: total || 0, page, totalPages: Math.ceil((total || 0) / limit) });
}
