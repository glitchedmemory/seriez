import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TMDB_IMAGE = "https://image.tmdb.org/t/p/w500";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY;

// How many collections to pick randomly
const PICK_COUNT = 8;
// No minimum likes — any published collection qualifies
const MIN_LIKES = 0;
// Server cache: 30 minutes
export const revalidate = 1800;

export async function GET() {
  try {
    // Get all published collections (no min likes)
    const { data: collections, error } = await supabase.rpc("get_published_collections", {
      min_likes: MIN_LIKES,
    });

    if (error) {
      // Fallback: manual query if RPC not available
      const { data: fallback } = await supabase
        .from("user_lists")
        .select("id, name, user_id, created_at, published_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false });

      if (!fallback?.length) {
        return NextResponse.json({ collections: [] });
      }

      // Count likes for each
      const listIds = fallback.map((l) => l.id);
      const { data: likeCounts } = await supabase
        .from("collection_likes")
        .select("list_id")
        .in("list_id", listIds);

      const likeMap: Record<string, number> = {};
      for (const l of likeCounts || []) {
        likeMap[l.list_id] = (likeMap[l.list_id] || 0) + 1;
      }

      // All published collections qualify (no min likes)
      const shuffled = fallback.sort(() => Math.random() - 0.5).slice(0, PICK_COUNT);

      const userIds = [...new Set(shuffled.map((l) => l.user_id))];
      const { data: users } = await supabase
        .from("users").select("id, username").in("id", userIds);
      const userMap: Record<string, string> = {};
      for (const u of users || []) userMap[u.id] = u.username;

      // Get items for each to build thumbnails
      const enriched = await Promise.all(
        shuffled.map(async (l) => {
          const { data: items, count: realCount } = await supabase
            .from("list_items")
            .select("tmdb_id, media_type", { count: "exact", head: false })
            .eq("list_id", l.id)
            .limit(4);
          const thumbs = await getThumbnails(items || []);
          return {
            id: l.id,
            name: l.name,
            owner: userMap[l.user_id] || "unknown",
            likesCount: likeMap[l.id] || 0,
            itemCount: realCount ?? 0,
            thumbnails: thumbs,
          };
        })
      );

      return NextResponse.json({ collections: enriched.filter(c => c.itemCount > 0) });
    }

    // RPC path — already filtered and counted
    const shuffled = (collections || []).sort(() => Math.random() - 0.5).slice(0, PICK_COUNT);

    const enriched = await Promise.all(
      shuffled.map(async (c: any) => {
        const { data: items, count: realCount } = await supabase
          .from("list_items")
          .select("tmdb_id, media_type", { count: "exact", head: false })
          .eq("list_id", c.id)
          .limit(4);
        const thumbs = await getThumbnails(items || []);
        return {
          id: c.id,
          name: c.name,
          owner: c.owner_username || "unknown",
          likesCount: c.likes_count || 0,
          itemCount: realCount ?? 0,
          thumbnails: thumbs,
        };
      })
    );

    return NextResponse.json({ collections: enriched.filter(c => c.itemCount > 0) });
  } catch (err) {
    return NextResponse.json({ collections: [], error: "Failed to load" }, { status: 500 });
  }
}

const ANILIST_API = "https://graphql.anilist.co";

async function getThumbnails(items: { tmdb_id: number; media_type: string }[]): Promise<(string | null)[]> {
  if (items.length === 0) return [];

  // Split: anime → AniList, everything else → TMDB
  const animeItems = items.filter((i) => i.media_type === "anime");
  const tmdbItems = items.filter((i) => i.media_type !== "anime");

  const posterMap = new Map<string, string | null>();

  // ── Anime: batch AniList query ──
  if (animeItems.length > 0) {
    try {
      const ids = animeItems.map((i) => i.tmdb_id);
      const query = `query($ids:[Int]){Page(perPage:50){media(id_in:$ids,type:ANIME){id coverImage{extraLarge}}}}`;
      const res = await fetch(ANILIST_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { ids } }),
        next: { revalidate: 86400 },
      });
      if (res.ok) {
        const json = await res.json();
        for (const m of json.data?.Page?.media || []) {
          posterMap.set(`anime:${m.id}`, m.coverImage?.extraLarge || null);
        }
      }
    } catch {}
    // Fill missing with null
    for (const item of animeItems) {
      if (!posterMap.has(`anime:${item.tmdb_id}`)) {
        posterMap.set(`anime:${item.tmdb_id}`, null);
      }
    }
  }

  // ── TMDB: keep existing logic ──
  if (tmdbItems.length > 0 && TMDB_KEY) {
    await Promise.all(
      tmdbItems.map(async (item) => {
        try {
          const res = await fetch(`${TMDB_API}/${item.media_type}/${item.tmdb_id}?api_key=${TMDB_KEY}`, {
            next: { revalidate: 86400 },
          });
          if (!res.ok) { posterMap.set(`tmdb:${item.tmdb_id}:${item.media_type}`, null); return; }
          const d = await res.json();
          posterMap.set(`tmdb:${item.tmdb_id}:${item.media_type}`, d.poster_path ? `${TMDB_IMAGE}${d.poster_path}` : null);
        } catch {
          posterMap.set(`tmdb:${item.tmdb_id}:${item.media_type}`, null);
        }
      })
    );
  }

  // ── Reassemble in original order ──
  return items.map((item) => {
    if (item.media_type === "anime") {
      return posterMap.get(`anime:${item.tmdb_id}`) ?? null;
    }
    return posterMap.get(`tmdb:${item.tmdb_id}:${item.media_type}`) ?? null;
  });
}
