import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId } from "@/lib/user-utils";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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

  const { data, error } = await supabaseAdmin
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

// ─── progress 재계산 ───
// "몇 화 봤는지" 숫자(progress)는 항상 실제 episode_watches 기록 수와 같아야 한다.
// 체크를 해제했을 때 이 숫자를 다시 계산하지 않아, 실제 기록(14건)보다 큰 값(15)이
// 남는 문제가 있었다. 저장·해제 양쪽에서 같은 함수로 맞춘다.
// 종류(mediaType)별로 계산해 애니 행과 TV 행의 숫자가 서로 섞이지 않게 한다.
async function recalcProgress(userId: string, tmdbId: number, mediaType: string) {
  const { count } = await supabaseAdmin
    .from("episode_watches")
    .select("id", { count: "exact", head: true })
    .eq("username", userId)
    .eq("tmdb_id", tmdbId);

  const progress = count ?? 0;

  await supabaseAdmin
    .from("media_trackings")
    .update({ progress })
    .eq("username", userId)
    .eq("tmdb_id", tmdbId)
    .eq("media_type", mediaType);

  return progress;
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

    // 작품 종류: 애니 페이지는 "anime", TV 시즌 페이지는 "tv"를 보낸다.
    // 종류를 보내지 않는 옛 클라이언트(캐시된 이전 JS)만 tv로 간주한다.
    const mediaType: string = body.mediaType === "anime" ? "anime" : "tv";

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
    const { data: existing } = await supabaseAdmin
      .from("episode_watches")
      .select("id")
      .eq("username", userId)
      .eq("tmdb_id", tmdbId)
      .eq("season_number", seasonNumber)
      .eq("episode_number", episodeNumber)
      .maybeSingle();

    if (existing) {
      // Already watched → unwatch (delete)
      const { error: delErr } = await supabaseAdmin
        .from("episode_watches")
        .delete()
        .eq("id", existing.id);

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }

      // 해제 후에도 "몇 화 봤는지" 숫자를 실제 기록 수에 맞춘다.
      const progress = await recalcProgress(userId, tmdbId, mediaType);

      return NextResponse.json({ action: "unwatched", seasonNumber, episodeNumber, progress });
    }

    // Not watched → watch (insert)
    const { error: insErr } = await supabaseAdmin
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
    const progress = await recalcProgress(userId, tmdbId, mediaType);

    // Auto-set tracking status to "watching" only when this title has NO
    // tracking row of the same type. Matching by season_number alone would
    // treat an existing row (e.g. completed season 0) as "not tracked" and
    // create a season-1 watching duplicate that never disappears.
    // 애니는 여기서 행을 만들지 않는다. 애니 작품 행은 애니 페이지가 AniList
    // 정보로 직접 저장하므로, 여기서 만들면 TMDB 번호 체계의 'tv' 행이 생겨
    // 같은 작품이 목록에 애니와 TV 두 줄로 나타난다.
    const { data: trackRows } = await supabaseAdmin
      .from("media_trackings")
      .select("id")
      .eq("username", userId)
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType)
      .limit(1);

    if (!trackRows || trackRows.length === 0) {
      if (mediaType !== "anime") {
        // No tracking yet → create with "watching" status
        await supabaseAdmin
          .from("media_trackings")
          .upsert(
            {
              username: userId,
              tmdb_id: tmdbId,
              media_type: mediaType,
              season_number: seasonNumber,
              status: "watching",
              progress,
            },
            { onConflict: "username,tmdb_id,media_type,season_number" }
          );
      }
    }

    return NextResponse.json({ action: "watched", seasonNumber, episodeNumber, progress });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
