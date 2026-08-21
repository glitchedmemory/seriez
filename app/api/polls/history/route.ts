// GET /api/polls/history — admin 전용: 종료된 투표 히스토리 + 집계 결과
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername, STAFF_ROLES } from "@/lib/auth-helper";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { data: userData } = await supabaseAdmin
      .from("users").select("role").eq("username", username).maybeSingle();
    if (!STAFF_ROLES.includes(userData?.role || "")) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { data: polls } = await supabaseAdmin
      .from("polls")
      .select("id, question, options, status, created_at, closed_at, ends_at")
      .eq("status", "closed")
      .order("closed_at", { ascending: false })
      .limit(100);

    const result = await Promise.all(
      (polls || []).map(async (p) => {
        const { data: votes } = await supabaseAdmin
          .from("poll_votes")
          .select("option_index")
          .eq("poll_id", p.id);
        const options = (p.options && (p.options as any)["en"]) || [];
        const counts: number[] = new Array(options.length).fill(0);
        for (const v of votes || []) {
          if (v.option_index >= 0 && v.option_index < counts.length) counts[v.option_index]++;
        }
        return {
          id: p.id,
          question: p.question,
          options: p.options,
          closed_at: p.closed_at || p.ends_at || p.created_at,
          total: counts.reduce((a, b) => a + b, 0),
          counts,
        };
      })
    );

    return NextResponse.json({ polls: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
