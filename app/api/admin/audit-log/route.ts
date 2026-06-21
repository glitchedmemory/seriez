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
    if (userData?.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = parseInt(searchParams.get("offset") || "0");
    const action = searchParams.get("action");
    const targetUser = searchParams.get("target");
    const admin = searchParams.get("admin");

    let query = supabaseAdmin
      .from("admin_actions")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (action) query = query.eq("action", action);
    if (targetUser) query = query.eq("target_id", targetUser);
    if (admin) query = query.eq("admin_username", admin);

    const { data, error, count } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ actions: data, total: count, limit, offset });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
