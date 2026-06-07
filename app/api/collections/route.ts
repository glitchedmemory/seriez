import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId } from "@/lib/user-utils";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── GET: list collections ───
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = await resolveUsername(req);
  if (!username) return NextResponse.json({ error: "Missing username" }, { status: 400 });

  const userId = await resolveUserId(username);
  if (!userId) return NextResponse.json({ collections: [] });

  const { data, error } = await supabase
    .from("user_lists")
    .select("id, name, is_public, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get item counts for each collection
  const collections = await Promise.all(
    (data || []).map(async (list) => {
      const { count } = await supabase
        .from("list_items")
        .select("id", { count: "exact", head: true })
        .eq("list_id", list.id);
      return { id: list.id, name: list.name, isPublic: list.is_public, itemCount: count || 0, createdAt: list.created_at };
    })
  );

  return NextResponse.json({ collections });
}

// ─── POST: create collection ───
export async function POST(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const body = await req.json();
    const { name } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Missing name" }, { status: 400 });

    const userId = await resolveUserId(username);
    if (!userId) return NextResponse.json({ error: "Failed to resolve user" }, { status: 500 });

    const { data, error } = await supabase
      .from("user_lists")
      .insert({ user_id: userId, name: name.trim().slice(0, 50), is_public: true })
      .select("id, name, is_public, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ id: data.id, name: data.name, isPublic: data.is_public, itemCount: 0, createdAt: data.created_at });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// ─── DELETE: delete collection ───
export async function DELETE(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const body = await req.json();
    const { listId } = body;
    if (!listId) return NextResponse.json({ error: "Missing listId" }, { status: 400 });

    const userId = await resolveUserId(username);
    if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Delete items first, then the list
    await supabase.from("list_items").delete().eq("list_id", listId);
    const { error } = await supabase.from("user_lists").delete().eq("id", listId).eq("user_id", userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
