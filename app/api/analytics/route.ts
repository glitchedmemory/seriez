import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createClient();
    await supabase.from("analytics").insert({
      page: String(body.page || "").slice(0, 500),
      referer: String(body.referer || "").slice(0, 500),
      duration: Math.min(Math.max(parseInt(String(body.duration)) || 0, 0), 3600),
      scroll_depth: Math.min(Math.max(parseInt(String(body.scroll_depth)) || 0, 0), 100),
      user_agent: String(req.headers.get("user-agent") || "").slice(0, 500),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
