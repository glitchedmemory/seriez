import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = await resolveUsername(req);
  if (!username) {
    return NextResponse.json({ error: "Sign in to report" }, { status: 401 });
  }

  const { id: collectionId } = await params;
  const { commentId } = await req.json().catch(() => ({}));
  if (!commentId) return NextResponse.json({ error: "Missing commentId" }, { status: 400 });

  // Verify comment exists and belongs to this collection
  const { data: comment } = await supabase
    .from("collection_comments")
    .select("id, username")
    .eq("id", commentId)
    .eq("collection_id", collectionId)
    .single();

  if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

  // Don't let users report themselves
  if (comment.username === username) {
    return NextResponse.json({ error: "Cannot report your own comment" }, { status: 400 });
  }

  const { error } = await supabase
    .from("reports")
    .upsert(
      { target_type: "collection_comment", target_id: commentId, reporter_username: username },
      { onConflict: "target_type,target_id,reporter_username" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
