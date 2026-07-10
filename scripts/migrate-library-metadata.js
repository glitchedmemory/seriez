#!/usr/bin/env node
/** Backfill title/poster_url/year/tmdb_rating for existing tracking records. */
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TMDB_URL = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY = process.env.TMDB_API_KEY;

async function fetchMeta(tmdbId, mediaType) {
  try {
    if (mediaType === "anime") {
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `query($id:Int){Media(id:$id){title{romaji english}coverImage{extraLarge}startDate{year}averageScore}}`, variables: { id: tmdbId } }),
      });
      if (!res.ok) return null;
      const j = await res.json();
      const m = j.data?.Media;
      return {
        title: m?.title?.english || m?.title?.romaji || null,
        poster_url: m?.coverImage?.extraLarge || null,
        year: m?.startDate?.year || null,
        tmdb_rating: m?.averageScore ? Math.round(m.averageScore) / 10 : null,
      };
    } else {
      const ep = mediaType === "tv" ? "tv" : "movie";
      const res = await fetch(`${TMDB_URL}/${ep}/${tmdbId}?api_key=${TMDB_KEY}`);
      if (!res.ok) return null;
      const d = await res.json();
      return {
        title: d.title || d.name || null,
        poster_url: d.poster_path ? `${TMDB_IMG}${d.poster_path}` : null,
        year: parseInt((d.release_date || d.first_air_date || "").slice(0, 4)) || null,
        tmdb_rating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
      };
    }
  } catch { return null; }
}

async function main() {
  // Get all unique (tmdb_id, media_type) combos that need backfill
  const { data } = await supabase.from("media_trackings").select("tmdb_id, media_type").is("title", null);
  if (!data || data.length === 0) { console.log("Nothing to migrate!"); return; }

  const unique = new Map();
  for (const r of data) unique.set(`${r.tmdb_id}-${r.media_type}`, r);
  const items = [...unique.values()];
  console.log(`Migrating ${items.length} unique titles (${data.length} total records)...`);

  let done = 0;
  for (const item of items) {
    const meta = await fetchMeta(item.tmdb_id, item.media_type);
    if (meta && (meta.title || meta.poster_url)) {
      await supabase.from("media_trackings")
        .update(meta)
        .eq("tmdb_id", item.tmdb_id)
        .eq("media_type", item.media_type)
        .is("title", null);
    }
    done++;
    if (done % 10 === 0) console.log(`  ${done}/${items.length}...`);
    // Rate limit
    await new Promise(r => setTimeout(r, 150));
  }
  console.log("Done!");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
