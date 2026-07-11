import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // TV show detail → redirect to season/1 immediately (no API calls)
  if (pathname.startsWith("/title/") && searchParams.get("type") === "tv") {
    const id = pathname.split("/")[2];
    if (id) {
      return NextResponse.redirect(new URL(`/title/${id}/season/1`, request.url));
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
