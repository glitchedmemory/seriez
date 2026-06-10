import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId } from "@/lib/user-utils";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const TMDB_IMAGE = "https://image.tmdb.org/t/p/w342";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = await resolveUsername(req);
  const status = searchParams.get("status");

  if (!username) {
    return NextResponse.json({ error: "Missing username" }, { status: 400 });
  }

  const userId = await resolveUserId(username);
  if (!userId) {
    return NextResponse.json({ items: [] });
  }

  let query = supabaseAdmin
    .from("media_trackings")
    .select("*")
    .eq("username", userId)
    .order("updated_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ items: [] });
  }

  // Enrich with TMDB data sequentially (avoid rate limit)
  const items = [];
  for (const t of data) {
    try {
      const res = await fetch(
        `${TMDB_API}/${t.media_type}/${t.tmdb_id}?api_key=${TMDB_KEY}`
      );
      if (!res.ok) { items.push(null); continue; }
      const detail = await res.json();
      items.push({
        tmdbId: t.tmdb_id,
        mediaType: t.media_type,
        status: t.status,
        rating: t.rating,
        progress: t.progress,
        updatedAt: t.updated_at,
        title: detail.title || detail.name || "Unknown",
        poster: detail.poster_path ? `${TMDB_IMAGE}${detail.poster_path}` : null,
        year: (detail.release_date || detail.first_air_date || "").slice(0, 4) || null,
        tmdbRating: Math.round((detail.vote_average || 0) * 10) / 10,
      });
    } catch {
      items.push(null);
    }
    await new Promise(r => setTimeout(r, 50)); // avoid TMDB rate limit
  }

  return NextResponse.json({
    items: items.filter(Boolean),
  });
}
