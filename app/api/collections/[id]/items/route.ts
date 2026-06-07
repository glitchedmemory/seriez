import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId } from "@/lib/user-utils";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TMDB_IMAGE = "https://image.tmdb.org/t/p/w342";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY;

// ─── GET: collection detail with items ───
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { searchParams } = new URL(req.url);
  const username = await resolveUsername(req);
  const { id: listId } = await params;
  if (!username) return NextResponse.json({ error: "Missing username" }, { status: 400 });

  const userId = await resolveUserId(username);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Get list info
  const { data: list } = await supabase.from("user_lists").select("id, name, is_public, created_at, user_id").eq("id", listId).single();
  if (!list) return NextResponse.json({ error: "Collection not found" }, { status: 404 });

  // Get items
  const { data: items } = await supabase.from("list_items").select("tmdb_id, media_type, added_at").eq("list_id", listId).order("added_at", { ascending: false });

  // Enrich with TMDB
  const enriched = await Promise.all(
    (items || []).map(async (item) => {
      try {
        const res = await fetch(`${TMDB_API}/${item.media_type}/${item.tmdb_id}?api_key=${TMDB_KEY}`);
        if (!res.ok) return null;
        const d = await res.json();
        return {
          tmdbId: item.tmdb_id,
          mediaType: item.media_type,
          title: d.title || d.name || "Unknown",
          poster: d.poster_path ? `${TMDB_IMAGE}${d.poster_path}` : null,
          year: (d.release_date || d.first_air_date || "").slice(0, 4) || null,
          rating: Math.round((d.vote_average || 0) * 10) / 10,
          addedAt: item.added_at,
        };
      } catch { return null; }
    })
  );

  return NextResponse.json({
    id: list.id, name: list.name, isPublic: list.is_public,
    isOwner: list.user_id === userId, createdAt: list.created_at,
    items: enriched.filter(Boolean),
  });
}

// ─── POST: add item to collection ───
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const body = await req.json();
    const { tmdbId, mediaType } = body;
    const { id: listId } = await params;
    if (tmdbId == null || !mediaType) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const userId = await resolveUserId(username);
    if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { error } = await supabase.from("list_items").insert({ list_id: listId, tmdb_id: tmdbId, media_type: mediaType });
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Already in collection" }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// ─── DELETE: remove item from collection ───
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const body = await req.json();
    const { tmdbId, mediaType } = body;
    const { id: listId } = await params;
    if (tmdbId == null || !mediaType) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const userId = await resolveUserId(username);
    if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { error } = await supabase.from("list_items").delete().eq("list_id", listId).eq("tmdb_id", tmdbId).eq("media_type", mediaType);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
