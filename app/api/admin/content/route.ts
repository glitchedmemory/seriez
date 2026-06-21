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
    const type = searchParams.get("type") || "all"; // all | review | comment | collection
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

    if (type === "all" || type === "collection") {
      let query = supabaseAdmin
        .from("user_lists")
        .select("id, user_id, name, is_public, is_published, created_at, is_hidden")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (q) query = query.ilike("name", `%${q}%`);
      if (hidden === "yes") query = query.eq("is_hidden", true);
      else if (hidden === "no") query = query.eq("is_hidden", false);

      const { data: lists } = await query;

      if (lists && lists.length > 0) {
        // Batch lookup usernames from user_ids
        const userIds = [...new Set(lists.map((l: any) => l.user_id))];
        const { data: users } = await supabaseAdmin
          .from("users")
          .select("id, username")
          .in("id", userIds);

        const userMap: Record<string, string> = {};
        if (users) users.forEach((u: any) => { userMap[u.id] = u.username; });

        // Count items per list
        const listIds = lists.map((l: any) => l.id);
        const { data: itemCounts, error: countErr } = await supabaseAdmin
          .from("list_items")
          .select("list_id")
          .in("list_id", listIds);

        const countMap: Record<string, number> = {};
        if (itemCounts) {
          itemCounts.forEach((ic: any) => {
            countMap[ic.list_id] = (countMap[ic.list_id] || 0) + 1;
          });
        }

        allResults.push(...lists.map((l: any) => ({
          id: l.id,
          content_type: "collection",
          username: userMap[l.user_id] || "unknown",
          content: l.name,
          is_public: l.is_public,
          is_published: l.is_published,
          item_count: countMap[l.id] || 0,
          created_at: l.created_at,
          is_hidden: l.is_hidden,
        })));
      }
    }

    allResults.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    allResults = allResults.slice(0, limit);

    return NextResponse.json({ results: allResults, total: allResults.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
