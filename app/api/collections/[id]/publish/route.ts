import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId } from "@/lib/user-utils";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// POST — publish a collection (toggle)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await resolveUsername(req);
  if (!username) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const userId = await resolveUserId(username);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id: listId } = await params;

  // Verify ownership
  const { data: list } = await supabase
    .from("user_lists").select("user_id, name, is_published").eq("id", listId).single();
  if (!list) return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  if (list.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Premium check — only Golden Ticket members can publish
  const { data: premiumRow } = await supabase
    .from("users").select("is_premium").eq("username", username).maybeSingle();
  if (!premiumRow?.is_premium) {
    return NextResponse.json({ error: "Golden Ticket required to publish collections. Upgrade at /pro" }, { status: 402 });
  }

  // Count items
  const { count } = await supabase
    .from("list_items").select("*", { count: "exact", head: true }).eq("list_id", listId);

  if (!list.is_published && (count || 0) < 4) {
    return NextResponse.json({ error: "Need at least 4 items to publish" }, { status: 400 });
  }

  // Toggle
  const newState = !list.is_published;
  const { error } = await supabase
    .from("user_lists")
    .update({
      is_published: newState,
      published_at: newState ? new Date().toISOString() : null,
    })
    .eq("id", listId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    isPublished: newState,
    message: newState ? "Published" : "Now private",
  });
}
