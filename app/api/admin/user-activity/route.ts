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
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // DAU — union of usernames from tracking/reviews/comments
    const [{ data: dauTracked }, { data: dauReviews }, { data: dauComments }] = await Promise.all([
      supabaseAdmin.from("media_trackings").select("username").gte("updated_at", thirtyDaysAgo),
      supabaseAdmin.from("reviews").select("username").gte("created_at", thirtyDaysAgo),
      supabaseAdmin.from("review_comments").select("username").gte("created_at", thirtyDaysAgo),
    ]);

    const dayUsers: Record<string, Set<string>> = {};
    const addDay = (day: string, user: string) => {
      if (!dayUsers[day]) dayUsers[day] = new Set();
      dayUsers[day].add(user);
    };

    // Note: these tables don't store date separately. We approximate by using the first 10 chars of timestamp.
    // For more accuracy we'd need to query with date_part. This gives admin a reasonable estimate.
    for (const row of dauTracked || []) {
      if (row.updated_at) addDay(row.updated_at.slice(0, 10), row.username);
    }
    for (const row of dauReviews || []) {
      if (row.created_at) addDay(row.created_at.slice(0, 10), row.username);
    }
    for (const row of dauComments || []) {
      if (row.created_at) addDay(row.created_at.slice(0, 10), row.username);
    }

    const dau = Object.entries(dayUsers)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, users]) => ({ date, count: users.size }));

    // Most active users (last 7 days)
    const userActivity: Record<string, number> = {};
    const incUser = (u: string) => {
      if (u) userActivity[u] = (userActivity[u] || 0) + 1;
    };

    const [{ data: recentTrack }, { data: recentReview }, { data: recentComment }] = await Promise.all([
      supabaseAdmin.from("media_trackings").select("username").gte("updated_at", sevenDaysAgo),
      supabaseAdmin.from("reviews").select("username").gte("created_at", sevenDaysAgo),
      supabaseAdmin.from("review_comments").select("username").gte("created_at", sevenDaysAgo),
    ]);

    for (const row of recentTrack || []) incUser(row.username);
    for (const row of recentReview || []) incUser(row.username);
    for (const row of recentComment || []) incUser(row.username);

    const mostActive = Object.entries(userActivity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([username, count]) => ({ username, count }));

    // Signup trend
    const { data: signups } = await supabaseAdmin
      .from("users")
      .select("created_at")
      .gte("created_at", thirtyDaysAgo);

    const signupMap: Record<string, number> = {};
    for (const row of signups || []) {
      const day = (row.created_at || "").slice(0, 10);
      if (day) signupMap[day] = (signupMap[day] || 0) + 1;
    }
    const signupTrend = Object.entries(signupMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    return NextResponse.json({ dau, most_active: mostActive, signup_trend: signupTrend });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
