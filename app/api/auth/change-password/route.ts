import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** POST — change password (server-side, session preserved) */
export async function POST(req: NextRequest) {
  try {
    const { createClient: createServerClient } = await import("@/lib/supabase/server");
    const supabase = await createServerClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Both current and new password required" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    if (currentPassword === newPassword) {
      return NextResponse.json({ error: "New password must differ from current" }, { status: 400 });
    }

    // Verify current password by attempting sign-in
    const { error: signInErr } = await supabaseAdmin.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInErr) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
    }

    // Change password via admin API (keeps existing sessions alive)
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message || "Password change failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
