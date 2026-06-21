import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const HIGH_RISK_REASONS = ["spam", "obscenity", "hate_speech"];
const NORMAL_THRESHOLD = 3;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await resolveUsername(req);
  if (!username) {
    return NextResponse.json({ error: "Sign in to report" }, { status: 401 });
  }

  const { id: collectionId } = await params;
  const body = await req.json().catch(() => ({}));
  const { commentId, reason } = body;
  if (!commentId) return NextResponse.json({ error: "Missing commentId" }, { status: 400 });

  // Verify comment exists and belongs to this collection
  const { data: comment } = await supabase
    .from("collection_comments")
    .select("id, username")
    .eq("id", commentId)
    .eq("collection_id", collectionId)
    .single();

  if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

  // Don't let users report themselves
  if (comment.username === username) {
    return NextResponse.json({ error: "Cannot report your own comment" }, { status: 400 });
  }

  const { error } = await supabase
    .from("reports")
    .upsert(
      { target_type: "collection_comment", target_id: commentId, reporter_username: username, reason: reason || "other" },
      { onConflict: "target_type,target_id,reporter_username" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Count total reports
  const { count } = await supabase
    .from("reports")
    .select("*", { count: "exact", head: true })
    .eq("target_type", "collection_comment")
    .eq("target_id", commentId);

  const reportCount = count || 1;
  const isHighRisk = HIGH_RISK_REASONS.includes(reason);
  const shouldHide = isHighRisk || reportCount >= NORMAL_THRESHOLD;

  if (shouldHide) {
    await supabase
      .from("collection_comments")
      .update({ is_hidden: true })
      .eq("id", commentId);
  }

  return NextResponse.json({
    success: true,
    report_count: reportCount,
    auto_hidden: shouldHide,
    risk_level: isHighRisk ? "high" : "normal",
  });
}
