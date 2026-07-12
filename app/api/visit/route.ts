import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCountry, getDevice } from "@/lib/geo";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tmdbId, mediaType, source, username } = body;

    if (!tmdbId || !mediaType) {
      return NextResponse.json({ error: "Missing tmdbId or mediaType" }, { status: 400 });
    }

    const country = getCountry(req);
    const device = getDevice(req);

    await supabaseAdmin.from("content_visits").insert({
      tmdb_id: tmdbId,
      media_type: mediaType,
      username: username || null,
      source: source || "direct",
      country,
      device,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
