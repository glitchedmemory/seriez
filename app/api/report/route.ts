import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { target_type, target_id } = await req.json();
    if (!target_type || !target_id) {
      return NextResponse.json({ error: "target_type and target_id required" }, { status: 400 });
    }
    if (!["review", "comment"].includes(target_type)) {
      return NextResponse.json({ error: "target_type must be review or comment" }, { status: 400 });
    }

    // Get auth user from cookie
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reporter = user.user_metadata?.username || user.email || "unknown";

    // Insert report (UNIQUE constraint prevents duplicates)
    const { error: insertErr } = await supabaseAdmin.from("reports").insert({
      reporter_username: reporter,
      target_type,
      target_id,
    });

    // 23505 = unique violation (already reported) — not an error
    if (insertErr && insertErr.code !== "23505") {
      console.error("Report insert error:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Count total reports for this target
    const { count, error: countErr } = await supabaseAdmin
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq("target_type", target_type)
      .eq("target_id", target_id);

    if (countErr) {
      console.error("Report count error:", countErr);
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }

    const reportCount = count || 1;

    // Auto-hide if 5+ reports
    if (reportCount >= 5) {
      const table = target_type === "review" ? "reviews" : "review_comments";
      const idCol = target_type === "review" ? "id" : "id";
      const { error: hideErr } = await supabaseAdmin
        .from(table)
        .update({ is_hidden: true })
        .eq(idCol, target_id);

      if (hideErr) {
        console.error(`Auto-hide ${target_type} error:`, hideErr);
      }
    }

    return NextResponse.json({ report_count: reportCount });
  } catch (err: any) {
    console.error("Report API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
