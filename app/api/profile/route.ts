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
      .select("avatar_url, background_url, is_premium")
      .eq("username", username.trim())
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json(data || {});
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
