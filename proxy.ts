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

// Next-intl middleware with routing config
const handleI18n = createIntlMiddleware({
  locales: ["en", "ko", "ja", "zh", "fr", "de", "es"],
  defaultLocale: "en",
  localePrefix: "never",
});

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const userAgent = request.headers.get("user-agent") || "";

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
    if (!rateLimit(ip + ":api", 60, 60000)) {
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
    if (!user || user.user_metadata?.username !== "Seriez") {
      return NextResponse.rewrite(new URL("/404", request.url));
    }
  }

  // Apply i18n and updateSession, merge headers
  const intlRes = handleI18n(request);
  const sessionRes = await updateSession(request);

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
