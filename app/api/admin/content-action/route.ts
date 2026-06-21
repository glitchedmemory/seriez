import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername } from "@/lib/auth-helper";
import { logAdminAction } from "@/lib/audit-log";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ACTIONS: Record<string, { verb: string; auditAction: "hide_content" | "restore_content" | "delete_content" }> = {
  hide:    { verb: "hide",    auditAction: "hide_content" },
  restore: { verb: "restore", auditAction: "restore_content" },
  delete:  { verb: "delete",  auditAction: "delete_content" },
};

export async function GET(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { data: userData } = await supabaseAdmin
      .from("users").select("role").eq("username", username).maybeSingle();
    if (userData?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    if (!action || !type || !id) {
      return NextResponse.json({ error: "action, type, id required" }, { status: 400 });
    }

    const config = ACTIONS[action];
    if (!config) return NextResponse.json({ error: "Invalid action. Use: hide, restore, delete" }, { status: 400 });

    if (type === "collection") {
      // Handle collection actions
      const table = "user_lists";

      if (action === "delete") {
        const { data: itemData } = await supabaseAdmin
          .from(table).select("user_id, name").eq("id", id).maybeSingle();

        // Delete list items first
        await supabaseAdmin.from("list_items").delete().eq("list_id", id);

        const { error } = await supabaseAdmin.from(table).delete().eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        logAdminAction(username, "delete_content", "collection", id, {
          collection_name: itemData?.name || "unknown",
          collection_owner: itemData?.user_id || "unknown",
        });
      } else {
        const isHidden = action === "hide";
        const { data: itemData } = await supabaseAdmin
          .from(table).select("user_id, name").eq("id", id).maybeSingle();

        const { error } = await supabaseAdmin.from(table).update({ is_hidden: isHidden }).eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        logAdminAction(username, config.auditAction, "collection", id, {
          collection_name: itemData?.name || "unknown",
          collection_owner: itemData?.user_id || "unknown",
        });
      }

      return NextResponse.json({ ok: true });
    }

    // Original review/comment handling
    const table = type === "review" ? "reviews" : "review_comments";

    if (action === "delete") {
      const { data: itemData } = await supabaseAdmin
        .from(table).select("username, content").eq("id", id).maybeSingle();

      const { error } = await supabaseAdmin.from(table).delete().eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      logAdminAction(username, "delete_content", type as "review" | "comment", id, {
        content_author: itemData?.username || "unknown",
        content_preview: (itemData?.content || "").substring(0, 200),
      });
    } else {
      const isHidden = action === "hide";
      const { data: itemData } = await supabaseAdmin
        .from(table).select("username, content").eq("id", id).maybeSingle();

      const { error } = await supabaseAdmin.from(table).update({ is_hidden: isHidden }).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      logAdminAction(username, config.auditAction, type as "review" | "comment", id, {
        content_author: itemData?.username || "unknown",
        content_preview: (itemData?.content || "").substring(0, 200),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
