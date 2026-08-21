// POST /api/polls/admin — admin 전용: 투표 생성 (DeepSeek 다국어 번역 포함)
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername, STAFF_ROLES } from "@/lib/auth-helper";
import { translatePoll } from "@/lib/poll-translate";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { data: userData } = await supabaseAdmin
      .from("users").select("role, id").eq("username", username).maybeSingle();
    if (!STAFF_ROLES.includes(userData?.role || "")) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();
    const question = (body.question as string)?.trim();
    const options = body.options as string[];
    const sourceLocale = (body.sourceLocale as string) || "en";
    const startsAt = body.startsAt as string | null;
    const endsAt = body.endsAt as string | null;

    if (!question || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json(
        { error: "question and at least 2 options required" },
        { status: 400 }
      );
    }

    // 다국어 번역
    let translated;
    try {
      translated = await translatePoll(question, options, sourceLocale);
    } catch {
      // 번역 실패 시 원문으로 채움
      const q: Record<string, string> = {};
      const o: Record<string, string[]> = {};
      for (const l of ["en", "ko", "ja", "zh", "fr", "de", "es", "pt"]) {
        q[l] = question; o[l] = options;
      }
      translated = { question: q, options: o };
    }

    const { data: poll, error } = await supabaseAdmin
      .from("polls")
      .insert({
        question: translated.question,
        options: translated.options,
        status: "active",
        starts_at: startsAt || null,
        ends_at: endsAt || null,
        created_by: userData?.id || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, poll });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
