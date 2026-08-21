// POST /api/polls/vote — 로그인 유저 1인 1표 (UNIQUE 제약으로 중복 차단)
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername } from "@/lib/auth-helper";
import { resolveUserId } from "@/lib/user-utils";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await req.json();
    const pollId = body.pollId as string;
    const optionIndex = body.optionIndex as number;

    if (!pollId || typeof optionIndex !== "number") {
      return NextResponse.json({ error: "pollId and optionIndex required" }, { status: 400 });
    }

    const userId = await resolveUserId(username);

    // poll 검증 (active 여부 + 마감 여부)
    const { data: poll } = await supabaseAdmin
      .from("polls")
      .select("id, option_index_count, options, status, ends_at")
      .eq("id", pollId)
      .maybeSingle();

    if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    if (poll.status !== "active") return NextResponse.json({ error: "Poll closed" }, { status: 400 });
    if (poll.ends_at && new Date(poll.ends_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "Poll closed" }, { status: 400 });
    }

    const options = (poll.options && (poll.options as any)["en"]) || [];
    if (optionIndex < 0 || optionIndex >= options.length) {
      return NextResponse.json({ error: "Invalid option" }, { status: 400 });
    }

    // insert — UNIQUE(poll_id, user_id)로 중복 시 23505 에러
    const { error } = await supabaseAdmin.from("poll_votes").insert({
      poll_id: pollId,
      user_id: userId,
      option_index: optionIndex,
    });

    if (error) {
      // 23505 = unique violation → 이미 투표함
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Already voted", alreadyVoted: true },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 집계 반환
    const { data: votes } = await supabaseAdmin
      .from("poll_votes")
      .select("option_index")
      .eq("poll_id", pollId);
    const counts: number[] = new Array(options.length).fill(0);
    for (const v of votes || []) {
      if (v.option_index >= 0 && v.option_index < counts.length) counts[v.option_index]++;
    }
    const total = counts.reduce((a, b) => a + b, 0);

    return NextResponse.json({ success: true, total, counts, myOption: optionIndex });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
