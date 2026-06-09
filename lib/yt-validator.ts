/**
 * YouTube trailer validation + DuckDuckGo fallback search.
 * Replaces region-blocked/deleted/private trailers with fresh search results.
 */

type Video = { key: string; name: string };

/** Check if a YouTube video is playable via oEmbed API */
async function isVideoValid(key: string): Promise<boolean> {
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

/** Search DuckDuckGo for YouTube trailer IDs matching the query */
async function searchFallback(query: string, count: number): Promise<Video[]> {
  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + " site:youtube.com")}`;
    const res = await fetch(ddgUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 86400 },
    } as any);
    const html = await res.text();
    const ytMatches = html.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/g) || [];
    const ytIds = Array.from(new Set(ytMatches.map((u: string) => u.split("v=")[1]?.slice(0, 11))));
    return ytIds.slice(0, count).map((id) => ({
      key: id,
      name: "Official Trailer",
    }));
  } catch {
    return [];
  }
}

/**
 * Validate each video and replace broken ones with DuckDuckGo fallback.
 * Returns at most `max` valid trailers.
 */
export async function validateAndReplaceTrailers(
  videos: Video[],
  searchQuery: string,
  max = 3,
  badKeys?: Set<string>
): Promise<Video[]> {
  const result: Video[] = [];
  const brokenIndices: number[] = [];

  // Phase 1: validate existing videos
  for (let i = 0; i < videos.length; i++) {
    if (badKeys?.has(videos[i].key)) {
      brokenIndices.push(i);
      continue;
    }
    const valid = await isVideoValid(videos[i].key);
    if (valid) {
      result.push(videos[i]);
    } else {
      brokenIndices.push(i);
    }
  }

  // Phase 2: fill gaps with fallback search
  const needed = max - result.length;
  if (needed > 0 && brokenIndices.length > 0) {
    const fallbacks = await searchFallback(searchQuery, needed);
    for (const fb of fallbacks) {
      if (result.length >= max) break;
      if (result.some((v) => v.key === fb.key)) continue;
      if (badKeys?.has(fb.key)) continue;
      const valid = await isVideoValid(fb.key);
      if (valid) result.push(fb);
    }
  }

  return result.slice(0, max);
}
