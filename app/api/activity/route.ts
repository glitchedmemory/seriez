import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId } from "@/lib/user-utils";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TMDB_IMAGE = "https://image.tmdb.org/t/p/w92";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY;

export async function GET(req: NextRequest) {
  const username = await resolveUsername(req);
  if (!username) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const userId = await resolveUserId(username);
  if (!userId) {
    return NextResponse.json({ activities: [] });
  }

  // 1. Get users this person follows
  const { data: follows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  if (!follows?.length) {
    // No follows yet — return empty
    return NextResponse.json({ activities: [] });
  }

  const followingIds = follows.map((f) => f.following_id);

  // Resolve IDs to usernames
  const { data: followedUsers } = await supabase
    .from("public_profiles")
    .select("id, username")
    .in("id", followingIds);

  const idToUsername: Record<string, string> = {};
  for (const u of followedUsers || []) {
    idToUsername[u.id] = u.username;
  }

  // 2. Get recent reviews from followed users
  const { data: reviews } = await supabase
    .from("reviews")
    .select("username, tmdb_id, media_type, content, rating, created_at")
    .in("username", followingIds)
    .order("created_at", { ascending: false })
    .limit(30);

  // 3. Get recent tracking changes from followed users
  const { data: tracking } = await supabase
    .from("media_trackings")
    .select("username, tmdb_id, media_type, status, rating, updated_at")
    .in("username", followingIds)
    .order("updated_at", { ascending: false })
    .limit(30);

  // 4. Combine and deduplicate into activity feed
  interface Activity {
    id: string;
    type: "review" | "rated" | "watched" | "watching" | "plan_to_watch";
    username: string;
    tmdbId: number;
    mediaType: string;
    title: string;
    poster: string | null;
    year: string | null;
    rating?: number;
    content?: string;
    createdAt: string;
  }

  const activities: Activity[] = [];

  // Reviews
  for (const r of reviews || []) {
    if (r.rating && r.rating >= 5) {
      // Rated (with review)
      activities.push({
        id: `rev-${r.username}-${r.tmdb_id}`,
        type: "rated",
        username: r.username,
        tmdbId: r.tmdb_id,
        mediaType: r.media_type,
        title: "",
        poster: null,
        year: null,
        rating: r.rating >= 10 ? r.rating / 10 : r.rating,
        content: r.content?.slice(0, 200),
        createdAt: r.created_at,
      });
    }
    if (r.content) {
      activities.push({
        id: `review-${r.username}-${r.tmdb_id}`,
        type: "review",
        username: r.username,
        tmdbId: r.tmdb_id,
        mediaType: r.media_type,
        title: "",
        poster: null,
        year: null,
        content: r.content.slice(0, 200),
        rating: r.rating >= 10 ? r.rating / 10 : r.rating || undefined,
        createdAt: r.created_at,
      });
    }
  }

  // Tracking
  for (const t of tracking || []) {
    const typeMap: Record<string, string> = {
      completed: "watched",
      watching: "watching",
      plan_to_watch: "plan_to_watch",
    };
    const type = typeMap[t.status];
    if (!type) continue;

    activities.push({
      id: `track-${t.username}-${t.tmdb_id}`,
      type: type as Activity["type"],
      username: t.username,
      tmdbId: t.tmdb_id,
      mediaType: t.media_type,
      title: "",
      poster: null,
      year: null,
      rating: t.rating || undefined,
      createdAt: t.updated_at,
    });
  }

  // Sort by most recent, deduplicate by (username, tmdbId, type), limit
  activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Deduplicate: keep only the most recent activity per (username, tmdbId, type)
  const seen = new Set<string>();
  const unique = activities.filter((a) => {
    const key = `${a.username}-${a.tmdbId}-${a.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);

  // 5. Enrich with TMDB data in parallel
  const enriched = await Promise.all(
    unique.map(async (a) => {
      try {
        const res = await fetch(
          `${TMDB_API}/${a.mediaType}/${a.tmdbId}?api_key=${TMDB_KEY}`
        );
        if (!res.ok) return a;
        const d = await res.json();
        return {
          ...a,
          title: d.title || d.name || "Unknown",
          poster: d.poster_path ? `${TMDB_IMAGE}${d.poster_path}` : null,
          year: (d.release_date || d.first_air_date || "").slice(0, 4) || null,
        };
      } catch {
        return a;
      }
    })
  );

  return NextResponse.json({ activities: enriched });
}
