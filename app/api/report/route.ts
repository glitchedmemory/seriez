import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { target_type, target_id } = await req.json();
    if (!target_type || !target_id) {
      return NextResponse.json({ error: "target_type and target_id required" }, { status: 400 });
    }

    // Get auth user from cookie
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reporter = user.user_metadata?.username || user.email || "unknown";

    // Insert report
    const { error } = await supabaseAdmin.from("reports").insert({
      reporter_username: reporter,
      target_type,
      target_id,
    });

    // Ignore duplicate (already reported)
    if (error && error.code !== "23505") {
      console.error("Report insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Count total reports for this target
    const { count } = await supabaseAdmin
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq("target_type", target_type)
      .eq("target_id", target_id);

    return NextResponse.json({ report_count: count || 1 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
