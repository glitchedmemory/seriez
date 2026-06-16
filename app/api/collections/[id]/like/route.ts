import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// POST — toggle like on a collection
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await resolveUsername(req);
  if (!username) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { id: listId } = await params;

  // Check if already liked
  const { data: existing } = await supabase
    .from("collection_likes")
    .select("id")
    .eq("list_id", listId)
    .eq("username", username.trim())
    .maybeSingle();

  if (existing) {
    // Unlike
    const { error } = await supabase
      .from("collection_likes")
      .delete()
      .eq("list_id", listId)
      .eq("username", username.trim());
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Get new count
    const { count } = await supabase
      .from("collection_likes")
      .select("*", { count: "exact", head: true })
      .eq("list_id", listId);

    return NextResponse.json({ liked: false, likesCount: count || 0 });
  }

  // Like
  const { error } = await supabase
    .from("collection_likes")
    .insert({ list_id: listId, username: username.trim() });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already liked" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get new count
  const { count } = await supabase
    .from("collection_likes")
    .select("*", { count: "exact", head: true })
    .eq("list_id", listId);

  return NextResponse.json({ liked: true, likesCount: count || 0 });
}
