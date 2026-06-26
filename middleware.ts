import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  // Only protect /admin routes
  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.rewrite(new URL("/404", request.url));
  }

  const username = user.user_metadata?.username;
  if (username !== "Seriez") {
    return NextResponse.rewrite(new URL("/404", request.url));
  }

  // Double-check DB role
  const { data: row } = await supabase
    .from("users")
    .select("role")
    .eq("username", username)
    .maybeSingle();

  if ((row as any)?.role !== "admin") {
    return NextResponse.rewrite(new URL("/404", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
