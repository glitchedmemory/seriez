import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Homepage: prevent Cloudflare from caching stale box office data
  if (request.nextUrl.pathname === "/") {
    response.headers.set(
      "Cache-Control",
      "public, max-age=0, s-maxage=120, stale-while-revalidate=60"
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
