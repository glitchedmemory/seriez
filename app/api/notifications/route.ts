import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ notifications: [], unread: 0 });
    }

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unread") === "true";

    let query = supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("target_username", username.trim().slice(0, 20))
      .order("created_at", { ascending: false })
      .limit(50);

    if (unreadOnly) {
      query = query.eq("read", false);
    }

    const { data, error } = await query;

    if (error) {
      if (error.message.includes("does not exist")) {
        return NextResponse.json({ notifications: [], unread: 0 });
      }
      throw error;
    }

    const unread = (data || []).filter((n: any) => !n.read).length;
    return NextResponse.json({ notifications: data || [], unread });
  } catch (err: any) {
    return NextResponse.json({ notifications: [], unread: 0, error: err?.message });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { id, mark_all_read } = body;

    if (mark_all_read) {
      const { error } = await supabaseAdmin
        .from("notifications")
        .update({ read: true })
        .eq("target_username", username.trim().slice(0, 20))
        .eq("read", false);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (id) {
      const { error } = await supabaseAdmin
        .from("notifications")
        .update({ read: true })
        .eq("id", id)
        .eq("target_username", username.trim().slice(0, 20));

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "id or mark_all_read required" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("target_username", username.trim().slice(0, 20));

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
