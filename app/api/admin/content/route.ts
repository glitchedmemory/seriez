import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { data: userData } = await supabaseAdmin
      .from("users").select("role").eq("username", username).maybeSingle();
    if (userData?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const type = searchParams.get("type") || "all"; // all | review | comment
    const hidden = searchParams.get("hidden") || "all"; // all | yes | no
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    let allResults: any[] = [];

    if (type === "all" || type === "review") {
      let query = supabaseAdmin
        .from("reviews")
        .select("id, username, content, rating, created_at, tmdb_id, media_type, is_hidden")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (q) query = query.ilike("content", `%${q}%`);
      if (hidden === "yes") query = query.eq("is_hidden", true);
      else if (hidden === "no") query = query.eq("is_hidden", false);

      const { data: reviews } = await query;
      if (reviews) allResults.push(...reviews.map((r: any) => ({ ...r, content_type: "review" })));
    }

    if (type === "all" || type === "comment") {
      let query = supabaseAdmin
        .from("review_comments")
        .select("id, username, content, created_at, review_id, is_hidden")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (q) query = query.ilike("content", `%${q}%`);
      if (hidden === "yes") query = query.eq("is_hidden", true);
      else if (hidden === "no") query = query.eq("is_hidden", false);

      const { data: comments } = await query;
      if (comments) allResults.push(...comments.map((c: any) => ({ ...c, content_type: "comment" })));
    }

    allResults.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    allResults = allResults.slice(0, limit);

    return NextResponse.json({ results: allResults, total: allResults.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
