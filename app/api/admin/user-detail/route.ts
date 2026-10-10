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
      .select("id, username, role, is_premium, created_at, updated_at, avatar_url, sanction_type, sanction_reason, sanction_until, sanctioned_at, sanctioned_by")
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

    // Tracking (media_trackings) — the column stores the user's UUID (users.id),
    // not the username string, so resolve the id first. Every row carries its
    // work type, so anime / TV / movies are kept separate.
    const { data: library } = await supabaseAdmin
      .from("media_trackings")
      .select("tmdb_id, media_type, status, rating, season_number, updated_at, title")
      .eq("username", user.id)
      .order("updated_at", { ascending: false })
      .limit(500);

    const libRows = library || [];
    const libraryCounts = {
      anime: libRows.filter((r: any) => r.media_type === "anime").length,
      tv: libRows.filter((r: any) => r.media_type === "tv").length,
      movie: libRows.filter((r: any) => r.media_type === "movie").length,
      total: libRows.length,
    };

    const titleByKey: Record<string, string> = {};
    for (const r of libRows) {
      if (r.title) titleByKey[`${r.tmdb_id}|${r.media_type}`] = r.title;
    }

    // Comments
    const { data: comments } = await supabaseAdmin
      .from("review_comments")
      .select("id, content, created_at, review_id, is_hidden")
      .eq("username", target)
      .order("created_at", { ascending: false })
      .limit(50);

    // Watched episodes — the column stores the user's UUID, and every record
    // carries its work type, so count and list them per type.
    const [animeEpisodes, tvEpisodes, recentEpisodes] = await Promise.all([
      supabaseAdmin.from("episode_watches").select("*", { count: "exact", head: true })
        .eq("username", user.id).eq("media_type", "anime"),
      supabaseAdmin.from("episode_watches").select("*", { count: "exact", head: true })
        .eq("username", user.id).eq("media_type", "tv"),
      supabaseAdmin.from("episode_watches")
        .select("tmdb_id, media_type, season_number, episode_number, watched_at")
        .eq("username", user.id)
        .order("watched_at", { ascending: false })
        .limit(50),
    ]);

    const episodeCounts = {
      anime: animeEpisodes.count || 0,
      tv: tvEpisodes.count || 0,
      total: (animeEpisodes.count || 0) + (tvEpisodes.count || 0),
    };

    const episodes = (recentEpisodes.data || []).map((e: any) => ({
      ...e,
      title: titleByKey[`${e.tmdb_id}|${e.media_type}`] || `#${e.tmdb_id}`,
    }));

    return NextResponse.json({
      user: { ...user, episode_watch_count: episodeCounts.total },
      reviews: reviews || [],
      library: libRows,
      library_counts: libraryCounts,
      episodes,
      episode_watch_counts: episodeCounts,
      comments: comments || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
