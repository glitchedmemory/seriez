import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { data: userData } = await supabaseAdmin
      .from("users").select("role").eq("username", username).maybeSingle();
    if (userData?.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { message } = body;
    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    // Get all users
    const { data: allUsers } = await supabaseAdmin
      .from("users")
      .select("username");

    if (!allUsers || allUsers.length === 0) {
      return NextResponse.json({ error: "No users found" }, { status: 400 });
    }

    const rows = allUsers.map((u: any) => ({
      type: "announcement",
      actor_username: username,
      target_username: u.username,
      tmdb_id: 0,
      title_name: message.trim(),
    }));

    const { error } = await supabaseAdmin.from("notifications").insert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, sent_to: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
