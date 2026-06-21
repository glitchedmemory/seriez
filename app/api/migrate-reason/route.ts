import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// One-time migration: add reason column to reports table
export async function POST() {
  try {
    const { error } = await supabaseAdmin.rpc("exec_sql", {
      sql: 'ALTER TABLE reports ADD COLUMN IF NOT EXISTS reason TEXT;'
    }).maybeSingle();

    if (error) {
      // Try direct SQL via raw query
      const { error: rawErr } = await supabaseAdmin
        .from("reports")
        .select("reason")
        .limit(1);

      if (rawErr) {
        return NextResponse.json({
          status: "failed",
          error: rawErr.message,
          hint: "Run manually: ALTER TABLE reports ADD COLUMN IF NOT EXISTS reason TEXT;"
        });
      }

      return NextResponse.json({ status: "already_exists" });
    }

    return NextResponse.json({ status: "ok" });
  } catch (err: any) {
    return NextResponse.json({ status: "error", error: err.message });
  }
}
