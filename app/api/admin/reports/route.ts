import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername, STAFF_ROLES } from "@/lib/auth-helper";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const HIGH_RISK_REASONS = ["spam", "obscenity", "hate_speech"];

// GET — fetch hidden items with report details (staff only)
export async function GET(req: NextRequest) {
  try {
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
      const tableMap: Record<string, string> = {
        review: "reviews",
        comment: "review_comments",
        collection: "user_lists",
      };
      const table = tableMap[targetType];
      if (!table) return NextResponse.json({ error: "Invalid target_type" }, { status: 400 });

      if (action === "restore") {
        await supabaseAdmin.from(table).update({ is_hidden: false }).eq("id", targetId);
      } else if (action === "delete") {
        await supabaseAdmin.from(table).delete().eq("id", targetId);
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

    // Fetch hidden collections
    const { data: hiddenCollections, error: colErr } = await supabaseAdmin
      .from("user_lists")
      .select("id, username, name, created_at, is_public, is_published")
      .eq("is_hidden", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if (colErr) return NextResponse.json({ error: colErr.message }, { status: 500 });

    // Fetch report details for all hidden items
    const allTargets = [
      ...(hiddenReviews || []).map((r: any) => ({ type: "review", id: String(r.id) })),
      ...(hiddenComments || []).map((c: any) => ({ type: "comment", id: String(c.id) })),
      ...(hiddenCollections || []).map((l: any) => ({ type: "collection", id: String(l.id) })),
    ];

    // Get all reports in one query for efficiency
    const reportDetails: Record<string, { reporters: Array<{ username: string; reason: string | null; at: string }>; count: number; highRiskCount: number }> = {};

    if (allTargets.length > 0) {
      // Build OR conditions (Supabase doesn't support OR with many items easily, do in batches)
      for (const t of allTargets) {
        const { data: reports, error: repErr } = await supabaseAdmin
          .from("reports")
          .select("reporter_username, reason, created_at")
          .eq("target_type", t.type)
          .eq("target_id", t.id)
          .order("created_at", { ascending: false });

        if (repErr) continue;

        const key = `${t.type}-${t.id}`;
        const reporters = (reports || []).map((r: any) => ({
          username: r.reporter_username,
          reason: r.reason || "other",
          at: r.created_at,
        }));
        const highRiskCount = reporters.filter((r: any) => HIGH_RISK_REASONS.includes(r.reason)).length;

        reportDetails[key] = {
          reporters,
          count: reporters.length,
          highRiskCount,
        };
      }
    }

    const reviews = (hiddenReviews || []).map((r: any) => {
      const key = `review-${String(r.id)}`;
      const details = reportDetails[key] || { reporters: [], count: 0, highRiskCount: 0 };
      return {
        ...r,
        report_count: details.count,
        risk_level: details.highRiskCount > 0 ? "high" : details.count > 0 ? "normal" : "none",
        reporters: details.reporters,
      };
    });

    const comments = (hiddenComments || []).map((c: any) => {
      const key = `comment-${String(c.id)}`;
      const details = reportDetails[key] || { reporters: [], count: 0, highRiskCount: 0 };
      return {
        ...c,
        report_count: details.count,
        risk_level: details.highRiskCount > 0 ? "high" : details.count > 0 ? "normal" : "none",
        reporters: details.reporters,
      };
    });

    const collections = (hiddenCollections || []).map((l: any) => {
      const key = `collection-${String(l.id)}`;
      const details = reportDetails[key] || { reporters: [], count: 0, highRiskCount: 0 };
      return {
        ...l,
        content: l.name,
        report_count: details.count,
        risk_level: details.highRiskCount > 0 ? "high" : details.count > 0 ? "normal" : "none",
        reporters: details.reporters,
      };
    });

    return NextResponse.json({ reviews, comments, collections });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
