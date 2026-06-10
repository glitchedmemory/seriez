import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** POST — permanently delete account and all associated data */
export async function POST(req: NextRequest) {
  try {
    const { createClient: createServerClient } = await import("@/lib/supabase/server");
    const supabase = await createServerClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    const username = user?.user_metadata?.username;
    const userId = user?.id;
    const email = user?.email;
    if (!username || !userId || !email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { password, confirmation } = await req.json();
    if (!password) {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }
    if (confirmation !== username) {
      return NextResponse.json({ error: "Type your username to confirm" }, { status: 400 });
    }

    // Verify password
    const { error: signInErr } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr) {
      return NextResponse.json({ error: "Password is incorrect" }, { status: 403 });
    }

    // Delete all user data from every table
    const tablesToCleanUser = ["media_trackings", "episode_watches", "notifications", "search_logs"];
    const tablesToCleanUsername = [] as string[];
    const tablesToCleanBoth = ["reviews", "review_likes", "collection_comments", "collection_likes"];

    for (const table of tablesToCleanUser) {
      await supabaseAdmin.from(table).delete().eq("user_id", userId);
    }
    for (const table of tablesToCleanBoth) {
      await supabaseAdmin.from(table).delete().eq("user_id", userId);
      await supabaseAdmin.from(table).delete().eq("username", username);
    }

    // review_comments, comment_likes (user_id only)
    await supabaseAdmin.from("review_comments").delete().eq("user_id", userId);
    await supabaseAdmin.from("comment_likes").delete().eq("user_id", userId);
    // reports
    await supabaseAdmin.from("reports").delete().eq("reporter_id", userId);
    // follows
    await supabaseAdmin.from("follows").delete().eq("follower_id", userId);
    await supabaseAdmin.from("follows").delete().eq("following_id", userId);
    // user_lists → list_items first
    const { data: lists } = await supabaseAdmin.from("user_lists").select("id").eq("user_id", userId);
    if (lists) {
      for (const list of lists) {
        await supabaseAdmin.from("list_items").delete().eq("list_id", list.id);
      }
    }
    await supabaseAdmin.from("user_lists").delete().eq("user_id", userId);

    // Delete from users table
    await supabaseAdmin.from("users").delete().eq("username", username);

    // Delete from Auth
    await supabaseAdmin.auth.admin.deleteUser(userId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
