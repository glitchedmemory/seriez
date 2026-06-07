import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId } from "@/lib/user-utils";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── GET: fetch watched episodes for a show ───
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = await resolveUsername(req);
  const tmdbId = searchParams.get("tmdbId");

  if (!username || !tmdbId) {
    return NextResponse.json({ error: "Missing username or tmdbId" }, { status: 400 });
  }

  const userId = await resolveUserId(username);
  if (!userId) {
    return NextResponse.json({ episodes: [] });
  }

  const { data, error } = await supabase
    .from("episode_watches")
    .select("season_number, episode_number")
    .eq("username", userId)
    .eq("tmdb_id", parseInt(tmdbId))
    .order("season_number", { ascending: true })
    .order("episode_number", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    episodes: (data || []).map((e) => ({
      seasonNumber: e.season_number,
      episodeNumber: e.episode_number,
    })),
    totalWatched: (data || []).length,
  });
}

// ─── POST: toggle episode watch ───
export async function POST(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { tmdbId, seasonNumber, episodeNumber } = body;

    if (tmdbId == null || seasonNumber == null || episodeNumber == null) {
      return NextResponse.json(
        { error: "Missing required fields: username, tmdbId, seasonNumber, episodeNumber" },
        { status: 400 }
      );
    }

    const userId = await resolveUserId(username);
    if (!userId) {
      return NextResponse.json({ error: "Failed to resolve user" }, { status: 500 });
    }

    // Check if already watched
    const { data: existing } = await supabase
      .from("episode_watches")
      .select("id")
      .eq("username", userId)
      .eq("tmdb_id", tmdbId)
      .eq("season_number", seasonNumber)
      .eq("episode_number", episodeNumber)
      .maybeSingle();

    if (existing) {
      // Already watched → unwatch (delete)
      const { error: delErr } = await supabase
        .from("episode_watches")
        .delete()
        .eq("id", existing.id);

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }

      return NextResponse.json({ action: "unwatched", seasonNumber, episodeNumber });
    }

    // Not watched → watch (insert)
    const { error: insErr } = await supabase
      .from("episode_watches")
      .insert({
        username: userId,
        tmdb_id: tmdbId,
        season_number: seasonNumber,
        episode_number: episodeNumber,
      });

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // Update progress count on media_trackings
    const { count } = await supabase
      .from("episode_watches")
      .select("id", { count: "exact", head: true })
      .eq("username", userId)
      .eq("tmdb_id", tmdbId);

    const progress = count ?? null;

    // Auto-set tracking status to "watching" if not already tracking
    const { data: trackData } = await supabase
      .from("media_trackings")
      .select("status")
      .eq("username", userId)
      .eq("tmdb_id", tmdbId)
      .eq("media_type", "tv")
      .maybeSingle();

    if (!trackData) {
      // No tracking yet → create with "watching" status
      await supabase
        .from("media_trackings")
        .upsert(
          {
            username: userId,
            tmdb_id: tmdbId,
            media_type: "tv",
            status: "watching",
            progress,
          },
          { onConflict: "username,tmdb_id,media_type" }
        );
    } else {
      // Update progress only
      await supabase
        .from("media_trackings")
        .update({ progress })
        .eq("username", userId)
        .eq("tmdb_id", tmdbId)
        .eq("media_type", "tv");
    }

    return NextResponse.json({ action: "watched", seasonNumber, episodeNumber, progress });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
