import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no-code`);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: authData, error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error || !authData.user) {
    return NextResponse.redirect(`${origin}/login?error=auth-failed`);
  }

  // Get username from public.users
  let username: string | null = null;
  try {
    const { data: userData } = await supabase
      .from("users")
      .select("username")
      .eq("id", authData.user.id)
      .single();
    username = userData?.username ?? null;
  } catch {}

  const target = username ? "/" : "/welcome";
  const response = NextResponse.redirect(`${origin}${target}`);

  if (username) {
    response.cookies.set("seriez-username", username, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}
