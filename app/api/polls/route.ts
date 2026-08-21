// GET /api/polls — 현재 진행 중(active) poll 1개 반환 (모든 유저, 익명 가능)
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const now = new Date().toISOString();
    // active && (ends_at가 없거나 미래)
    const { data: active } = await supabaseAdmin
      .from("polls")
      .select("id, question, options, status, starts_at, ends_at, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(5);

    const valid = (active || []).filter(
      (p) => !p.ends_at || new Date(p.ends_at).getTime() > Date.now()
    );

    if (!valid.length) {
      return NextResponse.json({ polls: [] });
    }

    // 각 poll의 집계
    const result = await Promise.all(
      valid.map(async (p) => {
        const { data: votes } = await supabaseAdmin
          .from("poll_votes")
          .select("option_index")
          .eq("poll_id", p.id);

        const options = (p.options && (p.options as any)["en"]) || [];
        const counts: number[] = new Array(options.length).fill(0);
        for (const v of votes || []) {
          if (v.option_index >= 0 && v.option_index < counts.length) {
            counts[v.option_index]++;
          }
        }
        const total = counts.reduce((a, b) => a + b, 0);

        return {
          id: p.id,
          question: p.question,
          options: p.options,
          ends_at: p.ends_at,
          total,
          counts,
        };
      })
    );

    return NextResponse.json({ polls: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
