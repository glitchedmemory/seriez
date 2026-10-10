import createIntlMiddleware from "next-intl/middleware";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// In-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function rateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 300000);

const BOT_UA_REGEX = /bot|crawler|spider|anthropic-ai|ChatGPT-User|Google-Extended|FacebookBot/i;

// Next-intl middleware with routing config + no cookie for CDN cache
const handleI18n = createIntlMiddleware({
  locales: ["en", "ko", "ja", "zh", "fr", "de", "es", "pt"],
  defaultLocale: "en",
  localePrefix: "never",
  localeCookie: false,
});

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const userAgent = request.headers.get("user-agent") || "";

  // Legacy /title/ URLs → new split routes (route split migration)
  // Deterministic redirects (type query param / season path) handled here as 301.
  // Type-less /title/[id] is resolved server-side in app/title/[id]/page.tsx (needs TMDB fetch).
  if (path.startsWith("/title/")) {
    const parts = path.split("/"); // ["", "title", id, ...]
    const id = parts[2];
    // /title/[id]/season/[n] → /tv/[id]/season/[n]
    if (id && parts[3] === "season" && parts[4]) {
      return NextResponse.redirect(new URL(`/tv/${id}/season/${parts[4]}`, request.url), 301);
    }
    // /title/[id]?type=tv → /tv/[id]/season/1
    if (id && request.nextUrl.searchParams.get("type") === "tv") {
      return NextResponse.redirect(new URL(`/tv/${id}/season/1`, request.url), 301);
    }
    // /title/[id]?type=movie → /movie/[id]
    if (id && request.nextUrl.searchParams.get("type") === "movie") {
      return NextResponse.redirect(new URL(`/movie/${id}`, request.url), 301);
    }
    // /title/[id]?type=anime → /anime/[id]
    if (id && request.nextUrl.searchParams.get("type") === "anime") {
      return NextResponse.redirect(new URL(`/anime/${id}`, request.url), 301);
    }
  }

  // Bot detection
  if (BOT_UA_REGEX.test(userAgent)) {
    request.headers.set("x-is-bot", "1");
  }

  // Fix Turbopack CSS chunk
  if (path === "/_next/static/chunks/259_-80ktmhh.css") {
    return NextResponse.rewrite(new URL("/_next/static/chunks/2urolxst4sso2.css", request.url));
  }

  // Rate limiting (before i18n to block early)
  if (path.startsWith("/api/") && (path.includes("auth") || path.includes("login") || path.includes("signup"))) {
    if (!rateLimit(ip + ":auth", 10, 60000)) {
      return new NextResponse("Too many login attempts.", { status: 429 });
    }
  } else if (path.startsWith("/api/")) {
    // 한도 분리: 시즌 페이지 한 장이 조회를 10여 회 보내므로 조회(GET)는 넉넉히,
    // 저장(POST/DELETE)은 별도 버킷으로 두어 조회 폭주가 저장을 막지 않게 한다.
    const isWrite = request.method !== "GET" && request.method !== "HEAD";
    if (isWrite) {
      if (!rateLimit(ip + ":api-write", 60, 60000)) {
        return new NextResponse("Too many requests.", { status: 429 });
      }
    } else if (!rateLimit(ip + ":api", 180, 60000)) {
      return new NextResponse("Too many requests.", { status: 429 });
    }
  } else {
    if (!rateLimit(ip + ":page", 100, 60000)) {
      return new NextResponse("Too many requests.", { status: 429 });
    }
  }

  // Admin protection
  if (path.startsWith("/admin")) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    const viewer = user?.user_metadata?.username as string | undefined;
    if (!user || !viewer) {
      return NextResponse.rewrite(new URL("/404", request.url));
    }
    // 계정 이름 하나가 아니라 역할로 판단한다 (두 번째 관리자·운영자도 들어올 수 있게).
    const { data: viewerRow } = await supabase
      .from("users").select("role").eq("username", viewer).maybeSingle();
    if (!["admin", "moderator"].includes(viewerRow?.role || "")) {
      return NextResponse.rewrite(new URL("/404", request.url));
    }
  }

  // Override Accept-Language if user set a locale preference
  const VALID_LOCALES = ["en", "ko", "ja", "zh", "fr", "de", "es", "pt"];
  const cookieLocale = request.cookies.get("SERIEZ_LOCALE")?.value;
  if (cookieLocale && VALID_LOCALES.includes(cookieLocale)) {
    request.headers.set("accept-language", cookieLocale);
  }

  // Apply i18n and updateSession, merge headers
  const intlRes = handleI18n(request);
  const sessionRes = await updateSession(request);

  // Homepage: no-store so each request re-renders server-side. The hero/Right Now
  // picks are random per request (page.tsx), so this keeps them fresh on every
  // reload without client-side rerolling (which caused the flash).
  if (path === "/") {
    sessionRes.headers.set(
      "Cache-Control",
      "private, no-cache, no-store, must-revalidate, max-age=0"
    );
  }

  // Copy i18n headers (locale cookie, rewrite) to session response
  intlRes.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "x-middleware-rewrite") {
      sessionRes.headers.set(key, value);
    }
  });
  // Copy i18n cookies
  intlRes.cookies.getAll().forEach((cookie) => {
    sessionRes.cookies.set(cookie.name, cookie.value, {
      path: cookie.path,
      maxAge: cookie.maxAge,
      sameSite: cookie.sameSite as any,
    });
  });

  return sessionRes;
}

export const config = {
  matcher: [
    "/_next/static/chunks/259_-80ktmhh.css",
    "/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
