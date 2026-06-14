import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId } from "@/lib/user-utils";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TMDB_IMAGE = "https://image.tmdb.org/t/p/w500";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY;

// Virtual activity data — shows full features when no real follows exist
function getVirtualActivities(): Activity[] {
  const now = Date.now();
  const m = (min: number) => new Date(now - min * 60000).toISOString();
  const h = (hr: number) => new Date(now - hr * 3600000).toISOString();
  const d = (days: number) => new Date(now - days * 86400000).toISOString();

  return [
    {
      id: "v-review-1", type: "review",
      username: "cinephile_jane", tmdbId: 930600, mediaType: "movie",
      title: "Over Your Dead Body", poster: "/z5Ohj6sNRJ8mBEbqrm1DxW2wOZJ.jpg", year: "2026",
      rating: 8, content: "Darkly hilarious. A cabin-in-the-woods setup where both leads are secretly trying to kill each other. The comedic timing is flawless and the third act twist genuinely surprised me.",
      createdAt: h(2),
    },
    {
      id: "v-rated-1", type: "rated",
      username: "moviefan92", tmdbId: 533535, mediaType: "movie",
      title: "Deadpool & Wolverine", poster: "/8cdWjvZQUExUUTzpxoHhVdM2hZc.jpg", year: "2024",
      rating: 9,
      createdAt: h(3),
    },
    {
      id: "v-watched-1", type: "watched",
      username: "series_tracker", tmdbId: 1399, mediaType: "tv",
      title: "Game of Thrones", poster: "/7WUHnWGx40DImiUV9Ceci2Nb1iU.jpg", year: "2011",
      rating: 9,
      createdAt: h(5),
    },
    {
      id: "v-watching-1", type: "watching",
      username: "anime_lover", tmdbId: 95479, mediaType: "tv",
      title: "Jujutsu Kaisen", poster: "/fHpKWz1bfb5OySi4kzR6mghRp5k.jpg", year: "2020",
      createdAt: h(1),
    },
    {
      id: "v-review-2", type: "review",
      username: "film_critic_sam", tmdbId: 845781, mediaType: "movie",
      title: "Red One", poster: "/cdqLnri3GKEGQKU4T8MJsVqFfDr.jpg", year: "2024",
      rating: 6, content: "A fun holiday romp with great chemistry between the leads. Santa as a buff action hero works better than expected.",
      createdAt: h(8),
    },
    {
      id: "v-plan-1", type: "plan_to_watch",
      username: "cinephile_jane", tmdbId: 1084736, mediaType: "movie",
      title: "Masters of the Universe", poster: "/kYK34oXI0gFclOB3Z3ksgz0AKFH.jpg", year: "2026",
      createdAt: h(4),
    },
    {
      id: "v-collection-1", type: "collection",
      username: "moviefan92",
      tmdbId: 0, mediaType: "",
      title: "", poster: null, year: null,
      collectionName: "Best of 2024",
      itemCount: 12,
      createdAt: d(1),
    },
    {
      id: "v-review-3", type: "review",
      username: "anime_lover", tmdbId: 37854, mediaType: "tv",
      title: "One Piece", poster: "/cMD9wCohKGcJHQRzeXFJaoNkUO2.jpg", year: "1999",
      rating: 10, content: "After 1000+ episodes I can confidently say this is the greatest adventure story ever told. The world-building is unmatched.",
      createdAt: d(2),
    },
    {
      id: "v-watching-2", type: "watching",
      username: "series_tracker", tmdbId: 222766, mediaType: "tv",
      title: "The Last of Us", poster: "/uKAKOFBjGvMRBtHVGdMKBslkxj4.jpg", year: "2023",
      createdAt: h(6),
    },
    {
      id: "v-rated-2", type: "rated",
      username: "film_critic_sam", tmdbId: 872585, mediaType: "movie",
      title: "Oppenheimer", poster: "/8Gxv8gSFCU0XGDykEGBEszodOM6.jpg", year: "2023",
      rating: 10,
      createdAt: d(1),
    },
    {
      id: "v-collection-2", type: "collection",
      username: "cinephile_jane",
      tmdbId: 0, mediaType: "",
      title: "", poster: null, year: null,
      collectionName: "Cozy Autumn Watches",
      itemCount: 8,
      createdAt: d(3),
    },
    {
      id: "v-watched-2", type: "watched",
      username: "moviefan92", tmdbId: 693134, mediaType: "movie",
      title: "Dune: Part Two", poster: "/1pdfLQkLwgmmWSNxsFfOq4DiMv2.jpg", year: "2024",
      rating: 9,
      createdAt: d(2),
    },
    {
      id: "v-plan-2", type: "plan_to_watch",
      username: "anime_lover", tmdbId: 130392, mediaType: "tv",
      title: "The Dangers in My Heart", poster: "/sJGRgXKQAeA2L5EJ7IFi5rDgfnE.jpg", year: "2023",
      createdAt: h(12),
    },
    {
      id: "v-review-4", type: "review",
      username: "series_tracker", tmdbId: 94605, mediaType: "tv",
      title: "Arcane", poster: "/fqldf2kBFAT4lH8Yl0Q4KBDJj4I.jpg", year: "2021",
      rating: 10, content: "Visually stunning with a story that hits every emotional beat. Best video game adaptation ever made — and one of the best shows period.",
      createdAt: d(4),
    },
    {
      id: "v-watching-3", type: "watching",
      username: "film_critic_sam", tmdbId: 136315, mediaType: "tv",
      title: "Shōgun", poster: "/8yk1dmeFA88YhNgM33Y4DzEQLVm.jpg", year: "2024",
      createdAt: h(3),
    },
  ];
}

export async function GET(req: NextRequest) {
  const username = await resolveUsername(req);
  if (!username) {
    // Guest — show virtual activities so page isn't empty
    return NextResponse.json({ activities: getVirtualActivities() });
  }

  const userId = await resolveUserId(username);
  if (!userId) {
    return NextResponse.json({ activities: getVirtualActivities() });
  }

  // 1. Get users this person follows
  const { data: follows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  if (!follows?.length) {
    // No follows yet — show virtual activities
    return NextResponse.json({ activities: getVirtualActivities() });
  }

  const followingIds = follows.map((f) => f.following_id);

  // Resolve IDs to usernames
  const { data: followedUsers } = await supabase
    .from("users")
    .select("id, username")
    .in("id", followingIds);

  const idToUsername: Record<string, string> = {};
  for (const u of followedUsers || []) {
    idToUsername[u.id] = u.username;
  }

  const followingUsernames = Object.values(idToUsername);
  if (!followingUsernames.length) {
    return NextResponse.json({ activities: getVirtualActivities() });
  }

  // 2. Get recent reviews from followed users
  const { data: reviews } = await supabase
    .from("reviews")
    .select("username, tmdb_id, media_type, content, rating, created_at")
    .in("username", followingUsernames)
    .order("created_at", { ascending: false })
    .limit(30);

  // 3. Get recent tracking changes from followed users
  const { data: tracking } = await supabase
    .from("media_trackings")
    .select("username, tmdb_id, media_type, status, rating, updated_at")
    .in("username", followingUsernames)
    .order("updated_at", { ascending: false })
    .limit(30);

  // 4. Combine and deduplicate into activity feed
  const activities: Activity[] = [];

  // Reviews
  for (const r of reviews || []) {
    if (r.rating && r.rating >= 5) {
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

  // Collections: published by followed users
  const { data: collections } = await supabase
    .from("user_lists")
    .select("id, user_id, name, published_at")
    .in("user_id", followingIds)
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(20);

  if (collections?.length) {
    const listIds = collections.map((c: any) => c.id);
    const { data: itemCounts } = await supabase
      .from("list_items")
      .select("list_id")
      .in("list_id", listIds);
    const countMap: Record<string, number> = {};
    for (const li of (itemCounts || [])) {
      countMap[li.list_id] = (countMap[li.list_id] || 0) + 1;
    }

    for (const c of collections) {
      const resolvedUsername = idToUsername[c.user_id];
      if (!resolvedUsername) continue;
      activities.push({
        id: `col-${c.id}`,
        type: "collection",
        username: resolvedUsername,
        tmdbId: 0,
        mediaType: "",
        title: "",
        poster: null,
        year: null,
        collectionName: c.name,
        itemCount: countMap[c.id] || 0,
        createdAt: c.published_at,
      });
    }
  }

  // Merge real + virtual
  activities.push(...getVirtualActivities().map(a => ({...a, id: `v-${a.id}`})));

  // Sort by most recent, deduplicate, limit
  activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const seen = new Set<string>();
  const unique = activities.filter((a) => {
    const key = `${a.username}-${a.tmdbId}-${a.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);

  // 5. Enrich with TMDB data in parallel (skip collections and virtual entries with real titles)
  const enriched = await Promise.all(
    unique.map(async (a) => {
      if (a.type === "collection" || a.tmdbId === 0) return a;
      // Virtual entries already have TMDB data
      if (a.id.startsWith("v-") && a.title && a.poster) return a;
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

interface Activity {
  id: string;
  type: "review" | "rated" | "watched" | "watching" | "plan_to_watch" | "collection";
  username: string;
  tmdbId: number;
  mediaType: string;
  title: string;
  poster: string | null;
  year: string | null;
  rating?: number;
  content?: string;
  collectionName?: string;
  itemCount?: number;
  createdAt: string;
}
