import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");
  if (!username) {
    return NextResponse.json({ error: "username required" }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("avatar_url, background_url, background_scale, background_position_x, background_position_y, is_premium")
      .eq("username", username.trim())
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json(data || {});
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { createClient: createServerClient } = await import("@/lib/supabase/server");
    const supabase = await createServerClient();
    const { data: authData } = await supabase.auth.getUser();
    const username = authData.user?.user_metadata?.username;
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const allowed = ["background_scale", "background_position_x", "background_position_y"];
    const updates: Record<string, number> = {};
    for (const key of allowed) {
      if (typeof body[key] === "number") updates[key] = body[key];
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("username", username.trim());

    if (error) throw error;
    return NextResponse.json({ success: true, ...updates });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
