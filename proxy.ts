import { updateSession } from "@/lib/supabase/middleware";
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

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 300000);

export async function proxy(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const path = request.nextUrl.pathname;

  // Fix Turbopack CSS chunk mismatch
  if (path === "/_next/static/chunks/259_-80ktmhh.css") {
    const newUrl = new URL("/_next/static/chunks/2urolxst4sso2.css", request.url);
    return NextResponse.rewrite(newUrl);
  }

  // Rate limit auth endpoints
  if (path.startsWith("/api/") && (path.includes("auth") || path.includes("login") || path.includes("signup"))) {
    if (!rateLimit(ip + ":auth", 10, 60000)) {
      return new NextResponse("Too many login attempts. Try again in a minute.", { status: 429 });
    }
  }
  // Rate limit other API endpoints  
  else if (path.startsWith("/api/")) {
    if (!rateLimit(ip + ":api", 60, 60000)) {
      return new NextResponse("Too many requests. Slow down.", { status: 429 });
    }
  }
  // Rate limit pages
  else {
    if (!rateLimit(ip + ":page", 100, 60000)) {
      return new NextResponse("Too many requests. Please wait.", { status: 429 });
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/_next/static/chunks/259_-80ktmhh.css",
    "/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
