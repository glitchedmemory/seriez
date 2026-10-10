import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { upsertCustomPoster } from "@/lib/custom-posters";
import { resolveUsername, STAFF_ROLES } from "@/lib/auth-helper";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // 운영자 이상만 포스터를 바꿀 수 있다.
    const adminUser = await resolveUsername(request);
    if (!adminUser) return NextResponse.json({ error: "Auth required" }, { status: 401 });
    const { data: adminData } = await supabaseAdmin
      .from("users").select("role").eq("username", adminUser).maybeSingle();
    if (!STAFF_ROLES.includes(adminData?.role || "")) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await request.json();
    const { tmdbId, posterUrl, mediaType } = body;

    if (!tmdbId || !posterUrl) {
      return NextResponse.json(
        { error: "Missing tmdbId or posterUrl" },
        { status: 400 }
      );
    }

    if (!posterUrl.startsWith("http")) {
      return NextResponse.json(
        { error: "posterUrl must be a valid URL" },
        { status: 400 }
      );
    }

    const result = await upsertCustomPoster(
      tmdbId,
      posterUrl,
      mediaType || "tv"
    );

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Upload failed" },
      { status: 500 }
    );
  }
}
