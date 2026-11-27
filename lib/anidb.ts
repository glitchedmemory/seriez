// lib/anidb.ts — ani.zip (AniDB) client
// ani.zip exposes the AniDB dataset via a free HTTPS API. A single call to
// GET /mappings?anilist_id=X returns, in one payload:
//   titles   — the title translated into 20+ languages (ko, en, ja, zh, ...)
//   episodes — per-episode multi-language title, airDate, runtime, image, summary
//   images   — TVDB-hosted Banner / Poster / Fanart / Clearlogo
//   mappings — cross-DB ids (anilist, mal, kitsu, anidb, imdb, tmdb, thetvdb, ...)
//   episodeCount / specialCount / type
//
// ani.zip does NOT provide: average rating, popularity, genres, staff,
// characters, recommendations, relations, or trailers. Those still come from
// AniList (with the existing Kitsu fallback).

const ANIZIP_API = "https://api.ani.zip";

export type AniZipTitles = Record<string, string>;

export type AniZipEpisode = {
  tvdbShowId?: number;
  tvdbId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  absoluteEpisodeNumber?: number;
  title?: AniZipTitles;
  airDate?: string;
  airDateUtc?: string;
  runtime?: number;
  overview?: string;
  image?: string;
  episode?: string;
  anidbEid?: number;
  length?: number;
  airdate?: string;
  rating?: string;
  summary?: string;
};

export type AniZipImage = {
  coverType: string; // "Banner" | "Poster" | "Fanart" | "Clearlogo"
  url: string;
};

export type AniZipMappings = {
  animeplanet_id?: string | null;
  kitsu_id?: number | null;
  mal_id?: number | null;
  type?: string | null;
  anilist_id?: number | null;
  anisearch_id?: number | null;
  anidb_id?: number | null;
  notifymoe_id?: string | null;
  livechart_id?: number | null;
  thetvdb_id?: number | null;
  imdb_id?: string | null;
  themoviedb_id?: string | null;
};

export type AniZipData = {
  titles: AniZipTitles;
  episodes: Record<string, AniZipEpisode>;
  episodeCount: number;
  specialCount: number;
  images: AniZipImage[];
  mappings: AniZipMappings;
};

/**
 * Fetch the full ani.zip payload by AniList id (single call).
 * Returns null on any failure (network, 404, 429) so callers can fall back.
 */
export async function fetchAniZipByAnilistId(
  anilistId: number
): Promise<AniZipData | null> {
  return fetchAniZip(`anilist_id=${anilistId}`);
}

/**
 * Resolve a Kitsu id → anilist id + English title via ani.zip's mappings table.
 * ani.zip accepts kitsu_id lookups and returns the full cross-DB mapping plus
 * titles (including the official English title — Kitsu's canonicalTitle is
 * romaji, which we do NOT want for display).
 */
export async function resolveKitsuIdToAnilist(
  kitsuId: number | string
): Promise<{ anilistId: number | null; malId: number | null; titleEn: string | null }> {
  const d = await fetchAniZip(`kitsu_id=${kitsuId}`);
  if (!d?.mappings) return { anilistId: null, malId: null, titleEn: null };
  return {
    anilistId: d.mappings.anilist_id ?? null,
    malId: d.mappings.mal_id ?? null,
    titleEn: d.titles?.["en"] ?? null,
  };
}

/**
 * Resolve an AniList id → Kitsu id via ani.zip's mappings.
 */
export async function resolveAnilistIdToKitsuId(
  anilistId: number
): Promise<number | null> {
  const d = await fetchAniZip(`anilist_id=${anilistId}`);
  if (!d?.mappings?.kitsu_id) return null;
  return d.mappings.kitsu_id;
}

/**
 * Resolve an AniList id → mal id via ani.zip's mappings.
 */
export async function resolveAnilistIdToMalId(
  anilistId: number
): Promise<number | null> {
  const d = await fetchAniZip(`anilist_id=${anilistId}`);
  if (!d?.mappings?.mal_id) return null;
  return d.mappings.mal_id;
}

/**
 * Resolve a MAL id → anilist id + English title via ani.zip's mappings.
 */
export async function resolveMalIdToAnilistEn(
  malId: number | string
): Promise<{ anilistId: number | null; titleEn: string | null }> {
  const d = await fetchAniZip(`mal_id=${malId}`);
  if (!d?.mappings) return { anilistId: null, titleEn: null };
  return {
    anilistId: d.mappings.anilist_id ?? null,
    titleEn: d.titles?.["en"] ?? null,
  };
}

/**
 * Resolve a title → AniDB id using AniDB's public titles dump.
 *
 * Why this exists: ani.zip derives its mappings from AniDB, and when a show is
 * brand new the anidb_id column is still null even though AniDB already knows
 * about it. Fetching ani.zip by anilist_id then returns episodes: {} — while
 * fetching the very same endpoint by anidb_id returns the full episode list
 * with TVDB screenshots. (Fool Night, AniList 213457: anilist_id lookup gave 0
 * episodes, anidb_id=20121 gave 12 with images.)
 *
 * The dump is a 1.9MB gzip that expands to ~7MB; gunzip alone costs 60-160ms,
 * so the parsed title→aid index is memoised in this module. It's rebuilt at most
 * once per process lifetime and refreshed daily.
 */
const ANIDB_DUMP_URL = "https://anidb.net/api/animetitles.xml.gz";
const ANIDB_INDEX_TTL_MS = 24 * 60 * 60 * 1000;

let anidbIndex: Map<string, number> | null = null;
let anidbIndexLoadedAt = 0;
let anidbIndexInflight: Promise<Map<string, number> | null> | null = null;

async function loadAniDBTitleIndex(): Promise<Map<string, number> | null> {
  const now = Date.now();
  if (anidbIndex && now - anidbIndexLoadedAt < ANIDB_INDEX_TTL_MS) return anidbIndex;
  if (anidbIndexInflight) return anidbIndexInflight;

  anidbIndexInflight = (async () => {
    try {
      const res = await fetch(ANIDB_DUMP_URL, {
        headers: { "User-Agent": "Mozilla/5.0", "Accept-Encoding": "gzip" },
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return null;

      const { gunzipSync } = await import("zlib");
      const buf = Buffer.from(await res.arrayBuffer());
      let xml: string;
      try {
        xml = gunzipSync(buf).toString("utf-8");
      } catch {
        xml = buf.toString("utf-8"); // not gzipped
      }

      // <anime aid="20121"><type>...</type><title ...>Fool Night</title>...</anime>
      const index = new Map<string, number>();
      const animeRe = /<anime\s+aid="(\d+)"[^>]*>([\s\S]*?)<\/anime>/g;
      let m: RegExpExecArray | null;
      while ((m = animeRe.exec(xml)) !== null) {
        const aid = parseInt(m[1], 10);
        if (!aid) continue;
        const titleRe = /<title[^>]*>([^<]+)<\/title>/g;
        let t: RegExpExecArray | null;
        while ((t = titleRe.exec(m[2])) !== null) {
          const key = t[1].trim().toLowerCase();
          if (!key) continue;
          // First writer wins: the main/romaji title appears before synonyms.
          if (!index.has(key)) index.set(key, aid);
        }
      }

      if (index.size > 0) {
        anidbIndex = index;
        anidbIndexLoadedAt = Date.now();
        return index;
      }
      return null;
    } catch {
      return null;
    } finally {
      anidbIndexInflight = null;
    }
  })();

  return anidbIndexInflight;
}

/**
 * Find the AniDB id for a title. Tries the exact title first, then a
 * containment pass (AniDB often carries "Fool Night" alongside longer
 * synonym forms). Returns null when the index can't be built or nothing matches.
 */
export async function resolveTitleToAniDBId(title: string): Promise<number | null> {
  const needle = title?.trim().toLowerCase();
  if (!needle || needle.length < 2) return null;

  const index = await loadAniDBTitleIndex();
  if (!index) return null;

  const exact = index.get(needle);
  if (exact) return exact;

  // Containment fallback, preferring the shortest matching title so
  // "Fool Night" doesn't bind to "Fool Night Something Else".
  let best: { aid: number; len: number } | null = null;
  for (const [key, aid] of index) {
    if (!key.includes(needle) && !needle.includes(key)) continue;
    if (!best || key.length < best.len) best = { aid, len: key.length };
  }
  return best?.aid ?? null;
}

/**
 * Fetch ani.zip episodes by AniDB id. Used when the anilist_id lookup returns
 * nothing because ani.zip's mapping row hasn't been backfilled yet.
 */
export async function fetchAniZipByAniDBId(anidbId: number): Promise<AniZipData | null> {
  return fetchAniZip(`anidb_id=${anidbId}`);
}

async function fetchAniZip(qs: string): Promise<AniZipData | null> {
  try {
    const res = await fetch(`${ANIZIP_API}/mappings?${qs}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 }, // ani.zip data is static; cache 24h to avoid 429
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as AniZipData;
    if (!json || !json.titles) return null;
    return json;
  } catch {
    return null;
  }
}

/** Pick a title for a given locale with sensible fallback ordering. */
export function pickTitle(
  titles: AniZipTitles | null | undefined,
  locale: string
): string | null {
  if (!titles) return null;

  const candidates: string[] = [];
  const normalized = locale.toLowerCase();

  // 1. exact locale match (e.g. "ko", "en", "ja", "zh-Hant")
  const exact = titles[locale];
  if (exact) candidates.push(exact);

  // 2. primary language tag ("ko-KR" -> "ko")
  const primary = normalized.split("-")[0];
  const byPrimary = titles[primary];
  if (byPrimary && byPrimary !== exact) candidates.push(byPrimary);

  // 3. romaji / x-jat romanization
  const romaji = titles["x-jat"] || titles["x-jat-split"];
  if (romaji) candidates.push(romaji);

  // 4. english
  if (titles["en"]) candidates.push(titles["en"]);

  // 5. japanese
  if (titles["ja"]) candidates.push(titles["ja"]);

  // 6. first available value
  for (const v of Object.values(titles)) {
    if (v && typeof v === "string" && !candidates.includes(v)) {
      candidates.push(v);
      break;
    }
  }

  // return first non-empty
  for (const c of candidates) {
    if (c && c.trim().length > 0) return c.trim();
  }
  return null;
}

/** Extract the best poster URL from ani.zip images (prefers Poster). */
export function pickAniZipImage(
  images: AniZipImage[] | null | undefined,
  preferredType = "Poster"
): string | null {
  if (!images || images.length === 0) return null;
  const exact = images.find((i) => i.coverType === preferredType);
  if (exact?.url) return exact.url;
  const any = images.find((i) => i.url);
  return any?.url || null;
}

/** Convert ani.zip episodes into the AnimeEpisode shape used across the app.
 *  ani.zip stores regular + special episodes together; regular episodes have a
 *  purely-numeric `episode` field ("1".."26") while specials use a letter prefix
 *  ("S1", "P1", ...). We keep only regular episodes and order by that number. */
export function anizipEpisodesToAnimeEpisodes(
  episodes: Record<string, AniZipEpisode> | null | undefined
): { number: number; title: string; titleJapanese: string; airDate: string; thumbnail: string | null; synopsis: string; duration: number }[] {
  if (!episodes) return [];
  const out: { number: number; title: string; titleJapanese: string; airDate: string; thumbnail: string | null; synopsis: string; duration: number }[] = [];
  for (const key of Object.keys(episodes)) {
    const e = episodes[key];
    // Regular episodes only: `episode` is a plain integer string. Specials have
    // "S1"/"P1"/etc, and are skipped to match episodeCount (regular episodes).
    const rawNum = e.episode ?? key;
    if (typeof rawNum !== "string" || !/^\d+$/.test(rawNum)) continue;
    const num = Number(rawNum);
    if (!Number.isFinite(num) || num <= 0) continue;

    const title = e.title;
    const titleEn = title?.["en"] || title?.["x-jat"] || `Episode ${num}`;
    const titleJa = title?.["ja"] || title?.["x-jat"] || "";
    out.push({
      number: num,
      title: titleEn,
      titleJapanese: titleJa,
      airDate: e.airDate || e.airdate || "",
      thumbnail: e.image || null,
      synopsis: e.overview || e.summary || "",
      duration: e.runtime || e.length || 0,
    });
  }
  out.sort((a, b) => a.number - b.number);
  return out;
}
