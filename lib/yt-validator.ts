/**
 * YouTube trailer validation + DuckDuckGo fallback search.
 * Two-phase validation: oEmbed (existence) + Data API v3 (region restrictions).
 */

type Video = { key: string; name: string };

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";

/** Check if a YouTube video exists (not deleted/private) via oEmbed */
async function videoExists(key: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${key}`,
      { next: { revalidate: 86400 } } as any
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Check if a YouTube video has region restrictions (any blocked countries) */
async function hasRegionRestrictions(key: string): Promise<boolean> {
  if (!YOUTUBE_API_KEY) return false; // no key = skip check
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${key}&key=${YOUTUBE_API_KEY}`,
      { next: { revalidate: 86400 } } as any
    );
    if (!res.ok) return false;
    const json = await res.json();
    const items = json.items || [];
    if (items.length === 0) return false;
    const restrictions = items[0]?.contentDetails?.regionRestriction;
    // blocked[] = countries where video is NOT available
    // If blocked exists with any entries, the video is region-restricted
    if (restrictions?.blocked && restrictions.blocked.length > 0) return true;
    // allowed[] = opposite — only available in these countries
    if (restrictions?.allowed && restrictions.allowed.length > 0) return true;
    return false;
  } catch {
    return false; // API error = assume ok
  }
}

/** Fully validate a video: exists + no region restrictions */
async function isVideoFullyPlayable(key: string): Promise<boolean> {
  const exists = await videoExists(key);
  console.log(`[VIDEO_CHECK] ${key}: exists=${exists}`);
  if (!exists) return false;
  const restricted = await hasRegionRestrictions(key);
  console.log(`[VIDEO_CHECK] ${key}: restricted=${restricted}`);
  if (restricted) return false;
  return true;
}

/** Search YouTube directly for trailer IDs matching the query */
async function searchFallback(query: string, count: number): Promise<Video[]> {
  try {
    const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const res = await fetch(ytUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    } as any);
    console.log(`[YT_SEARCH] HTTP ${res.status} for query: ${query.slice(0,50)}`);
    const html = await res.text();
    const matches = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/g) || [];
    const ids = Array.from(new Set(matches.map((m: string) => m.split('"')[3])));
    console.log(`[YT_SEARCH] Found ${ids.length} video IDs: ${ids.slice(0,3).join(',')}`);
    return ids.slice(0, count).map((id) => ({
      key: id,
      name: "Official Trailer",
    }));
  } catch(e) {
    console.log(`[YT_SEARCH] Error:`, e);
    return [];
  }
}

/**
 * Validate each video (existence + region) and replace broken ones with DuckDuckGo fallback.
 * Returns at most `max` valid, unrestricted trailers.
 */
export async function validateAndReplaceTrailers(
  videos: Video[],
  searchQuery: string,
  max = 3,
  badKeys?: Set<string>
): Promise<Video[]> {
  const result: Video[] = [];
  const brokenCount: number = 0;

  // Phase 1: validate existing videos (exists + no region block)
  for (let i = 0; i < videos.length; i++) {
    if (badKeys?.has(videos[i].key)) continue;
    const playable = await isVideoFullyPlayable(videos[i].key);
    if (playable) {
      result.push(videos[i]);
    }
  }

  // Phase 2: fill gaps with fallback search
  const needed = max - result.length;
  if (needed > 0) {
    const fallbacks = await searchFallback(searchQuery, max * 2);
    for (const fb of fallbacks) {
      if (result.length >= max) break;
      if (result.some((v) => v.key === fb.key)) continue;
      if (badKeys?.has(fb.key)) continue;
      const playable = await isVideoFullyPlayable(fb.key);
      if (playable) result.push(fb);
    }
  }

  return result.slice(0, max);
}
