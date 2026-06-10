import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Reserved brand names — these and their variants cannot be registered
const RESERVED_NAMES = ["seriez", "glitchedmemory", "admin", "mod", "moderator", "support", "help", "system", "root"];

/** Normalize a string by stripping all non-alpha characters and lowercasing */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

/** Check if a username is too similar to a reserved name */
function isReserved(username: string): string | null {
  const n = normalize(username);
  if (!n) return null;

  for (const reserved of RESERVED_NAMES) {
    const r = normalize(reserved);
    // Exact match (after normalization)
    if (n === r) return reserved;
    // Levenshtein distance ≤ 1 (catches typos, one char diff)
    if (levenshtein(n, r) <= 1) return reserved;
    // Contains reserved name
    if (n.includes(r) || r.includes(n)) return reserved;
  }
  return null;
}

/** Levenshtein distance */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username")?.trim().slice(0, 20);

  if (!username || username.length < 2) {
    return NextResponse.json({ exists: false, error: "Username must be at least 2 characters" });
  }

  // Check reserved names
  const reservedMatch = isReserved(username);
  if (reservedMatch) {
    return NextResponse.json({ exists: true, reserved: true, error: "This username is reserved" });
  }

  // Check public.users table
  const { data } = await supabase
    .from("users")
    .select("username")
    .eq("username", username)
    .maybeSingle();

  return NextResponse.json({ exists: !!data });
}
