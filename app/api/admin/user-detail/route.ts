import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername, STAFF_ROLES } from "@/lib/auth-helper";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const adminUser = await resolveUsername(req);
    if (!adminUser) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { data: adminData } = await supabaseAdmin
      .from("users").select("role").eq("username", adminUser).maybeSingle();
    if (!STAFF_ROLES.includes(adminData?.role || "")) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const target = searchParams.get("username");
    if (!target) return NextResponse.json({ error: "username required" }, { status: 400 });

    // User info (including sanctions)
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("username, role, is_premium, created_at, updated_at, avatar_url, sanction_type, sanction_reason, sanction_until, sanctioned_at, sanctioned_by")
      .eq("username", target)
      .maybeSingle();

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Reviews
    const { data: reviews } = await supabaseAdmin
      .from("reviews")
      .select("id, content, rating, created_at, tmdb_id, media_type, is_hidden")
      .eq("username", target)
      .order("created_at", { ascending: false })
      .limit(50);

    // Tracking (media_trackings)
    const { data: library } = await supabaseAdmin
      .from("media_trackings")
      .select("tmdb_id, media_type, status, rating, season_number, updated_at")
      .eq("username", target)
      .order("updated_at", { ascending: false })
      .limit(50);

    // Comments
    const { data: comments } = await supabaseAdmin
      .from("review_comments")
      .select("id, content, created_at, review_id, is_hidden")
      .eq("username", target)
      .order("created_at", { ascending: false })
      .limit(50);

    // Watched episodes count
    const { count: episodeCount } = await supabaseAdmin
      .from("episode_watches")
      .select("*", { count: "exact", head: true })
      .eq("username", target);

    return NextResponse.json({
      user: { ...user, episode_watch_count: episodeCount || 0 },
      reviews: reviews || [],
      library: library || [],
      comments: comments || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
