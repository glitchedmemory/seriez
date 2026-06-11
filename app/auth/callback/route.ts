import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: authData, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && authData.user) {
      const response = NextResponse.redirect(`${origin}${next}`);
      // Store username cookie so client knows who's logged in
      try {
        const { data } = await supabase
          .from("users")
          .select("username")
          .eq("id", authData.user.id)
          .single();
        if (data?.username) {
          response.cookies.set("seriez-username", data.username, {
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
            sameSite: "lax",
          });
        }
      } catch {}
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-failed`);
}
