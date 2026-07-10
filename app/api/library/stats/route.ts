import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId } from "@/lib/user-utils";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const username = new URL(req.url).searchParams.get("username") || await resolveUsername(req);
  if (!username) return NextResponse.json({ error: "Missing username" }, { status: 400 });

  const userId = await resolveUserId(username);
  if (!userId) return NextResponse.json({ completed: 0, watching: 0, plan_to_watch: 0 });

  const { data, error } = await supabaseAdmin
    .from("media_trackings")
    .select("status")
    .eq("username", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts = { completed: 0, watching: 0, plan_to_watch: 0 };
  for (const row of data || []) {
    if (row.status in counts) (counts as any)[row.status]++;
  }

  return NextResponse.json(counts);
}
