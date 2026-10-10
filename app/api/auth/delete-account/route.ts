import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { deleteUserData } from "@/lib/delete-user-data";

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

    // Prevent deletion of admin accounts
    const { data: userRecord } = await supabaseAdmin
      .from("users").select("role").eq("username", username).maybeSingle();
    if (userRecord?.role === "admin") {
      return NextResponse.json({ error: "Admin accounts cannot be deleted" }, { status: 403 });
    }

    // Log deletion for admin tracking
    await supabaseAdmin.from("deleted_users").insert({ username });

    // 표마다 사용자를 가리키는 칸이 달라서 공용 정리 함수로 지운다.
    const cleanup = await deleteUserData(userId, username);
    if (cleanup.failures.length > 0) {
      console.error("[delete-account] cleanup failures:", cleanup.failures);
    }

    // Delete from users table
    await supabaseAdmin.from("users").delete().eq("username", username);

    // Delete from Auth
    await supabaseAdmin.auth.admin.deleteUser(userId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
