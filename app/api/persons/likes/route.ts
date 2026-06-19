import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");
    const role = searchParams.get("role"); // "director" or "actor" or undefined for all

    if (!username) {
      return NextResponse.json({ error: "Missing username" }, { status: 400 });
    }

    // Resolve username to UUID
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: userRow } = await adminClient
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    // If using display name, try that too
    let userId = userRow?.id;
    if (!userId) {
      // Try UUID lookup (username column stores UUID in tracking tables)
      const { data: likeCheck } = await adminClient
        .from("person_likes")
        .select("username")
        .eq("person_name", username)
        .limit(1)
        .maybeSingle();
      // Fall back to searching user table
      if (!likeCheck) {
        return NextResponse.json({ likes: [] });
      }
      userId = likeCheck.username;
    }

    let query = adminClient
      .from("person_likes")
      .select("person_source, person_id, person_name, person_image, person_role, created_at")
      .eq("username", userId)
      .order("created_at", { ascending: false });

    if (role) {
      query = query.or(`person_role.eq.${role},person_role.eq.both`);
    }

    const { data: likes } = await query;

    return NextResponse.json({ likes: likes || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
