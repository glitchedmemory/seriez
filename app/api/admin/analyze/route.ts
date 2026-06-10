import { NextRequest, NextResponse } from "next/server";

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
