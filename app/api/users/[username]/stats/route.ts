import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GENRE_MAP } from "@/lib/tmdb";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";

// ─── TMDB helpers for detailed genre data ───
async function tmdbGet(endpoint: string) {
  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

// ─── AniList helpers ───
const ANILIST_API = "https://graphql.anilist.co";

// ─── Rating conversion (DB stores mixed scales: ×10 int or 0–10 int) ───
const FROM_DB = (v: number) => v > 10 ? v / 10 : v > 5 ? v / 2 : v;

// ─── Rating description ───
function ratingPersonality(avg: number, count: number): string {
  if (count < 5) return "Not enough ratings yet. Rate more titles to reveal your taste!";
  if (avg >= 4.0) return "A 'Positive Reviewer' with an eye for great storytelling";
  if (avg >= 3.5) return "A 'Balanced Viewer' who sees the best in every genre";
  if (avg >= 3.0) return "A 'Thoughtful Critic' who watches with depth and sincerity";
  if (avg >= 2.5) return "A 'Strict Judge' — tough but fair";
  return "A 'Soulmate Hunter' who saves their stars for true favorites";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const { searchParams } = new URL(req.url);
  const mediaType = searchParams.get("mediaType"); // movie | tv | anime | null

  try {
    // ── 1. Get user_id ──
    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .single();

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = userData.id;

    // ── 2. Fetch all tracking data ──
    let trackingQuery = supabaseAdmin
      .from("media_trackings")
      .select("tmdb_id, media_type, status, rating, progress, watched_at, updated_at")
      .eq("username", userId);
    if (mediaType) trackingQuery = trackingQuery.eq("media_type", mediaType);
    const { data: tracking } = await trackingQuery;

    // ── 3. Fetch all reviews ──
    let reviewsQuery = supabase
      .from("reviews")
      .select("tmdb_id, media_type, rating")
      .eq("username", username);
    if (mediaType) reviewsQuery = reviewsQuery.eq("media_type", mediaType);
    const { data: reviews } = await reviewsQuery;

    // ── Merge tracking + reviews for rated items ──
    const ratedMap = new Map<number, { rating: number; mediaType: string }>();
    
    if (tracking) {
      for (const t of tracking) {
        if (t.rating && t.rating > 0) {
          ratedMap.set(t.tmdb_id, { rating: t.rating, mediaType: t.media_type });
        }
      }
    }
    if (reviews) {
      for (const r of reviews) {
        if (!ratedMap.has(r.tmdb_id) && r.rating && r.rating > 0) {
          ratedMap.set(r.tmdb_id, { rating: FROM_DB(r.rating), mediaType: r.media_type });
        }
      }
    }

    // ── 4. Compute basic counts ──
    const watched = (tracking || []).filter(t => t.status === "completed");
    const watching = (tracking || []).filter(t => t.status === "watching");
    const planned = (tracking || []).filter(t => t.status === "plan_to_watch");
    const rated = Array.from(ratedMap.values());
    const reviewedItems = (reviews || []).filter(r => r.rating && r.rating > 0);
    const allRated = [...rated, ...reviewedItems.filter(r => !ratedMap.has(r.tmdb_id)).map(r => ({ rating: FROM_DB(r.rating), mediaType: r.media_type }))];

    // Rating distribution
    const ratingBuckets: Record<string, number> = {};
    for (let i = 5; i >= 0.5; i -= 0.5) {
      ratingBuckets[i.toFixed(1)] = 0;
    }
    for (const r of allRated) {
      const key = r.rating.toFixed(1);
      if (ratingBuckets[key] !== undefined) ratingBuckets[key]++;
    }

    const avgRating = allRated.length > 0
      ? Math.round((allRated.reduce((s, r) => s + r.rating, 0) / allRated.length) * 10) / 10
      : 0;

    const mostGivenRating = Object.entries(ratingBuckets).sort((a, b) => b[1] - a[1])[0]?.[0] || "0";

    // Media type breakdown
    const mediaBreakdown: Record<string, number> = { movie: 0, tv: 0, anime: 0 };
    for (const t of tracking || []) {
      if (mediaBreakdown[t.media_type] !== undefined) mediaBreakdown[t.media_type]++;
      else if (t.media_type === "anime") mediaBreakdown.anime++;
    }

    // ── 5. Genre distribution ──
    // Collect all unique tmdb_ids and fetch genres in batches
    const genreCounts: Record<string, number> = {};
    const processedIds = new Set<number>();
    const animeIds: number[] = [];

    for (const t of tracking || []) {
      if (processedIds.has(t.tmdb_id)) continue;
      processedIds.add(t.tmdb_id);

      if (t.media_type === "anime") {
        animeIds.push(t.tmdb_id);
        continue;
      }

      try {
        const ep = t.media_type === "movie" ? `/movie/${t.tmdb_id}` : `/tv/${t.tmdb_id}`;
        const detail = await tmdbGet(ep);
        for (const g of detail.genres || []) {
          const name = g.name;
          genreCounts[name] = (genreCounts[name] || 0) + 1;
        }
      } catch { /* skip */ }
    }

    // Anime genres from AniList (batch)
    if (animeIds.length > 0) {
      for (const anilistId of animeIds.slice(0, 30)) {
        try {
          const res = await fetch(ANILIST_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `query($id:Int){Media(id:$id){genres}}`,
              variables: { id: anilistId },
            }),
          });
          const json = await res.json();
          for (const g of json.data?.Media?.genres || []) {
            genreCounts[g] = (genreCounts[g] || 0) + 1;
          }
        } catch { /* skip */ }
      }
    }

    const topGenres = Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // ── 6. Top actors/directors (from projects rated > 0) ──
    const actorCounts: Record<string, number> = {};
    const directorCounts: Record<string, number> = {};
    const ratedTmdbIds = [...new Set(allRated.map(r => {
      const track = tracking?.find(t => t.tmdb_id && t.rating === r.rating);
      return track?.tmdb_id;
    }).filter(Boolean))];

    for (const tmdbId of ratedTmdbIds.slice(0, 20)) {
      try {
        const track = tracking?.find(t => t.tmdb_id === tmdbId);
        const mt = track?.media_type || "movie";
        if (mt === "anime") continue;
        const ep = mt === "movie" ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
        
        // Get credits
        const credits = await tmdbGet(`/${mt}/${tmdbId}/credits`);
        for (const cast of (credits.cast || []).slice(0, 10)) {
          actorCounts[cast.name] = (actorCounts[cast.name] || 0) + 1;
        }
        for (const crew of (credits.crew || []).filter((c: any) => c.job === "Director")) {
          directorCounts[crew.name] = (directorCounts[crew.name] || 0) + 1;
        }
      } catch { /* skip */ }
    }

    const topActors = Object.entries(actorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    const topDirectors = Object.entries(directorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // ── 7. Watch time estimate (movie ~2h, tv episode ~45min, anime episode ~24min) ──
    let totalMinutes = 0;
    for (const t of watched) {
      if (t.media_type === "movie") totalMinutes += 120;
      else if (t.media_type === "anime") totalMinutes += (t.progress || 12) * 24;
      else totalMinutes += (t.progress || 10) * 45; // TV - use progress as episode count
    }
    const totalHours = Math.round(totalMinutes / 60);

    // ── 8. Monthly watch heatmap (last 12 months) ──
    const monthlyWatch: Record<string, number> = {};
    for (const t of watched) {
      const date = t.watched_at ? new Date(t.watched_at) : (t.updated_at ? new Date(t.updated_at) : null);
      if (date) {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        monthlyWatch[key] = (monthlyWatch[key] || 0) + 1;
      }
    }

    // ── 9. Tag extraction ──
    const tags: string[] = [];
    const topGenreNames = topGenres.slice(0, 5).map(g => g.name);
    
    // Genre-based tags
    const genreTagMap: Record<string, string[]> = {
      "Action": ["Intense", "Blockbuster", "Adrenaline"],
      "Drama": ["Emotional", "Immersive", "Powerful Performances"],
      "Comedy": ["Funny", "Lighthearted", "Feel-Good"],
      "Thriller": ["Thrilling", "Suspenseful", "Twists"],
      "Horror": ["Scary", "Creepy", "Chilling"],
      "Romance": ["Romantic", "Heartfelt", "Sweet"],
      "Science Fiction": ["Sci-Fi", "Futuristic", "Imaginative"],
      "Animation": ["Animated", "Colorful", "Vibrant"],
      "Adventure": ["Adventurous", "Epic", "Exciting"],
      "Fantasy": ["Fantasy", "Magical", "Whimsical"],
      "Mystery": ["Mysterious", "Investigative", "Intriguing"],
      "Crime": ["Gritty", "Dark", "Tense"],
      "Documentary": ["Documentary", "Insightful", "Informative"],
    };

    for (const genre of topGenreNames) {
      const mapped = genreTagMap[genre] || [genre];
      for (const tag of mapped) {
        if (!tags.includes(tag)) tags.push(tag);
      }
    }
    
    // Additional behavior-based tags
    if (watched.length > 100) tags.push("Binge Watcher");
    if (avgRating >= 4.0) tags.push("High Rater");
    if (planned.length > watched.length) tags.push("Collector");
    if (watching.length >= 5) tags.push("Multi-Watcher");

    const slicedTags = tags.slice(0, 12);

    // ── 10. Personality line ──
    const personality = ratingPersonality(avgRating, allRated.length);

    return NextResponse.json({
      totals: {
        watched: watched.length,
        watching: watching.length,
        planned: planned.length,
        rated: allRated.length,
        reviewed: reviewedItems.length,
        hours: totalHours,
      },
      rating: {
        average: avgRating,
        mostGiven: parseFloat(mostGivenRating),
        distribution: Object.entries(ratingBuckets).map(([score, count]) => ({
          score: parseFloat(score),
          count,
        })),
        personality,
      },
      mediaBreakdown,
      genres: topGenres,
      tags: slicedTags,
      topActors,
      topDirectors,
      monthlyWatch: Object.entries(monthlyWatch)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count })),
    });
  } catch (err: any) {
    console.error("Stats error:", err);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
