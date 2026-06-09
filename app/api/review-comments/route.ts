import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername } from "@/lib/auth-helper";

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

    return NextResponse.json(visible);
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
