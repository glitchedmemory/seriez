import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername, STAFF_ROLES } from "@/lib/auth-helper";
import { deleteUserData } from "@/lib/delete-user-data";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — fetch user signup list (admin only), or single user if ?username= provided
export async function GET(req: NextRequest) {
  try {
    const authUsername = await resolveUsername(req);
    if (!authUsername) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { data: userData } = await supabaseAdmin
      .from("users").select("role").eq("username", authUsername).maybeSingle();
    if (!STAFF_ROLES.includes(userData?.role || "")) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // If ?username= is provided, return just that user (used by TabBar/Sidebar role check)
    const targetUsername = req.nextUrl.searchParams.get("username");
    if (targetUsername) {
      const { data: target, error } = await supabaseAdmin
        .from("users")
        .select("username, role, is_premium, created_at, sanction_type, sanction_reason, sanction_until, sanctioned_at, sanctioned_by")
        .eq("username", targetUsername)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ users: target ? [target] : [] });
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

    // 표마다 사용자를 가리키는 칸이 달라서 공용 정리 함수로 지운다.
    const cleanup = await deleteUserData(userId, targetUser);
    if (cleanup.failures.length > 0) {
      console.error("[admin delete-user] cleanup failures:", cleanup.failures);
    }

    // Delete from users table
    await supabaseAdmin.from("users").delete().eq("username", targetUser);

    // Delete from Auth
    await supabaseAdmin.auth.admin.deleteUser(userId);

    // 삭제 기록 (대시보드 집계에 쓰인다)
    await supabaseAdmin.from("deleted_users").insert({ username: targetUser });

    // Audit log
    const { logAdminAction } = await import("@/lib/audit-log");
    logAdminAction(adminUser, "delete_user", "user", targetUser, {});

    return NextResponse.json({ ok: true, deleted: targetUser, cleanup });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
