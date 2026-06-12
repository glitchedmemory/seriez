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
// Minimum likes to qualify
const MIN_LIKES = 5;
// Server cache: 2 hours
export const revalidate = 7200;

export async function GET() {
  try {
    // Get all published collections with ≥ MIN_LIKES likes
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

      const qualified = fallback.filter((l) => (likeMap[l.id] || 0) >= MIN_LIKES);
      const shuffled = qualified.sort(() => Math.random() - 0.5).slice(0, PICK_COUNT);

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

      return NextResponse.json({ collections: enriched });
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

    return NextResponse.json({ collections: enriched });
  } catch (err) {
    return NextResponse.json({ collections: [], error: "Failed to load" }, { status: 500 });
  }
}

async function getThumbnails(items: { tmdb_id: number; media_type: string }[]): Promise<(string | null)[]> {
  if (!TMDB_KEY) return items.map(() => null);
  return Promise.all(
    items.map(async (item) => {
      try {
        const res = await fetch(`${TMDB_API}/${item.media_type}/${item.tmdb_id}?api_key=${TMDB_KEY}`, {
          next: { revalidate: 86400 },
        });
        if (!res.ok) return null;
        const d = await res.json();
        return d.poster_path ? `${TMDB_IMAGE}${d.poster_path}` : null;
      } catch {
        return null;
      }
    })
  );
}
