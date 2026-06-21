import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername, STAFF_ROLES } from "@/lib/auth-helper";

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
    if (!STAFF_ROLES.includes(userData?.role || "")) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    // Top queries
    const { data: topQueries } = await supabaseAdmin
      .from("search_logs")
      .select("query")
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(5000);

    const queryCounts: Record<string, number> = {};
    for (const row of topQueries || []) {
      const q = (row.query || "").trim().toLowerCase();
      if (q) queryCounts[q] = (queryCounts[q] || 0) + 1;
    }
    const top = Object.entries(queryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([query, count]) => ({ query, count }));

    // Daily volume
    const { data: allRecent } = await supabaseAdmin
      .from("search_logs")
      .select("created_at")
      .gte("created_at", thirtyDaysAgo);

    const dailyMap: Record<string, number> = {};
    for (const row of allRecent || []) {
      const day = (row.created_at || "").slice(0, 10);
      if (day) dailyMap[day] = (dailyMap[day] || 0) + 1;
    }
    const dailyVolume = Object.entries(dailyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    return NextResponse.json({
      top_queries: top,
      daily_volume: dailyVolume,
      total_searches: Object.values(dailyMap).reduce((s, c) => s + c, 0),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
