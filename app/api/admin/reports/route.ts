import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername, STAFF_ROLES } from "@/lib/auth-helper";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — fetch hidden items with report counts (admin only)
export async function GET(req: NextRequest) {
  try {
    // Admin check
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { data: userData } = await supabaseAdmin
      .from("users").select("role").eq("username", username).maybeSingle();
    if (!STAFF_ROLES.includes(userData?.role || "")) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const targetType = searchParams.get("target_type");
    const targetId = searchParams.get("target_id");

    // Handle restore/delete actions
    if (action && targetType && targetId) {
      const table = targetType === "review" ? "reviews" : "review_comments";
      const idCol = "id";

      if (action === "restore") {
        await supabaseAdmin.from(table).update({ is_hidden: false }).eq(idCol, targetId);
      } else if (action === "delete") {
        await supabaseAdmin.from(table).delete().eq(idCol, targetId);
      }
      return NextResponse.json({ ok: true });
    }

    // Fetch hidden reviews
    const { data: hiddenReviews, error: reviewErr } = await supabaseAdmin
      .from("reviews")
      .select("id, username, content, created_at, tmdb_id, media_type")
      .eq("is_hidden", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if (reviewErr) return NextResponse.json({ error: reviewErr.message }, { status: 500 });

    // Fetch hidden comments
    const { data: hiddenComments, error: commentErr } = await supabaseAdmin
      .from("review_comments")
      .select("id, username, content, created_at, review_id")
      .eq("is_hidden", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if (commentErr) return NextResponse.json({ error: commentErr.message }, { status: 500 });

    // Get report counts
    const reportCounts: Record<string, number> = {};

    if (hiddenReviews?.length || hiddenComments?.length) {
      const targets = [
        ...(hiddenReviews || []).map((r: any) => ({ type: "review", id: String(r.id) })),
        ...(hiddenComments || []).map((c: any) => ({ type: "comment", id: String(c.id) })),
      ];

      for (const t of targets) {
        const { count } = await supabaseAdmin
          .from("reports")
          .select("*", { count: "exact", head: true })
          .eq("target_type", t.type)
          .eq("target_id", t.id);
        reportCounts[`${t.type}-${t.id}`] = count || 0;
      }
    }

    const reviews = (hiddenReviews || []).map((r: any) => ({
      ...r,
      report_count: reportCounts[`review-${String(r.id)}`] || 0,
    }));
    const comments = (hiddenComments || []).map((c: any) => ({
      ...c,
      report_count: reportCounts[`comment-${String(c.id)}`] || 0,
    }));

    return NextResponse.json({ reviews, comments });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
