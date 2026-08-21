// POST /api/human-proof — 클라이언트 JS 실행 증명을 받아 진짜 사람 방문을 기록
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const path = (body.path as string) || "/";
    const referrer = (body.referrer as string) || null;
    const locale = (body.locale as string) || null;
    const mouseEventCount = Number(body.mouseEventCount) || 0;
    const pageLoadedAt = body.pageLoadedAt as string | null;

    // 최소 조건 서버측 재검증: 상호작용 1회 미만은 기록 안 함 (이중 방어)
    if (mouseEventCount < 1) {
      return NextResponse.json({ ok: false, reason: "no-interaction" });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const userAgent = req.headers.get("user-agent") || null;

    const { error } = await supabaseAdmin.from("human_visits").insert({
      ip,
      user_agent: userAgent,
      referrer,
      path,
      locale,
      mouse_event_count: mouseEventCount,
      page_loaded_at: pageLoadedAt ? new Date(pageLoadedAt).toISOString() : null,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "Failed" }, { status: 500 });
  }
}
