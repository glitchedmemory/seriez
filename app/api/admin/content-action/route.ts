import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    const table = type === "review" ? "reviews" : "review_comments";
    const isHidden = action === "hide";

    const { error } = await supabaseAdmin
      .from(table)
      .update({ is_hidden: isHidden })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
