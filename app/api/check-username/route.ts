import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ponytail: in-memory rate limit, per-IP tracking. 10 req / 10s per IP. Map auto-grows but
// welcome-page users are single-session; switch to Redis if this ever goes multi-instance.
const rateMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const window = rateMap.get(ip) || [];
  const recent = window.filter(t => now - t < 10_000); // last 10 seconds
  rateMap.set(ip, recent);
  return recent.length >= 10;
}

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }
  rateMap.get(ip)!.push(Date.now());

  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username")?.trim();

  if (!username || username.length < 3) {
    return NextResponse.json({ available: false, reason: "too_short" });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return NextResponse.json({ available: false, reason: "invalid_chars" });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase
    .from("users")
    .select("username")
    .eq("username", username)
    .maybeSingle();

  return NextResponse.json({ available: !data });
}
