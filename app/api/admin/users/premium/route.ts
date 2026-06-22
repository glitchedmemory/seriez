import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const adminUser = await resolveUsername(req);
    if (!adminUser) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    // Only admin can manage premium
    const { data: adminData } = await supabaseAdmin
      .from("users").select("role").eq("username", adminUser).maybeSingle();
    if (adminData?.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { username, premium } = body;

    if (!username || premium === undefined) {
      return NextResponse.json({ error: "username and premium (boolean) required" }, { status: 400 });
    }

    const { data: targetData } = await supabaseAdmin
      .from("users").select("username").eq("username", username).maybeSingle();
    if (!targetData) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { error } = await supabaseAdmin
      .from("users")
      .update({ is_premium: premium })
      .eq("username", username);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, username, is_premium: premium });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
