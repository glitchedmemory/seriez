import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source");
  const id = searchParams.get("id");

  if (!source || !id) {
    return NextResponse.json({ count: 0 });
  }

  const personId = parseInt(id, 10);
  if (isNaN(personId)) {
    return NextResponse.json({ count: 0 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { count } = await adminClient
    .from("person_likes")
    .select("*", { count: "exact", head: true })
    .eq("person_source", source)
    .eq("person_id", personId);

  return NextResponse.json({ count: count || 0 });
}
