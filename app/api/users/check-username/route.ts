import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username")?.trim().slice(0, 20);

  if (!username || username.length < 2) {
    return NextResponse.json({ exists: false, error: "Username must be at least 2 characters" });
  }

  // Check public.users table
  const { data } = await supabase
    .from("users")
    .select("username")
    .eq("username", username)
    .maybeSingle();

  return NextResponse.json({ exists: !!data });
}
