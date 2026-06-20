import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");
    const userIdParam = searchParams.get("userId");
    const role = searchParams.get("role"); // "director" or "actor" or undefined for all

    if (!username && !userIdParam) {
      return NextResponse.json({ error: "Missing username or userId" }, { status: 400 });
    }

    // Resolve username to UUID
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let userId = userIdParam || null;

    // If no userId param, resolve from username
    if (!userId && username) {
      const { data: userRow } = await adminClient
        .from("users")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      userId = userRow?.id || null;

      // Fallback: if username looks like a UUID, use it directly
      if (!userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username)) {
        userId = username;
      }
    }

    if (!userId) {
      return NextResponse.json({ likes: [] });
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
