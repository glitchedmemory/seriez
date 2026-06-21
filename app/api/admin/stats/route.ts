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
    if (!STAFF_ROLES.includes(userData?.role || "")) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    // Total users
    const { count: totalUsers } = await supabaseAdmin
      .from("users").select("*", { count: "exact", head: true });

    // Today signups
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todaySignups } = await supabaseAdmin
      .from("users").select("*", { count: "exact", head: true })
      .gte("created_at", today.toISOString());

    // This week signups
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { count: weekSignups } = await supabaseAdmin
      .from("users").select("*", { count: "exact", head: true })
      .gte("created_at", weekAgo.toISOString());

    // Premium users
    const { count: premiumUsers } = await supabaseAdmin
      .from("users").select("*", { count: "exact", head: true })
      .eq("is_premium", true);

    // Total reviews
    const { count: totalReviews } = await supabaseAdmin
      .from("reviews").select("*", { count: "exact", head: true });

    // Total tracked items
    const { count: totalTracked } = await supabaseAdmin
      .from("user_library").select("*", { count: "exact", head: true });

    // Total collections
    const { count: totalCollections } = await supabaseAdmin
      .from("user_lists").select("*", { count: "exact", head: true });

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      todaySignups: todaySignups || 0,
      weekSignups: weekSignups || 0,
      premiumUsers: premiumUsers || 0,
      totalReviews: totalReviews || 0,
      totalTracked: totalTracked || 0,
      totalCollections: totalCollections || 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
