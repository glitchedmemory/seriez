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
