import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ loggedIn: false });

  const username = user.user_metadata?.username || "";
  const isStaff = username === "Seriez";

  let avatarUrl = null;
  if (username) {
    try {
      const { data } = await supabase.from("users").select("avatar_url").eq("username", username).single();
      avatarUrl = data?.avatar_url || null;
    } catch {}
  }

  return NextResponse.json({ loggedIn: true, username, isStaff, avatarUrl });
}
