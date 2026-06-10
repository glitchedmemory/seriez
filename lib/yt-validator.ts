/**
 * YouTube trailer validation + YouTube fallback search.
 * Two-phase validation: oEmbed (existence check).
 * Includes retry logic + in-memory cache for validated trailers.
 */

type Video = { key: string; name: string };

// Known geo-restricted or broken video keys — globally blocked
const GLOBAL_BAD_KEYS = new Set<string>([
  "XTt4vxZr2a8", // Michael — geo-restricted in some regions
  "3zOLzsbOleM", // Michael — duplicate of official trailer
]);

// ─── Retry wrapper ───

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastError;
}

// ─── In-memory trailer cache (TTL: 7 days) ───

const trailerCache = new Map<number, { key: string; at: number }>();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

function getCachedTrailer(animeId: number): string | null {
  const entry = trailerCache.get(animeId);
  if (entry && Date.now() - entry.at < CACHE_TTL) return entry.key;
  if (entry) trailerCache.delete(animeId); // expired
  return null;
}

function setCachedTrailer(animeId: number, key: string): void {
  trailerCache.set(animeId, { key, at: Date.now() });
}

/** Check if a YouTube video exists (not deleted/private) via oEmbed */
async function videoExists(key: string): Promise<boolean> {
  try {
    const res = await withRetry(() =>
      fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${key}`,
        { next: { revalidate: 86400 } } as any
      )
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Check if a YouTube video is region-restricted by fetching the embed page */
async function hasRegionRestrictions(key: string): Promise<boolean> {
  try {
    const res = await withRetry(() =>
      fetch(`https://www.youtube.com/embed/${key}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      } as any)
    );
    const html = await res.text();
    // Detect region-restriction messages in the embed page
    if (html.includes("not made this video available in your country")) return true;
    if (html.includes("Video unavailable")) return true;
    if (html.includes('"reason":"Video unavailable"')) return true;
    return false;
  } catch {
    return false;
  }
}

/** Fully validate a video: exists + no region restrictions */
async function isVideoFullyPlayable(key: string): Promise<boolean> {
  if (!(await videoExists(key))) return false;
  if (await hasRegionRestrictions(key)) return false;
  return true;
}

/** Search YouTube directly for trailer IDs matching the query */
async function searchFallback(query: string, count: number): Promise<Video[]> {
  try {
    const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const res = await withRetry(() =>
      fetch(ytUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      } as any)
    );
    const html = await res.text();
    const matches = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/g) || [];
    const ids = Array.from(new Set(matches.map((m: string) => m.split('"')[3])));
    return ids.slice(0, count).map((id) => ({
      key: id,
      name: "Official Trailer",
    }));
  } catch {
    return [];
  }
}

/**
 * Validate each video (existence + region) and replace broken ones with YouTube fallback.
 * Returns at most `max` valid, unrestricted trailers.
 * If animeId is provided, checks cache first and stores results.
 */
export async function validateAndReplaceTrailers(
  videos: Video[],
  searchQuery: string,
  max = 3,
  badKeys?: Set<string>,
  animeId?: number
): Promise<Video[]> {
  const blocked = new Set([...GLOBAL_BAD_KEYS, ...(badKeys || [])]);
  // Check cache first (only for single-trailer anime lookups)
  if (animeId && max === 1 && videos.length <= 1) {
    const cached = getCachedTrailer(animeId);
    if (cached && !blocked.has(cached)) return [{ key: cached, name: "Official Trailer" }];
  }

  const result: Video[] = [];

  // Phase 1: validate existing videos (exists + no region block)
  for (let i = 0; i < videos.length; i++) {
    if (blocked.has(videos[i].key)) continue;
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
      if (blocked.has(fb.key)) continue;
      const playable = await isVideoFullyPlayable(fb.key);
      if (playable) result.push(fb);
    }
  }

  const final = result.slice(0, max);

  // Cache result for anime lookups
  if (animeId && final.length > 0) {
    setCachedTrailer(animeId, final[0].key);
  }

  return final;
}
