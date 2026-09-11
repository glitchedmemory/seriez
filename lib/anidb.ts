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
  try {
    const res = await fetch(`${ANIZIP_API}/mappings?anilist_id=${anilistId}`, {
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
