import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anilistFetch } from "@/lib/anilist";

export const dynamic = "force-dynamic";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const ANILIST_API = "https://graphql.anilist.co";

async function getTmdbMeta(tmdbId: number, mediaType: string) {
  const endpoint = mediaType === "tv" ? "tv" : "movie";
  const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title || data.name || null,
      poster: data.poster_path ? `https://image.tmdb.org/t/p/w185${data.poster_path}` : null,
      year: data.release_date ? new Date(data.release_date).getFullYear() : (data.first_air_date ? new Date(data.first_air_date).getFullYear() : null),
    };
  } catch {
    return null;
  }
}

// Search anime metadata from Jikan + Kitsu when no anilist_id available
// Tries multiple anime APIs with the enrichAnime chain
async function searchAnimeMetadata(tmdbId: number): Promise<{ title: string; poster: string | null; year: number | null } | null> {
  // For anime, the id we store IS an AniList id (see app/anime/[id]/page.tsx — the
  // route param is parsed and passed straight through as tmdbId). So resolve it
  // directly by AniList id instead of searching by the numeric string.
  //
  // Jikan used to be tried here first. It is permanently down (api.jikan.moe
  // returns no response at all) and the numeric search never matched a real
  // anime anyway, so every anime review paid a multi-second timeout for nothing.
  try {
    const byId = await anilistFetch(`query($id:Int){Media(id:$id,type:ANIME){id title{romaji english}coverImage{extraLarge}seasonYear}}`, { id: tmdbId });
    if (byId.ok) {
      const m = (await byId.json()).data?.Media;
      if (m?.title) {
        return {
          title: m.title?.english || m.title?.romaji || `Anime #${tmdbId}`,
          poster: m.coverImage?.extraLarge || null,
          year: m.seasonYear || null,
        };
      }
    }
  } catch {}

  // Try Kitsu
  try {
    const kitsuRes = await fetch(
      `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(String(tmdbId))}&page[limit]=1`,
      { headers: { "Accept": "application/vnd.api+json", "User-Agent": "Seriez/1.0" } }
    );
    if (kitsuRes.ok) {
      const kd = await kitsuRes.json();
      const entry = kd?.data?.[0];
      if (entry) {
        const attr = entry.attributes;
        return {
          title: attr?.canonicalTitle || attr?.titles?.en || attr?.titles?.en_jp || `Anime #${tmdbId}`,
          poster: attr?.posterImage?.original || null,
          year: attr?.startDate ? new Date(attr.startDate).getFullYear() : null,
        };
      }
    }
  } catch {}

  return null;
}

async function enrichAnime(anilistId: number): Promise<{ title: string; poster: string | null; year: number | null } | null> {
  try {
    const res = await anilistFetch(`query($id:Int){Media(id:$id){idMal title{romaji english}coverImage{extraLarge}seasonYear}}`, { id: anilistId });
    if (!res.ok) return null;
    const json = await res.json();
    const m = json.data?.Media;
    if (!m) return null;
    const title = m.title?.english || m.title?.romaji || "";
    const year = m.seasonYear || null;

    if (m.coverImage?.extraLarge) {
      return { title, poster: m.coverImage.extraLarge, year };
    }
    // Jikan removed: api.jikan.moe is dead and made this path hang for seconds.
    // AniList's own coverImage (checked above) plus the Kitsu fallback below
    // cover the same ground.
    // Try Kitsu
    if (title) {
      try {
        const kitsuRes = await fetch(
          `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(title)}&page[limit]=1`,
          { headers: { "Accept": "application/vnd.api+json", "User-Agent": "Seriez/1.0" } }
        );
        if (kitsuRes.ok) {
          const kd = await kitsuRes.json();
          const pi = kd?.data?.[0]?.attributes?.posterImage;
          if (pi?.original) return { title, poster: pi.original, year };
        }
      } catch {}
    }
    return { title, poster: null, year };
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const supabase = await createClient();

  try {
    const { data: reviews, error } = await supabase
      .from("reviews")
      .select("tmdb_id, media_type, content, rating, created_at")
      .eq("username", username)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
    }

    if (!reviews || reviews.length === 0) {
      return NextResponse.json({ reviews: [] });
    }

    // Gather unique tmdb_ids for lookup
    const seen = new Set<string>();
    const uniquePairs: { tmdb_id: number; media_type: string }[] = [];
    for (const r of reviews) {
      const key = `${r.tmdb_id}-${r.media_type}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniquePairs.push({ tmdb_id: r.tmdb_id, media_type: r.media_type });
      }
    }

    // Look up anilist_ids from media_trackings for anime entries
    const animeIds = uniquePairs.filter(p => p.media_type === "anime");
    const animeIdMap: Record<number, number> = {}; // tmdb_id → anilist_id
    if (animeIds.length > 0) {
      const { data: tracks } = await supabase
        .from("media_trackings")
        .select("tmdb_id, anilist_id")
        .in("tmdb_id", animeIds.map(p => p.tmdb_id))
        .eq("media_type", "anime");

      if (tracks) {
        for (const t of tracks) {
          if (t.anilist_id && !animeIdMap[t.tmdb_id]) {
            animeIdMap[t.tmdb_id] = t.anilist_id;
          }
        }
      }
    }

    // Resolve metadata for each unique pair
    const metaMap: Record<string, { title: string; poster: string | null; year: number | null }> = {};
    const resolutions = uniquePairs.map(async (p) => {
      const key = `${p.tmdb_id}-${p.media_type}`;

      if (p.media_type === "anime") {
        const anilistId = animeIdMap[p.tmdb_id];
        if (anilistId) {
          const animeMeta = await enrichAnime(anilistId);
          if (animeMeta?.title) {
            metaMap[key] = animeMeta;
            return;
          }
        }
        // No anilist_id in media_trackings → search Jikan + Kitsu
        const meta = await searchAnimeMetadata(p.tmdb_id);
        if (meta) {
          metaMap[key] = meta;
          return;
        }
        metaMap[key] = { title: `Anime #${p.tmdb_id}`, poster: null, year: null };
        return;
      }

      // TMDB fallback for movie/tv only
      const tmdbMeta = await getTmdbMeta(p.tmdb_id, p.media_type);
      if (tmdbMeta?.title) {
        metaMap[key] = tmdbMeta;
      } else {
        const label = p.media_type === "tv" ? "TV Show" : "Movie";
        metaMap[key] = { title: `${label} #${p.tmdb_id}`, poster: null, year: null };
      }
    });

    await Promise.all(resolutions);

    const enriched = reviews.map(r => {
      const key = `${r.tmdb_id}-${r.media_type}`;
      const meta = metaMap[key] || { title: "Untitled", poster: null, year: null };
      return { ...r, title: meta.title, poster: meta.poster, year: meta.year };
    });

    return NextResponse.json({ reviews: enriched });
  } catch (err: any) {
    console.error("Reviews fetch error:", err);
    return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
  }
}
