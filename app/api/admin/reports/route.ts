import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// ─── GET: list all hidden reviews and comments ───
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "restore") {
      const targetType = searchParams.get("target_type");
      const targetId = searchParams.get("target_id");
      if (!targetType || !targetId) {
        return NextResponse.json({ error: "target_type and target_id required" }, { status: 400 });
      }
      const table = targetType === "review" ? "reviews" : "review_comments";
      const idCol = targetType === "review" ? "id" : "id";
      const { error } = await supabaseAdmin
        .from(table)
        .update({ is_hidden: false, ai_verdict: "restored_by_admin" })
        .eq(idCol, targetType === "comment" ? parseInt(targetId) : targetId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      const targetType = searchParams.get("target_type");
      const targetId = searchParams.get("target_id");
      if (!targetType || !targetId) {
        return NextResponse.json({ error: "target_type and target_id required" }, { status: 400 });
      }
      const table = targetType === "review" ? "reviews" : "review_comments";
      const idCol = targetType === "review" ? "id" : "id";
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq(idCol, targetType === "comment" ? parseInt(targetId) : targetId);
      if (error) throw error;
      // Also clean up reports
      await supabaseAdmin.from("reports").delete().eq("target_type", targetType).eq("target_id", targetId);
      return NextResponse.json({ success: true });
    }

    // Default: list hidden content
    const [hiddenReviews, hiddenComments] = await Promise.all([
      supabaseAdmin.from("reviews").select("id, username, content, tmdb_id, media_type, ai_verdict, created_at").eq("is_hidden", true).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("review_comments").select("id, review_id, username, content, ai_verdict, created_at").eq("is_hidden", true).order("created_at", { ascending: false }).limit(50),
    ]);

    // Get report counts for all
    const allIds = [
      ...(hiddenReviews.data || []).map((r: any) => ({ type: "review", id: r.id })),
      ...(hiddenComments.data || []).map((c: any) => ({ type: "comment", id: String(c.id) })),
    ];

    return NextResponse.json({
      reviews: hiddenReviews.data || [],
      comments: hiddenComments.data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}
