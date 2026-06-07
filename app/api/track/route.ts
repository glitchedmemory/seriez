import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId } from "@/lib/user-utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const VALID_STATUSES = ["watching", "completed", "plan_to_watch", "on_hold", "dropped"];

import { resolveUsername } from "@/lib/auth-helper";

// ─── GET: fetch tracking list ───
export async function GET(req: NextRequest) {
  const username = await resolveUsername(req);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  if (!username) {
    return NextResponse.json({ error: "Missing username" }, { status: 400 });
  }

  const userId = await resolveUserId(username);
  if (!userId) {
    return NextResponse.json([]);
  }

  let query = supabase
    .from("media_trackings")
    .select("*")
    .eq("username", userId)
    .order("updated_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    (data || []).map((t) => ({
      id: t.id,
      username,
      userId: t.username,
      tmdbId: t.tmdb_id,
      anilistId: t.anilist_id,
      mediaType: t.media_type,
      status: t.status,
      rating: t.rating,
      progress: t.progress,
      updatedAt: t.updated_at,
    }))
  );
}

// ─── POST: upsert tracking ───
export async function POST(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { tmdbId, mediaType, status, rating, progress } = body;

    if (tmdbId == null || !mediaType || !status) {
      return NextResponse.json(
        { error: "Missing required fields: tmdbId, mediaType, status" },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const userId = await resolveUserId(username);
    if (!userId) {
      return NextResponse.json({ error: "Failed to resolve user" }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("media_trackings")
      .upsert(
        {
          username: userId,
          tmdb_id: tmdbId,
          media_type: mediaType,
          status,
          rating: rating ?? null,
          progress: progress ?? null,
        },
        { onConflict: "username,tmdb_id,media_type" }
      )
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      id: data.id,
      username: username.trim().slice(0, 20),
      userId: data.username,
      tmdbId: data.tmdb_id,
      anilistId: data.anilist_id,
      mediaType: data.media_type,
      status: data.status,
      rating: data.rating,
      progress: data.progress,
      updatedAt: data.updated_at,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// ─── DELETE: remove tracking ───
export async function DELETE(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { tmdbId, mediaType } = body;

    if (tmdbId == null || !mediaType) {
      return NextResponse.json(
        { error: "Missing required fields: username, tmdbId, mediaType" },
        { status: 400 }
      );
    }

    const userId = await resolveUserId(username);
    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("media_trackings")
      .delete()
      .eq("username", userId)
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
