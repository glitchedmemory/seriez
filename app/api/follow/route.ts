import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId } from "@/lib/user-utils";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── GET: list followers or following ───
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username") || (await resolveUsername(req));
  const type = searchParams.get("type"); // "followers" or "following"

  if (!username?.trim()) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  const userId = await resolveUserId(username);
  if (!userId) {
    return NextResponse.json({ users: [], count: 0 });
  }

  if (type === "followers") {
    // Users who follow this user
    const { data, error, count } = await supabase
      .from("follows")
      .select("follower_id, created_at", { count: "exact" })
      .eq("following_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Resolve usernames from follower IDs
    const users = await Promise.all(
      (data || []).map(async (f) => {
        const { data: u } = await supabase
          .from("users")
          .select("username")
          .eq("id", f.follower_id)
          .maybeSingle();
        return { username: u?.username || "unknown", since: f.created_at };
      })
    );

    return NextResponse.json({ users, count: count || 0 });
  }

  if (type === "following") {
    // Users this user follows
    const { data, error, count } = await supabase
      .from("follows")
      .select("following_id, created_at", { count: "exact" })
      .eq("follower_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const users = await Promise.all(
      (data || []).map(async (f) => {
        const { data: u } = await supabase
          .from("users")
          .select("username")
          .eq("id", f.following_id)
          .maybeSingle();
        return { username: u?.username || "unknown", since: f.created_at };
      })
    );

    return NextResponse.json({ users, count: count || 0 });
  }

  // Default: check if current user follows target, return relationship status
  if (!type) {
    const targetUsername = searchParams.get("target");
    if (!targetUsername) {
      return NextResponse.json({ error: "Specify type or target" }, { status: 400 });
    }

    const currentUser = await resolveUsername(req);
    if (!currentUser) {
      return NextResponse.json({ following: false });
    }

    const currentUserId = await resolveUserId(currentUser);
    const targetUserId = await resolveUserId(targetUsername);
    if (!currentUserId || !targetUserId) {
      return NextResponse.json({ following: false });
    }

    const { data } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", currentUserId)
      .eq("following_id", targetUserId)
      .maybeSingle();

    return NextResponse.json({ following: !!data });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

// ─── POST: follow a user ───
export async function POST(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { followingUsername } = body;
    if (!followingUsername?.trim()) {
      return NextResponse.json({ error: "Missing followingUsername" }, { status: 400 });
    }

    const followerId = await resolveUserId(username);
    const followingId = await resolveUserId(followingUsername);
    if (!followerId || !followingId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (followerId === followingId) {
      return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
    }

    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: followerId, following_id: followingId });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Already following" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// ─── DELETE: unfollow a user ───
export async function DELETE(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { followingUsername } = body;
    if (!followingUsername?.trim()) {
      return NextResponse.json({ error: "Missing followingUsername" }, { status: 400 });
    }

    const followerId = await resolveUserId(username);
    const followingId = await resolveUserId(followingUsername);
    if (!followerId || !followingId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", followerId)
      .eq("following_id", followingId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
