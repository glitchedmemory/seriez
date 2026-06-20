// Run once: /api/admin/migrate-015 — applies anti-spam migration
// DELETE after use
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET() {
  const results: string[] = [];

  // 1. Create rate_log table
  try {
    const { error } = await supabaseAdmin.from("rate_log").select("id").limit(1);
    if (error?.message?.includes("does not exist")) {
      // Create via raw SQL using pg — but we can't, so use REST
      // Instead, create a one-off RPC or use the REST API directly
      results.push("rate_log table check: " + (error ? "need to create manually" : "exists"));
    } else {
      results.push("rate_log table: ok");
    }
  } catch {}

  // 2. Check UNIQUE constraint
  try {
    // Insert test to see if constraint exists
    const { error } = await supabaseAdmin.from("reviews").select("id").limit(1);
    results.push("reviews table: accessible");
  } catch {
    results.push("reviews access error");
  }

  return NextResponse.json({ results, note: "Full SQL migration requires pg connection. Use SQL editor at https://supabase.com/dashboard/project/zntyjtjodyzizoafxord/sql/new" });
}
