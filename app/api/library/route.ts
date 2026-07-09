import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId } from "@/lib/user-utils";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const TMDB_IMAGE = "https://image.tmdb.org/t/p/w780";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY;
const ANILIST_API = "https://graphql.anilist.co";

const PAGE_SIZE = 50;
const TMDB_BATCH = 20; // well within 50/sec limit
const ANILIST_DELAY = 100; // ms between AniList calls (90/min limit)

async function enrichAnime(t: any): Promise<any> {
  const gql = { query: `query($id:Int){Media(id:$id){title{romaji english}coverImage{extraLarge}startDate{year}}}`, variables: { id: t.tmdb_id } };
  const alRes = await fetch(ANILIST_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(gql) });
  if (!alRes.ok) return null;
  const alJson = await alRes.json();
  const m = alJson.data?.Media;
  if (!m) return null;
  return {
    tmdbId: t.tmdb_id, mediaType: "anime", seasonNumber: t.season_number,
    seasonName: t.season_number > 0 ? `Season ${t.season_number}` : null, seasonPoster: null,
    status: t.status, rating: t.rating, progress: t.progress, updatedAt: t.updated_at,
    title: m.title?.english || m.title?.romaji || "Unknown",
    poster: m.coverImage?.extraLarge || m.coverImage?.large || null,
    year: m.startDate?.year?.toString() || null, tmdbRating: null,
  };
}

async function enrichTMDB(t: any): Promise<any> {
  const res = await fetch(`${TMDB_API}/${t.media_type}/${t.tmdb_id}?api_key=${TMDB_KEY}`);
  if (!res.ok) return null;
  const detail = await res.json();
  const title = detail.title || detail.name || "Unknown";
  const poster = detail.poster_path ? `${TMDB_IMAGE}${detail.poster_path}` : null;
  const year = (detail.release_date || detail.first_air_date || "").slice(0, 4) || null;
  const tmdbRating = Math.round((detail.vote_average || 0) * 10) / 10;

  let seasonPoster: string | null = null;
  let seasonName: string | null = null;
  if (t.media_type === "tv" && t.season_number > 0) {
    try {
      const sRes = await fetch(`${TMDB_API}/tv/${t.tmdb_id}/season/${t.season_number}?api_key=${TMDB_KEY}`);
      if (sRes.ok) {
        const sData = await sRes.json();
        seasonName = sData.name || `Season ${t.season_number}`;
        if (sData.poster_path) seasonPoster = `${TMDB_IMAGE}${sData.poster_path}`;
      }
    } catch { /* use main poster */ }
  }

  return { tmdbId: t.tmdb_id, mediaType: t.media_type, seasonNumber: t.season_number, seasonName, seasonPoster, status: t.status, rating: t.rating, progress: t.progress, updatedAt: t.updated_at, title, poster, year, tmdbRating };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username") || await resolveUsername(req);
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1") || 1;
  const limit = Math.min(parseInt(searchParams.get("limit") || String(PAGE_SIZE)) || PAGE_SIZE, PAGE_SIZE);

  if (!username) return NextResponse.json({ error: "Missing username" }, { status: 400 });

  const userId = await resolveUserId(username);
  if (!userId) return NextResponse.json({ items: [], total: 0, page, totalPages: 0 });

  // Count total items
  let countQuery = supabaseAdmin.from("media_trackings").select("*", { count: "exact", head: true }).eq("username", userId);
  if (status) countQuery = countQuery.eq("status", status);
  const { count: total, error: countErr } = await countQuery;
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });

  // Fetch page
  let query = supabaseAdmin.from("media_trackings").select("*").eq("username", userId).order("updated_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ items: [], total: total || 0, page, totalPages: Math.ceil((total || 0) / limit) });

  // Separate TMDB vs AniList items
  const tmdbItems = data.filter(t => t.media_type !== "anime");
  const animeItems = data.filter(t => t.media_type === "anime");

  // Process TMDB items in parallel batches
  const tmdbResults: any[] = [];
  for (let i = 0; i < tmdbItems.length; i += TMDB_BATCH) {
    const batch = tmdbItems.slice(i, i + TMDB_BATCH);
    const batchResults = await Promise.all(batch.map(t => enrichTMDB(t).catch(() => null)));
    tmdbResults.push(...batchResults);
  }

  // Process AniList items sequentially (rate limit 90/min)
  const animeResults: any[] = [];
  for (const t of animeItems) {
    try {
      const result = await enrichAnime(t);
      animeResults.push(result);
    } catch {
      animeResults.push(null);
    }
    if (animeItems.indexOf(t) < animeItems.length - 1) {
      await new Promise(r => setTimeout(r, ANILIST_DELAY));
    }
  }

  // Merge preserving original order
  const enriched = new Map<number, any>();
  for (const r of tmdbResults) if (r) enriched.set(r.tmdbId, r);
  for (const r of animeResults) if (r) enriched.set(r.tmdbId, r);

  const items = data.map(t => enriched.get(t.tmdb_id) || null).filter(Boolean);

  return NextResponse.json({ items, total: total || 0, page, totalPages: Math.ceil((total || 0) / limit) });
}
