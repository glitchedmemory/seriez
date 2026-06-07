import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GENRE_MAP } from "@/lib/tmdb";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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

// ─── Rating description ───
function ratingPersonality(avg: number, count: number): string {
  if (count < 5) return "아직 평가가 적어요. 더 많은 작품에 별점을 남겨보세요!";
  if (avg >= 4.0) return "작품의 장점을 발견하는 눈을 가진 '긍정 리뷰어'";
  if (avg >= 3.5) return "균형 잡힌 시선으로 작품을 바라보는 '조화로운 감상가'";
  if (avg >= 3.0) return "남들보다 진지하고 비판적으로 보는 '지성파'";
  if (avg >= 2.5) return "까다롭지만 공정한 '엄격한 평론가'";
  return "오직 마음에 드는 작품에만 별을 주는 '소울메이트 헌터'";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

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
    const { data: tracking } = await supabase
      .from("media_trackings")
      .select("tmdb_id, media_type, status, rating, progress, watched_at, updated_at")
      .eq("username", userId);

    // ── 3. Fetch all reviews ──
    const { data: reviews } = await supabase
      .from("reviews")
      .select("tmdb_id, media_type, rating")
      .eq("username", username);

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
          ratedMap.set(r.tmdb_id, { rating: r.rating, mediaType: r.media_type });
        }
      }
    }

    // ── 4. Compute basic counts ──
    const watched = (tracking || []).filter(t => t.status === "completed");
    const watching = (tracking || []).filter(t => t.status === "watching");
    const planned = (tracking || []).filter(t => t.status === "plan_to_watch");
    const rated = Array.from(ratedMap.values());
    const reviewedItems = (reviews || []).filter(r => r.rating && r.rating > 0);
    const allRated = [...rated, ...reviewedItems.filter(r => !ratedMap.has(r.tmdb_id)).map(r => ({ rating: r.rating, mediaType: r.media_type }))];

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
      "Action": ["강렬한", "블록버스터", "아드레날린"],
      "Drama": ["감성적인", "몰입감", "연기력"],
      "Comedy": ["웃긴", "유쾌한", "힐링"],
      "Thriller": ["스릴있는", "긴장감", "반전"],
      "Horror": ["공포", "으스스한", "서늘한"],
      "Romance": ["사랑", "로맨틱", "설렘"],
      "Science Fiction": ["SF", "미래적인", "상상력"],
      "Animation": ["애니메이션", "화려한", "색감"],
      "Adventure": ["모험", "스케일", "짜릿한"],
      "Fantasy": ["판타지", "마법같은", "동화적인"],
      "Mystery": ["미스터리", "추리", "복선"],
      "Crime": ["범죄", "어두운", "긴장되는"],
      "Documentary": ["다큐멘터리", "지식", "통찰"],
    };

    for (const genre of topGenreNames) {
      const mapped = genreTagMap[genre] || [genre];
      for (const tag of mapped) {
        if (!tags.includes(tag)) tags.push(tag);
      }
    }
    
    // Additional behavior-based tags
    if (watched.length > 100) tags.push("헤비시청자");
    if (avgRating >= 4.0) tags.push("호평러");
    if (planned.length > watched.length) tags.push("찜러");
    if (watching.length >= 5) tags.push("동시시청러");

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
