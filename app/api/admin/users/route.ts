import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername, STAFF_ROLES } from "@/lib/auth-helper";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — fetch user signup list (admin only)
export async function GET(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { data: userData } = await supabaseAdmin
      .from("users").select("role").eq("username", username).maybeSingle();
    if (!STAFF_ROLES.includes(userData?.role || "")) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("username, role, is_premium, created_at, sanction_type, sanction_reason, sanction_until, sanctioned_at, sanctioned_by")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ users });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — permanently delete a user and all associated data (admin only, cannot delete admins)
export async function DELETE(req: NextRequest) {
  try {
    const adminUser = await resolveUsername(req);
    if (!adminUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { data: adminData } = await supabaseAdmin
      .from("users").select("role").eq("username", adminUser).maybeSingle();
    if (adminData?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { username: targetUser } = await req.json();
    if (!targetUser) {
      return NextResponse.json({ error: "username required" }, { status: 400 });
    }

    // Prevent deletion of admin accounts
    const { data: targetData } = await supabaseAdmin
      .from("users").select("id, role, email").eq("username", targetUser).maybeSingle();
    if (!targetData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (targetData.role === "admin") {
      return NextResponse.json({ error: "Cannot delete an admin account" }, { status: 403 });
    }

    const userId = targetData.id;

    // Cascade delete all user data
    const tablesToCleanUser = ["notifications", "search_logs"];
    const tablesToCleanUsername = ["media_trackings", "episode_watches"];
    const tablesToCleanBoth = ["reviews", "review_likes", "collection_comments", "collection_likes"];

    for (const table of tablesToCleanUser) {
      await supabaseAdmin.from(table).delete().eq("user_id", userId);
    }
    for (const table of tablesToCleanUsername) {
      await supabaseAdmin.from(table).delete().eq("username", targetUser);
    }
    for (const table of tablesToCleanBoth) {
      await supabaseAdmin.from(table).delete().eq("user_id", userId);
      await supabaseAdmin.from(table).delete().eq("username", targetUser);
    }

    await supabaseAdmin.from("review_comments").delete().eq("user_id", userId);
    await supabaseAdmin.from("comment_likes").delete().eq("user_id", userId);
    await supabaseAdmin.from("reports").delete().eq("reporter_username", targetUser);
    await supabaseAdmin.from("follows").delete().eq("follower_id", userId);
    await supabaseAdmin.from("follows").delete().eq("following_id", userId);

    const { data: lists } = await supabaseAdmin.from("user_lists").select("id").eq("user_id", userId);
    if (lists) {
      for (const list of lists) {
        await supabaseAdmin.from("list_items").delete().eq("list_id", list.id);
      }
    }
    await supabaseAdmin.from("user_lists").delete().eq("user_id", userId);

    // Delete from users table
    await supabaseAdmin.from("users").delete().eq("username", targetUser);

    // Delete from Auth
    await supabaseAdmin.auth.admin.deleteUser(userId);

    // Audit log
    const { logAdminAction } = await import("@/lib/audit-log");
    logAdminAction(adminUser, "delete_user", "user", targetUser, {});

    return NextResponse.json({ ok: true, deleted: targetUser });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
