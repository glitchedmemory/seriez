import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername } from "@/lib/auth-helper";
import { resolveUserId } from "@/lib/user-utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE = "https://image.tmdb.org/t/p/w342";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username: target } = await params;
  const { searchParams } = new URL(req.url);
  const me = searchParams.get("me") || await resolveUsername(req);
  if (!me) return NextResponse.json({ error: "Sign in" }, { status: 401 });

  // Resolve usernames to UUIDs (media_trackings.username stores UUIDs)
  const myUserId = await resolveUserId(me);
  const targetUserId = await resolveUserId(target);
  if (!myUserId || !targetUserId) return NextResponse.json({ matchRate: 0, bothEnjoyed: [], divergent: [] });

  // Get both users' rated titles with ratings
  const { data: myRatings } = await supabaseAdmin
    .from("media_trackings")
    .select("tmdb_id, media_type, rating")
    .eq("username", myUserId)
    .not("rating", "is", null);
  const { data: theirRatings } = await supabaseAdmin
    .from("media_trackings")
    .select("tmdb_id, media_type, rating")
    .eq("username", targetUserId)
    .not("rating", "is", null);

  if (!theirRatings?.length) return NextResponse.json({ matchRate: 0, bothEnjoyed: [], divergent: [] });

  // Index by key
  const myMap = new Map<string, number>();
  for (const r of myRatings || []) myMap.set(`${r.tmdb_id}-${r.media_type}`, r.rating);

  let matched = 0;
  let total = 0;
  const bothEnjoyed: string[] = [];    // both rated ≥4
  const divergent: { key: string; mine: number; theirs: number }[] = []; // diff ≥2.5

  for (const r of theirRatings) {
    const key = `${r.tmdb_id}-${r.media_type}`;
    const myRating = myMap.get(key);
    if (myRating == null) continue;
    total++;

    // Match if within 1 point
    if (Math.abs(myRating - r.rating) <= 1) matched++;

    if (myRating >= 4 && r.rating >= 4) {
      bothEnjoyed.push(key);
    } else if (Math.abs(myRating - r.rating) >= 2.5) {
      divergent.push({ key, mine: myRating, theirs: r.rating });
    }
  }

  const matchRate = total > 0 ? Math.round((matched / total) * 100) : 0;

  // Enrich titles from TMDB
  async function enrich(keys: string[]) {
    return Promise.all(keys.slice(0, 6).map(async (k) => {
      const [tid, mtype] = k.split("-");
      try {
        const res = await fetch(`${TMDB_BASE}/${mtype}/${tid}?api_key=${TMDB_API_KEY}`);
        if (!res.ok) return null;
        const d = await res.json();
        return {
          tmdbId: parseInt(tid),
          mediaType: mtype,
          title: d.title || d.name,
          poster: d.poster_path ? `${TMDB_IMAGE}${d.poster_path}` : null,
          year: (d.release_date || d.first_air_date || "").slice(0, 4) || null,
        };
      } catch { return null; }
    })).then(r => r.filter(Boolean));
  }

  const [enjoyed, div] = await Promise.all([
    enrich(bothEnjoyed),
    Promise.all(divergent.slice(0, 6).map(async (d) => {
      const [tid, mtype] = d.key.split("-");
      try {
        const res = await fetch(`${TMDB_BASE}/${mtype}/${tid}?api_key=${TMDB_API_KEY}`);
        if (!res.ok) return null;
        const j = await res.json();
        return {
          tmdbId: parseInt(tid),
          mediaType: mtype,
          title: j.title || j.name,
          poster: j.poster_path ? `${TMDB_IMAGE}${j.poster_path}` : null,
          year: (j.release_date || j.first_air_date || "").slice(0, 4) || null,
          myRating: d.mine,
          theirRating: d.theirs,
        };
      } catch { return null; }
    })).then(r => r.filter(Boolean)),
  ]);

  return NextResponse.json({ matchRate, bothEnjoyed: enjoyed, divergent: div });
}
