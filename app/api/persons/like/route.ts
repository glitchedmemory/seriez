import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { personSource, personId, personName, personImage, personRole } = body;

    if (!personSource || !personId || !personName || !personRole) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get authenticated user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if already liked
    const { data: existing } = await adminClient
      .from("person_likes")
      .select("id")
      .eq("username", userId)
      .eq("person_source", personSource)
      .eq("person_id", personId)
      .maybeSingle();

    if (existing) {
      // Unlike
      await adminClient
        .from("person_likes")
        .delete()
        .eq("id", existing.id);
    } else {
      // Like
      await adminClient
        .from("person_likes")
        .insert({
          username: userId,
          person_source: personSource,
          person_id: personId,
          person_name: personName,
          person_image: personImage || null,
          person_role: personRole,
        });
    }

    // Get updated count
    const { count } = await adminClient
      .from("person_likes")
      .select("*", { count: "exact", head: true })
      .eq("person_source", personSource)
      .eq("person_id", personId);

    return NextResponse.json({
      liked: !existing,
      count: count || 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
