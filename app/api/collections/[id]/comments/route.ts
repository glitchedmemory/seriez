import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── GET: list comments for a collection ───
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: collectionId } = await params;

  const { data: comments, error } = await supabase
    .from("collection_comments")
    .select("id, username, content, created_at")
    .eq("collection_id", collectionId)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comments });
}

// ─── POST: add a comment (auth required) ───
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await resolveUsername(req);
  if (!username) {
    return NextResponse.json({ error: "Sign in to comment" }, { status: 401 });
  }

  const { id: collectionId } = await params;
  let body: { content?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content = body.content?.trim();
  if (!content) return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
  if (content.length > 200) return NextResponse.json({ error: "Comment too long (max 200)" }, { status: 400 });

  // Verify collection exists
  const { data: list } = await supabase
    .from("user_lists").select("id").eq("id", collectionId).single();
  if (!list) return NextResponse.json({ error: "Collection not found" }, { status: 404 });

  const { data: comment, error } = await supabase
    .from("collection_comments")
    .insert({ collection_id: collectionId, username, content })
    .select("id, username, content, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comment });
}

// ─── DELETE: remove a comment (owner only) ───
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await resolveUsername(req);
  if (!username) {
    return NextResponse.json({ error: "Sign in to delete" }, { status: 401 });
  }

  const { id: collectionId } = await params;
  const commentId = new URL(req.url).searchParams.get("commentId");
  if (!commentId) return NextResponse.json({ error: "Missing commentId" }, { status: 400 });

  const { error } = await supabase
    .from("collection_comments")
    .delete()
    .eq("id", commentId)
    .eq("collection_id", collectionId)
    .eq("username", username);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
