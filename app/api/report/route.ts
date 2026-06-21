import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkSanction, getSanctionError } from "@/lib/sanction-utils";

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_TARGETS = ["review", "comment", "collection"];
const HIGH_RISK_REASONS = ["spam", "obscenity", "hate_speech"];
const NORMAL_THRESHOLD = 3; // auto-hide after 3 normal reports

export async function POST(req: NextRequest) {
  try {
    const { target_type, target_id, username, reason } = await req.json();
    if (!target_type || !target_id || !username) {
      return NextResponse.json({ error: "target_type, target_id, and username required" }, { status: 400 });
    }
    if (!VALID_TARGETS.includes(target_type)) {
      return NextResponse.json({ error: "target_type must be review, comment, or collection" }, { status: 400 });
    }

    // Sanction check
    const sanction = await checkSanction(username);
    const sanctionErr = getSanctionError(sanction, "write");
    if (sanctionErr) return NextResponse.json({ error: sanctionErr }, { status: 403 });

    const reporter = username.trim();

    const insertData: Record<string, any> = {
      reporter_username: reporter,
      target_type,
      target_id,
      reason: reason || "other",
    };

    const { error: insertErr } = await supabaseAdmin.from("reports").insert(insertData);

    // 23505 = unique violation (already reported) — not an error
    if (insertErr && insertErr.code !== "23505") {
      console.error("Report insert error:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Count total reports for this target
    const { count, error: countErr } = await supabaseAdmin
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq("target_type", target_type)
      .eq("target_id", target_id);

    if (countErr) {
      console.error("Report count error:", countErr);
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }

    const reportCount = count || 1;
    const isHighRisk = HIGH_RISK_REASONS.includes(reason);

    // Smart auto-hide:
    // - High-risk reasons (spam, obscenity, hate_speech): auto-hide on 1st report
    // - Normal reasons: auto-hide after NORMAL_THRESHOLD reports
    const shouldHide = isHighRisk || reportCount >= NORMAL_THRESHOLD;

    if (shouldHide) {
      const tableMap: Record<string, string> = {
        review: "reviews",
        comment: "review_comments",
        collection: "user_lists",
      };
      const table = tableMap[target_type];
      const idCol = "id";

      if (table) {
        const { error: hideErr } = await supabaseAdmin
          .from(table)
          .update({ is_hidden: true })
          .eq(idCol, target_id);

        if (hideErr) {
          console.error(`Auto-hide ${target_type} error:`, hideErr);
        }
      }
    }

    return NextResponse.json({
      report_count: reportCount,
      auto_hidden: shouldHide,
      risk_level: isHighRisk ? "high" : "normal",
    });
  } catch (err: any) {
    console.error("Report API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
