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
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── GET: fetch comments for a review ───
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reviewId = searchParams.get("review_id");
  const tmdbId = searchParams.get("tmdb_id");

  if (!reviewId && !tmdbId) {
    return NextResponse.json({ error: "review_id or tmdb_id required" }, { status: 400 });
  }

  try {
    let query = supabase.from("review_comments").select("*").order("created_at", { ascending: true });

    if (reviewId) {
      query = query.eq("review_id", reviewId);
    }
    // Note: to get all comments by tmdb_id, we'd need a join; for now use review_id

    const { data, error } = await query;
    if (error) throw error;

    // Check if current user is admin
    const username = await resolveUsername(req);
    let isAdmin = false;
    if (username?.trim()) {
      try {
        const { data: userData } = await supabaseAdmin
          .from("users").select("role").eq("username", username.trim()).maybeSingle();
        isAdmin = userData?.role === "admin";
      } catch {}
    }

    // Filter out hidden comments for non-admins
    const visible = isAdmin ? (data || []) : (data || []).filter((c: any) => !c.is_hidden);

    // Check which comments the current user has liked
    let likedSet = new Set<number>();
    if (username?.trim()) {
      const { data: likes } = await supabaseAdmin
        .from("comment_likes").select("comment_id").eq("username", username.trim());
      if (likes) likedSet = new Set(likes.map((l: any) => l.comment_id));
    }

    // Fetch premium status for commenters
    const commenterNames = [...new Set((data || []).map((c: any) => c.username))];
    let premiumSet = new Set<string>();
    if (commenterNames.length > 0) {
      const { data: premiumUsers } = await supabaseAdmin
        .from("users").select("username").eq("is_premium", true).in("username", commenterNames);
      if (premiumUsers) premiumSet = new Set(premiumUsers.map((u: any) => u.username));
    }

    const enriched = visible.map((c: any) => ({
      ...c,
      likes: c.likes_count || 0,
      liked: likedSet.has(c.id),
      isPremium: premiumSet.has(c.username),
    }));

    return NextResponse.json(enriched);
  } catch (err: any) {
    // Table might not exist yet
    if (err?.message?.includes("does not exist")) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: err?.message || "Failed to fetch" }, { status: 500 });
  }
}

// ─── POST: add a comment + notify review author ───
export async function POST(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { review_id, content, parent_id, tmdb_id, title_name, review_author } = body;

    if (!review_id || !content?.trim()) {
      return NextResponse.json({ error: "review_id and content required" }, { status: 400 });
    }

    const trimmed = content.trim();
    if (trimmed.length > 1000) {
      return NextResponse.json({ error: "Comment too long (max 1000 chars)" }, { status: 400 });
    }

    // Content moderation
    const modResult = await checkText(trimmed);
    if (!modResult.safe) {
      return NextResponse.json({ error: modResult.reason || "Content rejected" }, { status: 422 });
    }

    // Insert comment
    const insertData: any = {
      review_id,
      username: username.trim().slice(0, 20),
      content: trimmed,
    };
    if (parent_id != null) insertData.parent_id = parent_id;

    const { data: comment, error } = await supabaseAdmin
      .from("review_comments")
      .insert(insertData)
      .select("*")
      .single();

    if (error) {
      if (error.message.includes("does not exist")) {
        return NextResponse.json(
          { error: "Comments not available yet. Run the database migration first." },
          { status: 503 }
        );
      }
      throw error;
    }

    // Create notification for the review author (unless self-comment)
    if (review_author && review_author !== username) {
      try {
        await supabaseAdmin.from("notifications").insert({
          type: "comment",
          actor_username: username.trim().slice(0, 20),
          target_username: review_author,
          review_id,
          tmdb_id: tmdb_id || 0,
          title_name: title_name || "",
          read: false,
        });
      } catch {
        // Notification failure shouldn't block comment creation
      }
    }

    return NextResponse.json(comment);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create comment" }, { status: 500 });
  }
}

// ─── PATCH: like / unlike a comment ───
// ─── DELETE: delete a comment (author or admin) ───
export async function DELETE(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("commentId");
    if (!commentId) {
      return NextResponse.json({ error: "Missing commentId" }, { status: 400 });
    }

    const user = username.trim();

    // Check admin
    const { data: userData } = await supabaseAdmin
      .from("users").select("role").eq("username", user).maybeSingle();
    const isAdmin = userData?.role === "admin";

    // Get comment
    const { data: comment } = await supabaseAdmin
      .from("review_comments").select("username").eq("id", commentId).maybeSingle();

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (comment.username !== user && !isAdmin) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Delete likes + child comments
    await supabaseAdmin.from("comment_likes").delete().eq("comment_id", commentId);
    await supabaseAdmin.from("review_comments").delete().eq("parent_id", commentId);
    const { error } = await supabaseAdmin.from("review_comments").delete().eq("id", commentId);

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
    const { commentId, action } = body; // action: "like" | "unlike"

    if (!commentId || !action) {
      return NextResponse.json({ error: "commentId and action required" }, { status: 400 });
    }

    const user = username.trim();

    if (action === "like") {
      // Check duplicate
      const { data: existing } = await supabaseAdmin
        .from("comment_likes").select("comment_id")
        .eq("comment_id", commentId).eq("username", user);
      if (existing && existing.length > 0) {
        return NextResponse.json({ error: "Already liked" }, { status: 409 });
      }

      const { error: insertErr } = await supabaseAdmin
        .from("comment_likes").insert({ comment_id: commentId, username: user });
      if (insertErr) throw insertErr;

      const { data: cur } = await supabaseAdmin
        .from("review_comments").select("likes_count").eq("id", commentId);
      const newCount = (cur?.[0]?.likes_count || 0) + 1;
      await supabaseAdmin.from("review_comments").update({ likes_count: newCount }).eq("id", commentId);

      return NextResponse.json({ likes: newCount, liked: true });
    }

    if (action === "unlike") {
      const { error: deleteErr } = await supabaseAdmin
        .from("comment_likes").delete()
        .eq("comment_id", commentId).eq("username", user);
      if (deleteErr) throw deleteErr;

      const { data: cur } = await supabaseAdmin
        .from("review_comments").select("likes_count").eq("id", commentId);
      const newCount = Math.max(0, (cur?.[0]?.likes_count || 0) - 1);
      await supabaseAdmin.from("review_comments").update({ likes_count: newCount }).eq("id", commentId);

      return NextResponse.json({ likes: newCount, liked: false });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}
