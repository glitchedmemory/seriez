// TEMPORARY — run once then delete
// Hit: GET /api/migrate-background-url
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Try adding column via raw SQL through the REST API
    const { error } = await supabaseAdmin
      .from("users")
      .update({ avatarUrl: null }) // dummy update to test
      .eq("username", "__no_such_user__");

    // Try creating the column by upserting a user with backgroundUrl set
    // This won't create the column — need different approach
    
    // Use the raw SQL approach via supabase-js rpc
    // Call the built-in Supabase function if available
    const { error: rpcErr } = await supabaseAdmin.rpc("exec", { 
      query: "ALTER TABLE users ADD COLUMN IF NOT EXISTS background_url text" 
    });
    
    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message, hint: rpcErr.hint }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
