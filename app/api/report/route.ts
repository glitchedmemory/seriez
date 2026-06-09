import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// ─── GET: check report status ───
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetType = searchParams.get("target_type");
  const targetId = searchParams.get("target_id");
  const username = await resolveUsername(req);

  if (!targetType || !targetId) {
    return NextResponse.json({ error: "target_type and target_id required" }, { status: 400 });
  }

  if (!["review", "comment"].includes(targetType)) {
    return NextResponse.json({ error: "target_type must be 'review' or 'comment'" }, { status: 400 });
  }

  try {
    // Count total reports
    const { count, error: countErr } = await supabaseAdmin
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq("target_type", targetType)
      .eq("target_id", targetId);

    if (countErr) throw countErr;

    // Check if current user already reported
    let userReported = false;
    if (username) {
      const { data: existing } = await supabaseAdmin
        .from("reports")
        .select("id")
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .eq("reporter_username", username.trim())
        .maybeSingle();
      userReported = !!existing;
    }

    // Check is_hidden status
    const table = targetType === "review" ? "reviews" : "review_comments";
    const idCol = targetType === "review" ? "id" : "id";
    const { data: target } = await supabaseAdmin
      .from(table)
      .select("is_hidden")
      .eq(idCol, targetType === "comment" ? parseInt(targetId) : targetId)
      .maybeSingle();

    return NextResponse.json({
      report_count: count || 0,
      is_hidden: target?.is_hidden || false,
      user_reported: userReported,
    });
  } catch (err: any) {
    if (err?.message?.includes("does not exist")) {
      return NextResponse.json({ report_count: 0, is_hidden: false, user_reported: false });
    }
    return NextResponse.json({ error: err?.message || "Failed to check" }, { status: 500 });
  }
}

// ─── POST: submit a report ───
export async function POST(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { target_type, target_id } = body;

    if (!target_type || !target_id) {
      return NextResponse.json({ error: "target_type and target_id required" }, { status: 400 });
    }

    if (!["review", "comment"].includes(target_type)) {
      return NextResponse.json({ error: "target_type must be 'review' or 'comment'" }, { status: 400 });
    }

    const reporter = username.trim();

    // Insert report (unique constraint prevents duplicates)
    const { error: insertErr } = await supabaseAdmin
      .from("reports")
      .insert({
        target_type,
        target_id,
        reporter_username: reporter,
      });

    if (insertErr) {
      if (insertErr.code === "23505") {
        // Already reported — still return current count
        const { count } = await supabaseAdmin
          .from("reports")
          .select("*", { count: "exact", head: true })
          .eq("target_type", target_type)
          .eq("target_id", target_id);
        return NextResponse.json({ reported: false, report_count: count || 0, message: "Already reported" });
      }
      throw insertErr;
    }

    // Count total reports
    const { count, error: countErr } = await supabaseAdmin
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq("target_type", target_type)
      .eq("target_id", target_id);

    if (countErr) throw countErr;

    // Hide content if 5+ reports
    const isHidden = (count || 0) >= 5;
    if (isHidden) {
      const table = target_type === "review" ? "reviews" : "review_comments";
      const idCol = target_type === "review" ? "id" : "id";
      await supabaseAdmin
        .from(table)
        .update({ is_hidden: true })
        .eq(idCol, target_type === "comment" ? parseInt(target_id) : target_id);
    }

    return NextResponse.json({ reported: true, report_count: count || 0, is_hidden: isHidden });
  } catch (err: any) {
    if (err?.message?.includes("does not exist")) {
      return NextResponse.json(
        { error: "Report system not available yet. Run the database migration first." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: err?.message || "Failed to report" }, { status: 500 });
  }
}
