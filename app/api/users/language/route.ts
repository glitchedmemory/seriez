import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { language } = await req.json();
    const validLocales = ["en", "ko", "ja", "zh", "fr", "de", "es"];
    if (!language || !validLocales.includes(language)) {
      return NextResponse.json({ error: "Invalid language" }, { status: 400 });
    }

    // Update in Supabase users table
    const { error } = await supabase
      .from("users")
      .update({ language })
      .eq("id", user.id);

    if (error) throw error;

    // Set cookie for immediate effect
    const response = NextResponse.json({ ok: true });
    response.cookies.set("NEXT_LOCALE", language, {
      path: "/",
      maxAge: 365 * 24 * 60 * 60, // 1 year
      sameSite: "lax",
    });

    return response;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
