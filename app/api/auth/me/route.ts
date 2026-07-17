import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ loggedIn: false });
  }

  return NextResponse.json({
    loggedIn: true,
    username: user.user_metadata?.username || null,
    avatarUrl: user.user_metadata?.avatar_url || null,
    isStaff: user.user_metadata?.role === "admin" || user.user_metadata?.role === "moderator",
  });
}
