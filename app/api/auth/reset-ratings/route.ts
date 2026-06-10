import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** POST — reset all ratings and review activity */
export async function POST(req: NextRequest) {
  try {
    const { createClient: createServerClient } = await import("@/lib/supabase/server");
    const supabase = await createServerClient();
    const { data: authData } = await supabase.auth.getUser();
    const username = authData.user?.user_metadata?.username;
    const userId = authData.user?.id;
    if (!username || !userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { confirmation } = await req.json();
    if (confirmation !== username) {
      return NextResponse.json({ error: "Type your username to confirm" }, { status: 400 });
    }

    // Delete reviews (ratings + review content)
    const { error: revErr } = await supabaseAdmin
      .from("reviews")
      .delete()
      .eq("username", username);

    if (revErr) {
      return NextResponse.json({ error: "Failed to reset ratings" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
