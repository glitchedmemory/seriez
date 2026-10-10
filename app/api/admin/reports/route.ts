import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername, STAFF_ROLES } from "@/lib/auth-helper";
import { logAdminAction } from "@/lib/audit-log";

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

    // 상태를 바꾸는 일(복구·삭제)은 GET으로 처리하지 않는다 — POST /api/admin/reports 참고.
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
    const { data: hiddenCollectionsRaw, error: colErr } = await supabaseAdmin
      .from("user_lists")
      .select("id, user_id, name, created_at, is_public, is_published")
      .eq("is_hidden", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if (colErr) return NextResponse.json({ error: colErr.message }, { status: 500 });

    // user_lists는 소유자를 user_id로만 가지고 있어서 이름을 따로 붙인다.
    const ownerIds = [...new Set((hiddenCollectionsRaw || []).map((l: any) => l.user_id))];
    const ownerNames: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: owners } = await supabaseAdmin
        .from("users").select("id, username").in("id", ownerIds);
      for (const u of owners || []) ownerNames[u.id] = u.username;
    }
    const hiddenCollections = (hiddenCollectionsRaw || []).map((l: any) => ({
      ...l,
      username: ownerNames[l.user_id] || "unknown",
    }));

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

// POST — 복구/삭제 (운영자 이상, 감사 기록 남김). 상태 변경은 반드시 POST로만 한다.
export async function POST(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { data: userData } = await supabaseAdmin
      .from("users").select("role").eq("username", username).maybeSingle();
    if (!STAFF_ROLES.includes(userData?.role || "")) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const action = body?.action;
    const targetType = body?.target_type;
    const targetId = body?.target_id;

    if (action !== "restore" && action !== "delete") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if (!targetId) return NextResponse.json({ error: "target_id required" }, { status: 400 });

    const tableMap: Record<string, string> = {
      review: "reviews",
      comment: "review_comments",
      collection: "user_lists",
    };
    const table = tableMap[targetType];
    if (!table) return NextResponse.json({ error: "Invalid target_type" }, { status: 400 });

    if (action === "restore") {
      const { error } = await supabaseAdmin.from(table).update({ is_hidden: false }).eq("id", targetId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      logAdminAction(username, "restore_content", targetType, String(targetId), {});
      return NextResponse.json({ ok: true, action: "restore" });
    }

    const { data: item } = await supabaseAdmin.from(table).select("id").eq("id", targetId).maybeSingle();
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (targetType === "collection") {
      await supabaseAdmin.from("list_items").delete().eq("list_id", targetId);
    }
    const { error } = await supabaseAdmin.from(table).delete().eq("id", targetId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    logAdminAction(username, "delete_content", targetType, String(targetId), {});
    return NextResponse.json({ ok: true, action: "delete" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
