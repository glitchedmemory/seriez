import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername } from "@/lib/auth-helper";
import { logAdminAction } from "@/lib/audit-log";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_TYPES = ["warned", "suspended", "banned", "comment_restricted"];

export async function GET(req: NextRequest) {
  const username = await resolveUsername(req);
  if (!username) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const target = searchParams.get("username") || username;

  if (target !== username) {
    const { data: adminData } = await supabaseAdmin
      .from("users").select("role").eq("username", username).maybeSingle();
    if (!adminData || adminData.role === "user") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("username, sanction_type, sanction_reason, sanction_until, sanctioned_at, sanctioned_by")
    .eq("username", target)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (data.sanction_type === "suspended" && data.sanction_until && new Date(data.sanction_until) < new Date()) {
    await supabaseAdmin.from("users").update({
      sanction_type: null, sanction_reason: null,
      sanction_until: null, sanctioned_at: null, sanctioned_by: null,
    }).eq("username", target);
    return NextResponse.json({ username: target, sanction_type: null });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  try {
    const adminUser = await resolveUsername(req);
    if (!adminUser) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { data: adminData } = await supabaseAdmin
      .from("users").select("role").eq("username", adminUser).maybeSingle();
    if (adminData?.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { username: targetUser, sanction_type, reason, duration_hours, duration_days, duration_months } = body;

    if (!targetUser || !sanction_type || !VALID_TYPES.includes(sanction_type)) {
      return NextResponse.json({ error: "Invalid request. Required: username, sanction_type (warned|suspended|banned|comment_restricted)" }, { status: 400 });
    }

    const { data: targetData } = await supabaseAdmin
      .from("users").select("role").eq("username", targetUser).maybeSingle();
    if (!targetData) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (targetData.role === "admin") {
      return NextResponse.json({ error: "Cannot sanction another admin" }, { status: 403 });
    }

    // Compute total hours from any duration unit
    const totalHours = (duration_hours || 0) + (duration_days || 0) * 24 + (duration_months || 0) * 720;
    const until = (sanction_type === "suspended" && totalHours > 0)
      ? new Date(Date.now() + totalHours * 3600000).toISOString()
      : null;

    const { error } = await supabaseAdmin
      .from("users")
      .update({
        sanction_type,
        sanction_reason: reason || null,
        sanction_until: until,
        sanctioned_at: new Date().toISOString(),
        sanctioned_by: adminUser,
      })
      .eq("username", targetUser);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Audit log
    logAdminAction(adminUser, "sanction", "user", targetUser, {
      sanction_type, reason: reason || null, duration_hours: duration_hours || null
    });

    return NextResponse.json({ ok: true, target: targetUser, sanction_type, until });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const adminUser = await resolveUsername(req);
    if (!adminUser) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { data: adminData } = await supabaseAdmin
      .from("users").select("role").eq("username", adminUser).maybeSingle();
    if (adminData?.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { username: targetUser } = body;

    if (!targetUser) {
      return NextResponse.json({ error: "username required" }, { status: 400 });
    }

    // Get previous sanction info for audit
    const { data: prevData } = await supabaseAdmin
      .from("users").select("sanction_type, sanction_reason")
      .eq("username", targetUser).maybeSingle();

    const { error } = await supabaseAdmin
      .from("users")
      .update({
        sanction_type: null,
        sanction_reason: null,
        sanction_until: null,
        sanctioned_at: null,
        sanctioned_by: null,
      })
      .eq("username", targetUser);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Audit log
    logAdminAction(adminUser, "unsanction", "user", targetUser, {
      previous_sanction: prevData?.sanction_type || "unknown",
      previous_reason: prevData?.sanction_reason || null,
    });

    return NextResponse.json({ ok: true, target: targetUser, unsanctioned: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
