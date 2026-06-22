import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId } from "@/lib/user-utils";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const TMDB_IMAGE = "https://image.tmdb.org/t/p/w780";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY;

// ─── GET: collection detail with items ───
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { searchParams } = new URL(req.url);
  const username = await resolveUsername(req);
  const { id: listId } = await params;

  // Get list info — public, no auth needed
  const { data: list } = await supabase.from("user_lists").select("id, name, is_public, is_published, created_at, user_id").eq("id", listId).single();
  if (!list) return NextResponse.json({ error: "Collection not found" }, { status: 404 });

  // Get owner username
  const { data: owner } = await supabase.from("users").select("username").eq("id", list.user_id).single();
  const ownerName = owner?.username || "unknown";

  // Check if current user is owner (null if not logged in)
  let isOwner = false;
  if (username) {
    const userId = await resolveUserId(username);
    isOwner = userId === list.user_id;
  }

  // Get items
  const { data: items } = await supabase.from("list_items").select("tmdb_id, media_type, season_number, note, added_at").eq("list_id", listId).order("added_at", { ascending: false });

const ANILIST_ITEMS_API = "https://graphql.anilist.co";

  // Enrich: anime → batch AniList (single query), everything else → TMDB
  const itemList = items || [];
  const animeIndices: number[] = [];
  const animeIds: number[] = [];
  itemList.forEach((item, i) => {
    if (item.media_type === "anime") { animeIndices.push(i); animeIds.push(item.tmdb_id); }
  });

  // Batch AniList query for all anime items at once
  const animeMap = new Map<number, any>();
  if (animeIds.length > 0) {
    try {
      const gql = `query($ids:[Int]){Page(perPage:50){media(id_in:$ids,type:ANIME){id title{romaji english}coverImage{extraLarge}startDate{year}averageScore}}}`;
      const res = await fetch(ANILIST_ITEMS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: gql, variables: { ids: animeIds } }),
      });
      if (res.ok) {
        const json = await res.json();
        for (const m of json.data?.Page?.media || []) {
          animeMap.set(m.id, m);
        }
      }
    } catch {}
  }

  const enriched = await Promise.all(
    itemList.map(async (item, i) => {
      try {
        if (item.media_type === "anime") {
          const m = animeMap.get(item.tmdb_id);
          if (!m) return null;
          return {
            tmdbId: item.tmdb_id,
            mediaType: item.media_type,
            seasonNumber: item.season_number || 0,
            title: m.title?.english || m.title?.romaji || "Unknown",
            poster: m.coverImage?.extraLarge || null,
            year: m.startDate?.year ? String(m.startDate.year) : null,
            rating: m.averageScore ? Math.round(m.averageScore) / 10 : 0,
            note: item.note || null,
            addedAt: item.added_at,
          };
        }
        const res = await fetch(`${TMDB_API}/${item.media_type}/${item.tmdb_id}?api_key=${TMDB_KEY}`);
        if (!res.ok) return null;
        const d = await res.json();
        return {
          tmdbId: item.tmdb_id,
          mediaType: item.media_type,
          seasonNumber: item.season_number || 0,
          title: d.title || d.name || "Unknown",
          poster: d.poster_path ? `${TMDB_IMAGE}${d.poster_path}` : null,
          year: (d.release_date || d.first_air_date || "").slice(0, 4) || null,
          rating: Math.round((d.vote_average || 0) * 10) / 10,
          note: item.note || null,
          addedAt: item.added_at,
        };
      } catch { return null; }
    })
  );

  // Get like count
  const { count: likesCount } = await supabase
    .from("collection_likes").select("*", { count: "exact", head: true }).eq("list_id", listId);

  return NextResponse.json({
    id: list.id, name: list.name, owner: ownerName,
    isPublic: list.is_public, isPublished: list.is_published,
    isOwner, createdAt: list.created_at,
    likesCount: likesCount || 0, itemCount: (items || []).length,
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
    const { tmdbId, mediaType, seasonNumber, note } = body;
    const { id: listId } = await params;
    if (tmdbId == null || !mediaType) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    if (!note || !note.trim()) return NextResponse.json({ error: "A one-line note is required" }, { status: 400 });
    if (note.length > 140) return NextResponse.json({ error: "Note must be under 140 characters" }, { status: 400 });

    const userId = await resolveUserId(username);
    if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Verify ownership
    const { data: list } = await supabase.from("user_lists").select("user_id").eq("id", listId).single();
    if (!list) return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    if (list.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const sn = seasonNumber ?? 0;
    const { error } = await supabase.from("list_items").insert({ list_id: listId, tmdb_id: tmdbId, media_type: mediaType, season_number: sn, note: note.trim() });
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
    const { tmdbId, mediaType, seasonNumber } = body;
    const { id: listId } = await params;
    if (tmdbId == null || !mediaType) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const userId = await resolveUserId(username);
    if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Verify ownership
    const { data: listDel } = await supabase.from("user_lists").select("user_id").eq("id", listId).single();
    if (!listDel) return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    if (listDel.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const sn = seasonNumber ?? 0;
    const { error } = await supabase.from("list_items").delete().eq("list_id", listId).eq("tmdb_id", tmdbId).eq("media_type", mediaType).eq("season_number", sn);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
