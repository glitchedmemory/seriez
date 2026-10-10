import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername, STAFF_ROLES } from "@/lib/auth-helper";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Simple content analysis without external LLM call
// Classifies based on keyword/pattern heuristics
function analyzeContent(content: string): string {
  const lower = content.toLowerCase();

  // Spam / self-promotion
  const spamPatterns = [
    "http://", "https://", "subscribe", "follow me", "check out my",
    "buy now", "click here", "free money", "earn money",
  ];
  const spamHits = spamPatterns.filter((p) => lower.includes(p));
  if (spamHits.length >= 2) return `🚫 SPAM — Contains ${spamHits.length} promotional/spam signals`;

  // Harassment / hate
  const hateWords = ["fuck", "shit", "bastard", "idiot", "stupid", "dumb", "kill yourself", "kys"];
  const hateHits = hateWords.filter((w) => lower.includes(w));
  if (hateHits.length >= 3) return "⚠️ HARASSMENT — Contains multiple offensive/abusive terms";

  // Spoiler
  const spoilerWords = ["dies", "dead", "killed", "ending is", "twist is", "reveal", "plot twist"];
  const spoilerHits = spoilerWords.filter((w) => lower.includes(w));
  if (spoilerHits.length >= 1 && content.length < 200) return "🔮 SPOILER — May reveal plot details";

  // Off-topic / irrelevant
  if (content.length < 10) return "📭 LOW EFFORT — Very short, likely not a real review";
  if (content.length > 2000) return "📜 EXCESSIVE LENGTH — Unusually long content";

  // Single offensive word
  if (hateHits.length >= 1) return "⚠️ MILD OFFENSE — Contains 1-2 potentially offensive terms";

  return "✅ REVIEW — No clear violation detected, may need manual review";
}

export async function POST(req: NextRequest) {
  try {
    // 운영자 이상만 호출할 수 있다.
    const adminUser = await resolveUsername(req);
    if (!adminUser) return NextResponse.json({ error: "Auth required" }, { status: 401 });
    const { data: adminData } = await supabaseAdmin
      .from("users").select("role").eq("username", adminUser).maybeSingle();
    if (!STAFF_ROLES.includes(adminData?.role || "")) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { content } = await req.json();
    if (!content) {
      return NextResponse.json({ error: "content required" }, { status: 400 });
    }

    const verdict = analyzeContent(content);
    return NextResponse.json({ verdict });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
