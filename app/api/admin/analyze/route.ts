import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// AI analysis prompt
const SYSTEM_PROMPT = `You are a content moderator for a movie/TV review site. Analyze the given content and classify it.

Output ONLY one of these verdicts (just the tag, no explanation):

✅ RESTORE — Clean content, wrongly reported (opinion, fair criticism, normal discussion)
⚠️ BORDERLINE — Controversial but not clearly violating rules (harsh but not abusive, spoilers, heated debate)
❌ DELETE — Clear violation (hate speech, harassment, spam, explicit content, threats, impersonation)

Content to analyze:`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, target_type, target_id } = body;

    if (!content) {
      return NextResponse.json({ error: "content required" }, { status: 400 });
    }

    // Use DeepSeek API for analysis
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      // Fallback: basic heuristic
      const verdict = heuristicAnalyze(content);
      return NextResponse.json({ verdict });
    }

    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: content.slice(0, 2000) },
        ],
        max_tokens: 20,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      // Fallback to heuristic
      const verdict = heuristicAnalyze(content);
      // Store verdict
      if (target_type && target_id) {
        const table = target_type === "review" ? "reviews" : "review_comments";
        const idCol = target_type === "review" ? "id" : "id";
        await supabaseAdmin.from(table).update({ ai_verdict: verdict }).eq(idCol, target_type === "comment" ? parseInt(target_id) : target_id);
      }
      return NextResponse.json({ verdict });
    }

    const data = await res.json();
    const verdict = data.choices?.[0]?.message?.content?.trim() || "⚠️ BORDERLINE — analysis failed";

    // Store verdict in DB
    if (target_type && target_id) {
      const table = target_type === "review" ? "reviews" : "review_comments";
      const idCol = target_type === "review" ? "id" : "id";
      await supabaseAdmin.from(table).update({ ai_verdict: verdict }).eq(idCol, target_type === "comment" ? parseInt(target_id) : target_id);
    }

    return NextResponse.json({ verdict });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Analysis failed" }, { status: 500 });
  }
}

function heuristicAnalyze(content: string): string {
  const lower = content.toLowerCase();

  // Spam patterns
  const spamPatterns = [
    "buy now", "click here", "free money", "earn money", "make money fast",
    "http://", "https://", "www.", ".com", "subscribe", "follow me",
    "check my profile", "dm me", "message me",
  ];
  const spamCount = spamPatterns.filter((p) => lower.includes(p)).length;
  if (spamCount >= 3) return "❌ DELETE — spam detected";

  // Hate/abuse patterns
  const hateWords = [
    "kill yourself", "kys", "die", "hate", "stupid idiot", "moron",
    "retard", "garbage", "trash human", "worthless",
  ];
  const hateCount = hateWords.filter((w) => lower.includes(w)).length;
  if (hateCount >= 2) return "❌ DELETE — hate speech / harassment";

  // Single swear word — borderline
  const swears = ["fuck", "shit", "asshole", "bitch", "damn"];
  const swearCount = swears.filter((s) => lower.includes(s)).length;
  if (swearCount >= 2) return "⚠️ BORDERLINE — strong language";

  // Very short meaningless content (spam)
  if (content.length < 5) return "❌ DELETE — too short / spam";

  // Default: restore
  return "✅ RESTORE — likely false report";
}
