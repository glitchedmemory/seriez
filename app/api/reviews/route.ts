import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername } from "@/lib/auth-helper";
import { checkText } from "@/lib/moderation";

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const TO_DB = (r: number) => Math.round(r * 10);
const FROM_DB = (v: number) => v >= 10 ? v / 10 : v;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tmdbId = searchParams.get("tmdbId");
  const mediaType = searchParams.get("mediaType");
  const statsOnly = searchParams.get("stats") === "true";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const offset = (page - 1) * limit;
  const username = await resolveUsername(req);

  if (!tmdbId || !mediaType) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const tmdbIdNum = parseInt(tmdbId);

  if (statsOnly) {
    const [revRes, trackRes] = await Promise.all([
      supabase.from("reviews").select("rating").eq("tmdb_id", tmdbIdNum).eq("media_type", mediaType),
      supabase.from("media_trackings").select("rating").eq("tmdb_id", tmdbIdNum).eq("media_type", mediaType).eq("status", "completed").not("rating", "is", null),
    ]);
    if (revRes.error) return NextResponse.json({ error: revRes.error.message }, { status: 500 });
    if (trackRes.error) return NextResponse.json({ error: trackRes.error.message }, { status: 500 });
    const distribution: Record<number, number> = {};
    for (let i = 1; i <= 10; i++) distribution[i / 2] = 0;
    let total = 0, sum = 0;
    const allRatings = [...revRes.data.map((r: any) => FROM_DB(r.rating)), ...trackRes.data.map((t: any) => t.rating as number)];
    for (const realRating of allRatings) {
      const bucket = Math.round(realRating * 2) / 2;
      if (bucket >= 0.5 && bucket <= 5.0) { distribution[bucket]++; total++; sum += realRating; }
    }
    return NextResponse.json({ average: total > 0 ? Math.round((sum / total) * 10) / 10 : 0, total, distribution });
  }

  // Check if current user is admin
  let isAdmin = false;
  if (username?.trim()) {
    const { data: userData } = await supabaseAdmin
      .from("users").select("role").eq("username", username.trim()).maybeSingle();
    isAdmin = userData?.role === "admin";
  }

  // Count total (filtering hidden for non-admins)
  let totalQuery = supabase.from("reviews").select("id", { count: "exact", head: true })
    .eq("tmdb_id", tmdbIdNum).eq("media_type", mediaType);
  if (!isAdmin) totalQuery = totalQuery.eq("is_hidden", false);
  const { count: totalCount } = await totalQuery;
  const total = totalCount || 0;

  // Fetch all reviews (sort in memory: top 2 by likes pinned, rest by created_at)
  let query = supabase
    .from("reviews")
    .select("id, username, content, rating, likes_count, is_hidden, created_at")
    .eq("tmdb_id", tmdbIdNum).eq("media_type", mediaType);
  if (!isAdmin) query = query.eq("is_hidden", false);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sort: top 2 by likes_count DESC pinned, rest by created_at DESC
  const all = data || [];
  const sortedByLikes = [...all].sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
  const pinnedIds = new Set(sortedByLikes.slice(0, 2).map(r => r.id));
  const sorted = [...all].sort((a, b) => {
    const aPinned = pinnedIds.has(a.id);
    const bPinned = pinnedIds.has(b.id);
    if (aPinned && bPinned) return (b.likes_count || 0) - (a.likes_count || 0);
    if (aPinned) return -1;
    if (bPinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Paginate in memory
  const visible = sorted.slice(offset, offset + limit);

  let likedSet = new Set<string>();
  if (username?.trim()) {
    const { data: likes } = await supabaseAdmin
      .from("review_likes").select("review_id").eq("username", username.trim());
    if (likes) likedSet = new Set(likes.map((l: any) => l.review_id));
  }

  // Fetch comment counts for visible reviews
  const reviewIds = visible.map((r: any) => r.id);
  let commentCounts: Record<string, number> = {};
  if (reviewIds.length > 0) {
    const { data: counts } = await supabase
      .from("review_comments")
      .select("review_id, id")
      .in("review_id", reviewIds);
    if (counts) {
      for (const c of counts) {
        const rid = c.review_id as string;
        commentCounts[rid] = (commentCounts[rid] || 0) + 1;
      }
    }
  }

  // Fetch premium status for visible reviewers
  const reviewerNames = [...new Set(visible.map((r: any) => r.username))];
  let premiumSet = new Set<string>();
  if (reviewerNames.length > 0) {
    const { data: premiumUsers } = await supabase
      .from("users").select("username").eq("is_premium", true).in("username", reviewerNames);
    if (premiumUsers) premiumSet = new Set(premiumUsers.map((u: any) => u.username));
  }

  return NextResponse.json({
    reviews: visible.map((r) => ({
      id: r.id, username: r.username || "Anonymous", content: r.content,
      rating: FROM_DB(r.rating || 0), likes: r.likes_count || 0, liked: likedSet.has(r.id),
      isHidden: r.is_hidden || false, commentCount: commentCounts[r.id] || 0,
      isPremium: premiumSet.has(r.username), createdAt: r.created_at,
    })),
    total,
    page,
    limit,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tmdbId, mediaType, content, rating, username: bodyUsername } = body;

    // Try Supabase session first, fall back to body param
    let username = await resolveUsername(req);
    if (!username && bodyUsername) username = bodyUsername;
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (!tmdbId || !mediaType || !content?.trim()) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    }
    let dbRating = 0;
    if (rating !== undefined && rating !== null) {
      if (typeof rating !== "number" || rating < 0.5 || rating > 5 || (rating * 2) % 1 !== 0) {
        return NextResponse.json({ error: "Rating must be 0.5–5 in 0.5 steps" }, { status: 400 });
      }
      dbRating = TO_DB(rating);
    }

    // Content moderation
    const modResult = await checkText(content.trim());
    if (!modResult.safe) {
      return NextResponse.json({ error: modResult.reason || "Content rejected" }, { status: 422 });
    }

    const user = username.trim().slice(0, 20);
    const trimmed = content.trim().slice(0, 2000);

    // ─── Protection 4: New account restriction ───
    try {
      const { data: userData } = await supabaseAdmin
        .from("users").select("created_at").eq("username", user).maybeSingle();
      if (userData?.created_at) {
        const hoursSince = (Date.now() - new Date(userData.created_at).getTime()) / 3600000;
        if (hoursSince < 1) {
          const count = await getRecentCount("review", user, 60);
          if (count >= 2) return NextResponse.json({ error: "New accounts are limited to 2 reviews per hour" }, { status: 429 });
        } else if (hoursSince < 24) {
          const count = await getRecentCount("review", user, 1440);
          if (count >= 5) return NextResponse.json({ error: "New accounts are limited to 5 reviews per day" }, { status: 429 });
        }
      }
    } catch { /* non-blocking */ }

    // ─── Protection 1: Rate limiting ───
    try {
      const recentCount = await getRecentCount("review", user, 60); // last 60 min
      if (recentCount >= 5) {
        return NextResponse.json({ error: "Too many reviews. Please wait before posting another." }, { status: 429 });
      }
    } catch { /* non-blocking — rate_log table might not exist yet */ }

    // ─── Protection 5: Duplicate content detection ───
    try {
      const normalized = trimmed.toLowerCase().slice(0, 100);
      const { data: recent } = await supabaseAdmin
        .from("reviews")
        .select("content")
        .eq("username", user)
        .gte("created_at", new Date(Date.now() - 3600000).toISOString())
        .limit(10);
      if (recent?.length) {
        const dup = recent.some(r => r.content.toLowerCase().startsWith(normalized));
        if (dup) return NextResponse.json({ error: "You already posted similar content recently" }, { status: 429 });
      }
    } catch { /* non-blocking */ }

    const { data, error } = await supabaseAdmin
      .from("reviews").insert({ tmdb_id: tmdbId, media_type: mediaType, username: user, content: trimmed, rating: dbRating })
      .select("id, username, content, rating, likes_count, created_at").single();

    if (error) {
      // Protection 2: UNIQUE constraint violation → friendly message
      if (error.code === "23505") {
        return NextResponse.json({ error: "You've already reviewed this title" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log to rate_log (best-effort)
    try {
      const crypto = await import("crypto");
      const contentHash = crypto.createHash("sha256").update(trimmed.toLowerCase()).digest("hex").slice(0, 16);
      await supabaseAdmin.from("rate_log").insert({ username: user, action: "review", content_hash: contentHash });
    } catch { /* non-blocking — rate_log table might not exist yet */ }

    return NextResponse.json({ id: data.id, username: data.username, content: data.content, rating: FROM_DB(data.rating), likes: data.likes_count || 0, liked: false, createdAt: data.created_at }, { status: 201 });
  } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
}

// Helper: count recent actions by user
async function getRecentCount(action: string, username: string, minutes: number): Promise<number> {
  try {
    const { count } = await supabaseAdmin
      .from("rate_log")
      .select("*", { count: "exact", head: true })
      .eq("username", username)
      .eq("action", action)
      .gte("created_at", new Date(Date.now() - minutes * 60 * 1000).toISOString());
    return count || 0;
  } catch {
    // Fallback: count directly from reviews table
    try {
      const { count } = await supabaseAdmin
        .from("reviews")
        .select("*", { count: "exact", head: true })
        .eq("username", username)
        .gte("created_at", new Date(Date.now() - minutes * 60 * 1000).toISOString());
      return count || 0;
    } catch {
      return 0;
    }
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const reviewId = searchParams.get("reviewId");
    if (!reviewId) {
      return NextResponse.json({ error: "Missing reviewId" }, { status: 400 });
    }

    const user = username.trim();

    // Check admin
    const { data: userData } = await supabaseAdmin
      .from("users").select("role").eq("username", user).maybeSingle();
    const isAdmin = userData?.role === "admin";

    // Get the review to check ownership
    const { data: review } = await supabaseAdmin
      .from("reviews").select("username").eq("id", reviewId).maybeSingle();

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Only author or admin can delete
    if (review.username !== user && !isAdmin) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Delete associated likes + comments first
    await supabaseAdmin.from("review_likes").delete().eq("review_id", reviewId);
    await supabaseAdmin.from("review_comments").delete().eq("review_id", reviewId);
    const { error } = await supabaseAdmin.from("reviews").delete().eq("id", reviewId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
}

export async function PATCH(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { reviewId, action } = body;
    if (!reviewId) {
      return NextResponse.json({ error: "Missing reviewId or username" }, { status: 400 });
    }
    const user = username.trim();

    if (action === "like") {
      const { data: existing } = await supabaseAdmin.from("review_likes").select("review_id").eq("review_id", reviewId).eq("username", user);
      if (existing && existing.length > 0) {
        return NextResponse.json({ error: "Already liked" }, { status: 409 });
      }
      const { error: insertErr } = await supabaseAdmin.from("review_likes").insert({ review_id: reviewId, username: user });
      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

      const { data: cur } = await supabaseAdmin.from("reviews").select("likes_count").eq("id", reviewId);
      const newCount = (cur?.[0]?.likes_count || 0) + 1;
      await supabaseAdmin.from("reviews").update({ likes_count: newCount }).eq("id", reviewId);
      return NextResponse.json({ likes: newCount, liked: true });
    }

    if (action === "unlike") {
      const { error: deleteErr } = await supabaseAdmin.from("review_likes").delete().eq("review_id", reviewId).eq("username", user);
      if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

      const { data: cur } = await supabaseAdmin.from("reviews").select("likes_count").eq("id", reviewId);
      const newCount = Math.max(0, (cur?.[0]?.likes_count || 0) - 1);
      await supabaseAdmin.from("reviews").update({ likes_count: newCount }).eq("id", reviewId);
      return NextResponse.json({ likes: newCount, liked: false });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
}
