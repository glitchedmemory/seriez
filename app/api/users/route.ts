import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q?.trim() || q.trim().length < 2) {
    return NextResponse.json({ users: [] });
  }

  const { data, error } = await supabase
    .from("users")
    .select("username, created_at")
    .ilike("username", `%${q.trim()}%`)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // For each user, get review count + tracking count
  const users = await Promise.all(
    (data || []).map(async (u) => {
      const [revRes, trackRes] = await Promise.all([
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("username", u.username),
        supabase.from("media_trackings").select("id", { count: "exact", head: true }).eq("username", u.username),
      ]);
      return {
        username: u.username,
        reviewCount: revRes.count || 0,
        trackingCount: trackRes.count || 0,
        joinedAt: u.created_at,
      };
    })
  );

  return NextResponse.json({ users });
}
