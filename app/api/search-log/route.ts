import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCountry } from "@/lib/geo";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Create table lazily on first use
let tableCreated = false;
async function ensureTable() {
  if (tableCreated) return;
  try {
    await supabaseAdmin.rpc("create_search_logs_table").maybeSingle();
  } catch {
    // rpc doesn't exist, try raw SQL via REST
    try {
      const { error } = await supabaseAdmin.from("search_logs").select("count").limit(1);
      if (error) {
        await fetch(`${supabaseUrl}/rest/v1/rpc/create_search_logs_table`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
        });
      }
    } catch {
      // Silently fail — table must be created manually
    }
  }
  tableCreated = true;
}

export async function POST(req: NextRequest) {
  await ensureTable();
  try {
    const { query, tmdbId, mediaType, clickedTmdbId } = await req.json();
    if (!query) return NextResponse.json({ error: "Missing query" }, { status: 400 });
    const trimmed = query.trim().slice(0, 200);
    if (!trimmed) return NextResponse.json({ error: "Empty query" }, { status: 400 });

    const country = getCountry(req);

    await supabaseAdmin.from("search_logs").insert({
      query: trimmed,
      tmdb_id: tmdbId || null,
      media_type: mediaType || null,
      clicked_tmdb_id: clickedTmdbId || null,
      country,
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
