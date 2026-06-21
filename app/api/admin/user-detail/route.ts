import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const adminUser = await resolveUsername(req);
    if (!adminUser) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { data: adminData } = await supabaseAdmin
      .from("users").select("role").eq("username", adminUser).maybeSingle();
    if (adminData?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const target = searchParams.get("username");
    if (!target) return NextResponse.json({ error: "username required" }, { status: 400 });

    // User info
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("username, role, is_premium, created_at, avatar_url")
      .eq("username", target)
      .maybeSingle();

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Reviews
    const { data: reviews } = await supabaseAdmin
      .from("reviews")
      .select("id, content, rating, created_at, tmdb_id, media_type, is_hidden")
      .eq("username", target)
      .order("created_at", { ascending: false })
      .limit(50);

    // Library
    const { data: library } = await supabaseAdmin
      .from("user_library")
      .select("tmdb_id, media_type, status, rating, title, poster, updated_at")
      .eq("username", target)
      .order("updated_at", { ascending: false })
      .limit(50);

    // Comments
    const { data: comments } = await supabaseAdmin
      .from("review_comments")
      .select("id, content, created_at, review_id, is_hidden")
      .eq("username", target)
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({
      user,
      reviews: reviews || [],
      library: library || [],
      comments: comments || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
