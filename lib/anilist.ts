const ANILIST_API = "https://graphql.anilist.co";

const ANILIST_HEADERS = {
  "Content-Type": "application/json",
  "Accept": "application/json",
  "Origin": "https://anilist.co",
  "Referer": "https://anilist.co/",
};

import { unstable_cache } from "next/cache";
import { persistentCache } from "./persistent-cache";

import type { TmdbResult } from "./tmdb";
import { validateAndReplaceTrailers } from "./yt-validator";
import { fetchAniZipByAnilistId, pickTitle, pickAniZipImage, anizipEpisodesToAnimeEpisodes, resolveKitsuIdToAnilist, resolveAnilistIdToKitsuId, resolveAnilistIdToMalId, resolveMalIdToAnilistEn } from "./anidb";

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

// ─── Shared AniList GraphQL fetch ───
// Single entry point for every AniList call so the Origin/Referer headers (which
// AniList requires to avoid 403) and cache policy live in ONE place instead of
// being duplicated (and occasionally dropped) across the codebase.
export async function anilistFetch(
  query: string,
  variables: Record<string, unknown> = {},
  opts: { revalidate?: number; signal?: AbortSignal } = {}
): Promise<Response> {
  return fetch(ANILIST_API, {
    method: "POST",
    headers: ANILIST_HEADERS,
    body: JSON.stringify({ query, variables }),
    next: { revalidate: opts.revalidate ?? 3600 },
    ...(opts.signal ? { signal: opts.signal } : {}),
  });
}

// ─── Types ───

export type AnimeDetail = {
  id: number;
  idMal: number;
  title: string;
  titleRomaji: string;
  titleNative: string;
  titles: Record<string, string>;  // multi-language titles from ani.zip (ko, en, ja, zh, ...)
  overview: string;
  poster: string | null;
  backdrop: string | null;
  rating: number;       // 0-10 scale
  popularity: number;
  year: number;
  season: string;
  format: string;       // TV, MOVIE, OVA, ONA, SPECIAL, MUSIC
  status: string;       // FINISHED, RELEASING, NOT_YET_RELEASED, CANCELLED, HIATUS
  episodes: number;
  duration: number;     // minutes per episode
  genres: string[];
  tags: { name: string; rank: number }[];
  studios: string[];
  staff: { id: number; name: string; role: string; image: string | null }[];
  characters: { name: string; role: string; voiceActor: string; image: string | null }[];
  recommendations: AnimeRecItem[];
  trailer: { id: string; site: string } | null;
  trailers: { key: string; name: string }[];  // multiple trailers (matches movie/tv detail pages)
  relations: { id: number; title: string; type: string; format: string; seasonYear: number | null; status?: string; isOriginal?: boolean }[];
  daysUntil?: number | null;  // days until release (upcoming items only)
};

export type AnimeRecItem = {
  id: number;
  title: string;
  poster: string | null;
  rating: number;
  year: number;
  genres: string[];
};

export type AnimeEpisode = {
  number: number;
  title: string;
  titleJapanese: string;
  airDate: string;       // YYYY-MM-DD
  thumbnail: string | null;
  synopsis: string;
  duration: number;       // minutes
};

// ─── GraphQL Query ───

const DETAIL_QUERY = `
query($id: Int) {
  Media(id: $id) {
    id
    idMal
    title { romaji english native }
    description(asHtml: false)
    coverImage { extraLarge }
    bannerImage
    averageScore
    popularity
    seasonYear
    startDate { year month day }
    season
    format
    status
    episodes
    duration
    genres
    tags { name rank }
    studios(sort: FAVOURITES_DESC) {
      nodes { name isAnimationStudio }
    }
    staff(sort: RELEVANCE, perPage: 8) {
      nodes {
        id
        name { full }
        primaryOccupations
        image { medium }
      }
    }
    characters(sort: ROLE, perPage: 15) {
      edges {
        role
        node { name { full } image { medium } }
        voiceActors(language: JAPANESE) { name { full } image { medium } }
      }
    }
    recommendations(sort: RATING_DESC, perPage: 12) {
      nodes {
        mediaRecommendation {
          id
          title { romaji english }
          coverImage { extraLarge }
          averageScore
          seasonYear
          genres
        }
      }
    }
    trailer { id site thumbnail }
    relations {
      edges {
        relationType
        node {
          id
          title { romaji english }
          type
          format
          seasonYear
          status
        }
      }
    }
    streamingEpisodes {
      title
      thumbnail
      url
      site
    }
  }
}`;

// ─── Format helpers ───

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    FINISHED: "Finished",
    RELEASING: "Airing",
    NOT_YET_RELEASED: "Upcoming",
    CANCELLED: "Cancelled",
    HIATUS: "On Hiatus",
  };
  return map[status] || status;
}

function formatSeason(season: string | null): string {
  if (!season) return "";
  const map: Record<string, string> = {
    WINTER: "Winter",
    SPRING: "Spring",
    SUMMER: "Summer",
    FALL: "Fall",
  };
  return map[season] || season;
}

// ─── Kitsu backdrop fallback for anime missing AniList bannerImage ───

async function fetchKitsuBackdrop(title: string, year: number, titleRomaji?: string): Promise<string | null> {
  try {
    // Try English title first, then romaji
    const queries = [title];
    if (titleRomaji && titleRomaji !== title) {
      // Use first part of romaji (before colon) for better matching
      const mainRomaji = titleRomaji.split(":")[0].trim();
      queries.push(titleRomaji);
      if (mainRomaji !== titleRomaji) queries.push(mainRomaji);
    }
    for (const q of queries) {
      const searchUrl = `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(q)}&page[limit]=5`;
      const res = await fetch(searchUrl, {
        headers: { "Accept": "application/vnd.api+json" },
        next: { revalidate: 86400 },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const results = data.data || [];
      // Find best match: prefer same-year, skip if no year match
      let best = null;
      for (const r of results) {
        const startDate = r.attributes?.startDate;
        if (startDate && year && startDate.startsWith(String(year))) {
          best = r;
          break;
        }
      }
      if (!best) continue; // require year match
      const coverImage = best.attributes?.coverImage;
      if (coverImage?.original) return coverImage.original;
      if (coverImage?.large) return coverImage.large;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Kitsu fallback: AniList ID → Kitsu anime (works even when AniList is down) ───

const KITSU_MAPPINGS_API = "https://kitsu.io/api/edge/mappings";
const KITSU_ANIME_API = "https://kitsu.io/api/edge/anime";
const KITSU_MEDIA_CHARACTERS_API = "https://kitsu.io/api/edge/media-characters";

/** Resolve an AniList ID to a Kitsu anime id via Kitsu's own mappings table
 *  (externalSite=anilist/anime). This does NOT depend on the AniList API. */
async function resolveAnilistIdToKitsu(anilistId: number): Promise<string | null> {
  try {
    const res = await fetch(
      `${KITSU_MAPPINGS_API}?filter[externalSite]=anilist/anime&filter[externalId]=${anilistId}&page[limit]=1`,
      { headers: { "Accept": "application/vnd.api+json" }, next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const mapping = json.data?.[0];
    if (!mapping) return null;
    // The related item URL points at the Kitsu anime item (e.g. .../mappings/254652/item)
    const related = mapping.relationships?.item?.links?.related;
    if (!related) return null;
    const itemRes = await fetch(related, {
      headers: { "Accept": "application/vnd.api+json" },
      next: { revalidate: 86400 },
    });
    if (!itemRes.ok) return null;
    const itemJson = await itemRes.json();
    return itemJson.data?.id ?? null;
  } catch {
    return null;
  }
}

// ─── Kitsu fallback enrichment ───
// When AniList is down, `getAnimeDetailFromKitsu` fills the detail via Kitsu.
// These helpers populate the fields AniList normally supplies (characters +
// voice actors, staff/director, relations/seasons, recommendations) so the
// anime detail page stays fully rendered during an AniList outage.

/**
 * Kitsu poster URLs come in two domains depending on when the metadata was
 * written: `media.kitsu.app/anime/poster_images/{id}/large.jpg` (stable) and
 * `kitsu-production-media.s3...backblazeb2.com/anime/poster_image/{hash}.jpg?X-Amz-...`
 * (signed URLs that expire after 900s). The Backblaze bucket is publicly readable,
 * so stripping the query string makes the URL permanent. media.kitsu.app URLs are
 * left as-is.
 */
function normalizeKitsuPoster(url: string | null | undefined, kitsuId?: number | string): string | null {
  if (!url) return null;
  if (url.includes("media.kitsu.app")) return url;
  // Strip the expiring X-Amz signature query string from Backblaze URLs.
  const q = url.indexOf("?");
  return q > 0 ? url.slice(0, q) : url;
}

/** Resolve a Kitsu anime id → { anilistId, malId } via Kitsu's mappings (no AniList dep). */
async function resolveKitsuIdToExternal(kitsuId: string): Promise<{ anilistId: number | null; malId: number | null }> {
  try {
    const res = await fetch(`${KITSU_ANIME_API}/${kitsuId}?include=mappings`, {
      headers: { "Accept": "application/vnd.api+json" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return { anilistId: null, malId: null };
    const json = await res.json();
    let anilistId: number | null = null;
    let malId: number | null = null;
    for (const inc of json.included || []) {
      if (inc.type !== "mappings") continue;
      const site = inc.attributes?.externalSite;
      const ext = inc.attributes?.externalId;
      if (site === "anilist/anime" && ext) anilistId = Number(ext);
      if (site === "myanimelist/anime" && ext) malId = Number(ext);
    }
    return { anilistId, malId };
  } catch {
    return { anilistId: null, malId: null };
  }
}

/** Fetch characters + Japanese voice actors from Kitsu. */
async function fetchKitsuCharacters(kitsuId: string): Promise<AnimeDetail["characters"]> {
  try {
    const res = await fetch(
      `${KITSU_ANIME_API}/${kitsuId}/characters?page%5Blimit%5D=20&include=character`,
      { headers: { "Accept": "application/vnd.api+json" }, next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];
    const json = await res.json();

    // character id → name + image
    const charMeta = new Map<string, { name: string; image: string | null }>();
    for (const inc of json.included || []) {
      if (inc.type !== "characters") continue;
      const a = inc.attributes || {};
      charMeta.set(inc.id, {
        name: a.canonicalName || a.name || "Unknown",
        image: (a.image && (a.image.tiny || a.image.large || a.image.original)) || null,
      });
    }

    // Build the character list (mediaCharacter id → character)
    const roles: { mediaCharacterId: string; role: string; name: string; image: string | null }[] = [];
    for (const mc of json.data || []) {
      const role = ((mc.attributes?.role) || "supporting").toUpperCase();
      const cid = mc.relationships?.character?.data?.id;
      const meta = (cid && charMeta.get(cid)) || { name: "Unknown", image: null };
      roles.push({ mediaCharacterId: mc.id, role, name: meta.name, image: meta.image });
    }

    // Sort: MAIN first, then others (mirrors AniList order)
    const ordered = [
      ...roles.filter((r) => r.role === "MAIN"),
      ...roles.filter((r) => r.role !== "MAIN"),
    ].slice(0, 20);

    // Fetch Japanese voice actors per media-character (limited batch).
    const out: AnimeDetail["characters"] = [];
    for (const c of ordered) {
      let voiceActor = "";
      try {
        const vRes = await fetch(
          `${KITSU_MEDIA_CHARACTERS_API}/${c.mediaCharacterId}/voices?include=person&page%5Blimit%5D=20`,
          { headers: { "Accept": "application/vnd.api+json" }, next: { revalidate: 86400 } }
        );
        if (vRes.ok) {
          const vJson = await vRes.json();
          const people = new Map<string, string>();
          for (const inc of vJson.included || []) {
            if (inc.type === "people") people.set(inc.id, inc.attributes?.name || "");
          }
          for (const v of vJson.data || []) {
            if (v.attributes?.locale !== "ja_jp") continue;
            const pid = v.relationships?.person?.data?.id;
            if (pid && people.get(pid)) { voiceActor = people.get(pid)!; break; }
          }
        }
      } catch {}
      out.push({ name: c.name, role: c.role, voiceActor, image: c.image });
    }
    return out;
  } catch {
    return [];
  }
}

/** Fetch staff (director, writers, etc.) from Kitsu. */
async function fetchKitsuStaff(kitsuId: string): Promise<AnimeDetail["staff"]> {
  try {
    const res = await fetch(
      `${KITSU_ANIME_API}/${kitsuId}/staff?page%5Blimit%5D=10&include=person`,
      { headers: { "Accept": "application/vnd.api+json" }, next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const people = new Map<string, string>();
    for (const inc of json.included || []) {
      if (inc.type === "people") people.set(inc.id, inc.attributes?.name || "");
    }
    const seen = new Set<string>();
    const out: AnimeDetail["staff"] = [];
    for (const s of json.data || []) {
      const role = (s.attributes?.role || "Staff").split(",")[0].trim();
      const pid = s.relationships?.person?.data?.id;
      const name = (pid && people.get(pid)) || "Unknown";
      const key = `${name}-${role}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: Number(s.id) || 0, name, role, image: null });
    }
    return out;
  } catch {
    return [];
  }
}

/** Fetch recommendations from Jikan/MAL (AniList has none when down; Kitsu has none at all). */
async function fetchJikanRecommendations(malId: number): Promise<AnimeRecItem[]> {
  if (!malId) return [];
  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}/recommendations`, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const recs = (json.data || []).slice(0, 12);
    const out: AnimeRecItem[] = [];
    for (const r of recs) {
      const entry = r.entry || {};
      const recMalId = entry.mal_id;
      if (!recMalId) continue;
      // Map MAL id → AniList id so /anime/{id} links work.
      // (Jikan returns MAL ids; our anime routes use AniList ids.)
      let anilistId: number | null = null;
      try {
        const jid = await resolveMalIdToAnilist(recMalId);
        anilistId = jid;
      } catch {}
      out.push({
        id: anilistId || recMalId,
        title: entry.title || "Unknown",
        poster: entry.images?.jpg?.large_image_url || entry.images?.jpg?.image_url || null,
        rating: 0,
        year: 0,
        genres: [],
      });
    }
    return out.filter((x) => x.title !== "Unknown");
  } catch {
    return [];
  }
}

/** Resolve a MAL (MyAnimeList) id → AniList id via Jikan anime endpoint (side data) OR Kitsu mappings. */
async function resolveMalIdToAnilist(malId: number): Promise<number | null> {
  try {
    // Kitsu mappings can resolve via MAL external site too.
    const res = await fetch(
      `${KITSU_MAPPINGS_API}?filter[externalSite]=myanimelist/anime&filter[externalId]=${malId}&page[limit]=1`,
      { headers: { "Accept": "application/vnd.api+json" }, next: { revalidate: 86400 } }
    );
    if (res.ok) {
      const json = await res.json();
      const mapping = json.data?.[0];
      if (mapping) {
        const related = mapping.relationships?.item?.links?.related;
        if (related) {
          const itemRes = await fetch(related, { headers: { "Accept": "application/vnd.api+json" }, next: { revalidate: 86400 } });
          if (itemRes.ok) {
            const itemJson = await itemRes.json();
            const kitsuId = itemJson.data?.id;
            if (kitsuId) {
              const ext = await resolveKitsuIdToExternal(String(kitsuId));
              if (ext.anilistId) return ext.anilistId;
            }
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}


function buildAnimeDetailFromKitsu(item: any): AnimeDetail | null {
  if (!item) return null;
  const a = item.attributes || {};
  const titleEn = a.titles?.en || a.canonicalTitle || "";
  const titleEnJp = a.titles?.en_jp || "";
  const titleJa = a.titles?.ja_jp || "";
  const title = titleEn || titleEnJp || a.canonicalTitle || "Unknown";
  const poster = a.posterImage?.large || a.posterImage?.original || a.posterImage?.medium || null;
  const cover = a.coverImage?.original || a.coverImage?.large || null;
  const rating = a.averageRating ? Math.round((a.averageRating / 10) * 10) / 10 : 0;
  const startYear = a.startDate ? Number(String(a.startDate).slice(0, 4)) || 0 : 0;

  return {
    id: item.id ? Number(item.id) : 0,
    idMal: 0,
    title,
    titleRomaji: titleEnJp || titleEn,
    titleNative: titleJa,
    titles: (a.titles && typeof a.titles === "object") ? a.titles : {},
    overview: (a.synopsis || "").slice(0, 2000),
    poster,
    backdrop: cover,
    rating,
    popularity: 0,
    year: startYear,
    season: "",
    format: "TV",
    status: (a.status || "finished").toUpperCase(),
    episodes: a.episodeCount || 0,
    duration: a.episodeLength || 0,
    genres: [],
    tags: [],
    studios: [],
    staff: [],
    characters: [],
    recommendations: [],
    trailer: a.youtubeVideoId ? { id: a.youtubeVideoId, site: "YouTube" } : null,
    trailers: a.youtubeVideoId ? [{ key: a.youtubeVideoId, name: "Trailer" }] : [],
    relations: [],
  };
}

/** Fallback entry point: try AniList ID → Kitsu, used when AniList GraphQL is down. */
export async function getAnimeDetailFromKitsu(anilistId: number): Promise<AnimeDetail | null> {
  try {
    const kitsuId = await resolveAnilistIdToKitsu(anilistId);
    if (!kitsuId) return null;
    const res = await fetch(`${KITSU_ANIME_API}/${kitsuId}`, {
      headers: { "Accept": "application/vnd.api+json" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const detail = buildAnimeDetailFromKitsu(json.data);
    if (!detail) return null;

    // Enrich the fallback detail with the fields AniList normally supplies,
    // using Kitsu/Jikan so the anime page stays complete while AniList is down.
    const external = await resolveKitsuIdToExternal(kitsuId);
    const malId = external.malId || 0;
    // FIX: detail.id must be the AniList id, not the Kitsu id. buildAnimeDetailFromKitsu
    // sets id to the Kitsu id, which breaks /anime/{id} links (S1 would point at /anime/7442).
    detail.id = external.anilistId || anilistId;
    detail.idMal = external.malId || 0;
    const [characters, staff, recommendations] = await Promise.all([
      fetchKitsuCharacters(kitsuId),
      fetchKitsuStaff(kitsuId),
      fetchJikanRecommendations(malId),
    ]);
    detail.characters = characters;
    detail.staff = staff;
    // relations are NOT set here — enrichAnimeRelations (Kitsu BFS) recomputes the full
    // season chain at the page level from anilist ids, so leave relations empty to avoid
    // Kitsu-id leaking into the Seasons links.
    detail.relations = [];
    detail.recommendations = recommendations;
    return detail;
  } catch {
    return null;
  }
}

/** Fallback: fetch trending anime list from Kitsu (used when AniList is down).
 *  Returns items shaped like AniList trending results (TmdbResult-ish for the home page). */
type KitsuAnimeListResult = {
  id: number;
  title: string;
  poster: string | null;
  backdrop: string | null;
  rating: number;
  year: number;
  type: "anime";
  overview: string;
  genres: string[];
  daysUntil: number | null;
};

async function fetchKitsuTrendingAnime(limit = 14): Promise<KitsuAnimeListResult[]> {
  try {
    const res = await fetch(`https://kitsu.io/api/edge/trending/anime?limit=${limit}`, {
      headers: { "Accept": "application/vnd.api+json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const data = json.data || [];
    // Resolve each Kitsu id → AniList id (via mappings) so /anime/{id} links work.
    const out: KitsuAnimeListResult[] = await Promise.all(
      data.map(async (item: any): Promise<KitsuAnimeListResult | null> => {
        const a = item.attributes || {};
        const kitsuId = Number(item.id) || 0;
        if (!kitsuId) return null;
        // Fetch AniList id from Kitsu mappings (best-effort; ignore failures)
        let anilistId = kitsuId;
        try {
          const mRes = await fetch(`${KITSU_ANIME_API}/${kitsuId}?include=mappings`, {
            headers: { "Accept": "application/vnd.api+json" },
            next: { revalidate: 86400 },
          });
          if (mRes.ok) {
            const mJson = await mRes.json();
            const mapping = (mJson.included || []).find(
              (inc: any) => inc.type === "mappings" && inc.attributes?.externalSite === "anilist/anime"
            );
            if (mapping?.attributes?.externalId) anilistId = Number(mapping.attributes.externalId);
          }
        } catch {}
        const posterImg = a.posterImage || {};
        const coverImg = a.coverImage || {};
        const startYear = a.startDate ? Number(String(a.startDate).slice(0, 4)) || 0 : 0;
        // Prefer the official English title from ani.zip (Kitsu's canonicalTitle is
        // romaji like "Boku no Hero Academia", which we must NOT display).
        const anizip = await resolveKitsuIdToAnilist(kitsuId);
        const title = anizip?.titleEn || a.titles?.en || a.canonicalTitle || "Unknown";
        return {
          id: anilistId,
          title,
          poster: normalizeKitsuPoster(posterImg.large || posterImg.medium || posterImg.original, kitsuId),
          backdrop: coverImg.original || coverImg.large || null,
          rating: a.averageRating ? Math.round((a.averageRating / 10) * 10) / 10 : 0,
          year: startYear,
          type: "anime" as const,
          overview: (a.synopsis || "").slice(0, 300),
          genres: [],
          daysUntil: null,
        };
      })
    );
    return out.filter((r): r is KitsuAnimeListResult => r !== null);
  } catch {
    return [];
  }
}

// ─── Main fetch ───

/** Lightweight AniList query: only idMal + titles + duration. Used to parallelize detail + episodes. */
export const getAnimeIds = unstable_cache(
  async (id: number): Promise<{ idMal: number; title: string; titleRomaji: string; titleNative: string; duration: number }> => {
  // ani.zip provides idMal + titles in one call and works even when AniList is down
  const anizip = await fetchAniZipByAnilistId(id);
  const anizipTitle = anizip ? pickTitle(anizip.titles, "en") : null;
  const anizipRomaji = anizip?.titles?.["x-jat"] || null;
  const anizipNative = anizip?.titles?.["ja"] || null;
  const anizipMal = anizip?.mappings?.mal_id || 0;

  const query = `query($id:Int){Media(id:$id){idMal title{romaji english native} duration}}`;
  const res = await anilistFetch(query, { id }, { revalidate: 86400 });
  if (!res.ok) {
    // AniList down — prefer ani.zip titles, else Kitsu fallback
    if (anizip) {
      return {
        idMal: anizipMal,
        title: anizipTitle || anizipRomaji || "Unknown",
        titleRomaji: anizipRomaji || "",
        titleNative: anizipNative || "",
        duration: 0,
      };
    }
    const kd = await getAnimeDetailFromKitsu(id);
    if (kd) {
      return {
        idMal: kd.idMal || 0,
        title: kd.title,
        titleRomaji: kd.titleRomaji || "",
        titleNative: kd.titleNative || "",
        duration: kd.duration || 0,
      };
    }
    throw new Error("AniList failed");
  }
  const m = (await res.json()).data?.Media;
  return {
    idMal: anizipMal || m?.idMal || 0,
    title: m?.title?.english || m?.title?.romaji || anizipTitle || "Unknown",
    titleRomaji: anizipRomaji || m?.title?.romaji || "",
    titleNative: anizipNative || m?.title?.native || "",
    duration: m?.duration || 0,
  };
},
  ["anime-ids"],
  { revalidate: 86400 }
);

export const getAnimeDetail = unstable_cache(
  async (id: number): Promise<AnimeDetail | null> => {
  try {
    // ani.zip (AniDB) is the primary source for titles, poster, backdrop and
    // episodes. Fetch it first (single call) so multi-language titles and the
    // richer AniDB dataset win when available, and the site survives AniList
    // outages for title/poster/episode data.
    const anizip = await fetchAniZipByAnilistId(id);

    // Retry AniList fetch with backoff (handles 429 + network errors)
    let res: Response | undefined;
    for (let attempt = 1; attempt <= 3; attempt++) {
      res = await anilistFetch(DETAIL_QUERY, { id }, { revalidate: 3600 });
      if (res.ok) break; // success
      if (res.status === 429 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      } else if (!res.ok && attempt < 3) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    if (!res!.ok) {
      // AniList down — fall back to Kitsu (via AniList ID → Kitsu mapping)
      const kd = await getAnimeDetailFromKitsu(id);
      // If we still have ani.zip data, overlay its titles/poster/episodes so
      // the page keeps multi-language titles even during an AniList outage.
      if (kd && anizip) {
        kd.titles = anizip.titles || {};
        kd.titleRomaji = anizip.titles?.["x-jat"] || kd.titleRomaji;
        kd.titleNative = anizip.titles?.["ja"] || anizip.titles?.["x-jat"] || kd.titleNative;
        kd.poster = pickAniZipImage(anizip.images, "Poster") || kd.poster;
        kd.backdrop = pickAniZipImage(anizip.images, "Banner") || kd.backdrop;
        if (anizip.episodeCount) kd.episodes = anizip.episodeCount;
        if (anizip.mappings?.mal_id) kd.idMal = anizip.mappings.mal_id;
      }
      return kd;
    }
    const json = await res!.json();
    const m = json.data?.Media;
    if (!m) return getAnimeDetailFromKitsu(id);

    // Characters with voice actors
    const characters = (m.characters?.edges || []).map((e: any) => ({
      name: e.node?.name?.full || "Unknown",
      role: e.role || "",
      voiceActor: e.voiceActors?.[0]?.name?.full || "",
      image: e.node?.image?.medium || null,
    }));

    // Staff (directors, writers, etc.)
    const staff = (m.staff?.nodes || []).map((s: any) => ({
      id: s.id,
      name: s.name?.full || "Unknown",
      role: (s.primaryOccupations || [])[0] || "Staff",
      image: s.image?.medium || null,
    }));

    // Studios
    const studios = (m.studios?.nodes || [])
      .filter((s: any) => s.isAnimationStudio)
      .map((s: any) => s.name);

    // Recommendations
    const recommendations: AnimeRecItem[] = (m.recommendations?.nodes || [])
      .map((n: any) => {
        const r = n.mediaRecommendation;
        if (!r) return null;
        return {
          id: r.id,
          title: r.title?.english || r.title?.romaji || "Unknown",
          poster: r.coverImage?.extraLarge || r.coverImage?.large || null,
          rating: Math.round((r.averageScore / 10) * 10) / 10 || 0,
          year: r.seasonYear || 0,
          genres: (r.genres || []).slice(0, 4),
        };
      })
      .filter(Boolean);

    // Relations (sequels, prequels only — exclude side stories, spin-offs, crossovers)
    const relations = (m.relations?.edges || [])
      .filter((e: any) => e.node?.type === "ANIME" && (e.relationType === "SEQUEL" || e.relationType === "PREQUEL"))
      .map((e: any) => ({
        id: e.node.id,
        title: e.node.title?.english || e.node.title?.romaji || "Unknown",
        type: e.node.type || "ANIME",
        format: e.node.format || "",
        seasonYear: e.node.seasonYear || null,
        status: e.node.status || "",
      }));

    // Trailer
    const trailer = m.trailer?.site === "youtube" ? {
      id: m.trailer.id,
      site: "YouTube",
    } : null;

    // Tags (top 8, no spoilers)
    const tags = (m.tags || [])
      .filter((t: any) => !t.isGeneralSpoiler && !t.isMediaSpoiler)
      .sort((a: any, b: any) => b.rank - a.rank)
      .slice(0, 8)
      .map((t: any) => ({ name: t.name, rank: t.rank }));

    // Build result first (without trailer — validated below)
    const result: AnimeDetail = {
      id: m.id,
      idMal: anizip?.mappings?.mal_id || m.idMal || 0,
      title: m.title?.english || m.title?.romaji || "Unknown",
      titleRomaji: anizip?.titles?.["x-jat"] || m.title?.romaji || "",
      titleNative: anizip?.titles?.["ja"] || m.title?.native || "",
      titles: anizip?.titles || {},
      overview: (m.description || "").replace(/<br\s*\/?>/gi, " ").replace(/ {2,}/g, " ").trim(),
      poster: pickAniZipImage(anizip?.images, "Poster") || m.coverImage?.extraLarge || m.coverImage?.large || "",
      backdrop: pickAniZipImage(anizip?.images, "Banner") || m.bannerImage || "",
      rating: Math.round(((m.averageScore || 0) / 10) * 10) / 10,
      popularity: m.popularity || 0,
      year: m.seasonYear || 0,
      season: formatSeason(m.season),
      format: m.format || anizip?.mappings?.type || "TV",
      status: formatStatus(m.status),
      episodes: anizip?.episodeCount || m.episodes || 0,
      duration: m.duration || 0,
      genres: m.genres || [],
      tags,
      studios,
      staff,
      characters,
      recommendations,
      trailer: null as { id: string; site: string } | null,
      trailers: [] as { key: string; name: string }[],
      relations,
    };
    // Compute daysUntil for upcoming anime
    const sd = m.startDate;
    if (sd?.year && sd?.month && sd?.day) {
      const release = new Date(sd.year, sd.month - 1, sd.day);
      const diff = Math.ceil((release.getTime() - Date.now()) / 86400000);
      if (diff > 0) result.daysUntil = diff;
    }
    // Kitsu backdrop fallback when AniList bannerImage is null
    if (!result.backdrop && result.year) {
      result.backdrop = (await fetchKitsuBackdrop(result.title, result.year, result.titleRomaji)) || "";
    }
    // Validate trailer (if AniList has one) or search YouTube (if not) — fetch up to 3
    const animeTitle = m.title?.english || m.title?.romaji || "";
    const validated = await validateAndReplaceTrailers(
      trailer ? [{ key: trailer.id, name: "Trailer" }] : [],
      `${animeTitle} anime official trailer`,
      3,
      undefined,
      m.id
    );
    if (validated.length > 0) {
      result.trailer = { id: validated[0].key, site: "YouTube" };
      result.trailers = validated.map((v) => ({ key: v.key, name: v.name || "Trailer" }));
    }

    // YouTube trailer thumbnail as backdrop fallback when AniList/Kitsu both miss
    if (!result.backdrop && result.trailer) {
      result.backdrop = `https://img.youtube.com/vi/${result.trailer.id}/maxresdefault.jpg`;
    }

    return result;
  } catch {
    return null;
  }
},
  ["anime-detail-v2"],
  { revalidate: 86400 }
);

// ─── TMDB ID → AniList ID resolution (cached 24h) ───

const _getAnilistIdCached = unstable_cache(
  async (tmdbId: number): Promise<number | null> => {
  // Parallel: try AniList direct + Supabase lookup simultaneously
  const results = await Promise.all([
    // AniList direct
    anilistFetch(`query($id:Int){Media(id:$id,type:ANIME){id}}`, { id: tmdbId }, { revalidate: 86400 }).then(async (directRes) => {
      if (!directRes.ok) return null;
      const dj = await directRes.json();
      return dj.data?.Media?.id || null;
    }).catch(() => null),
    // Supabase
    (async () => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data } = await supabase
          .from("media_trackings")
          .select("anilist_id")
          .eq("tmdb_id", tmdbId)
          .not("anilist_id", "is", null)
          .limit(1)
          .maybeSingle();
        return data?.anilist_id || null;
      } catch { return null; }
    })(),
  ]);

  if (results[0]) return results[0];
  if (results[1]) return results[1];

  // Fallback: search AniList via Jikan (MAL ID → AniList)
  try {
    const jikanRes = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(String(tmdbId))}&limit=1`, {
      next: { revalidate: 86400 },
    });
    if (jikanRes.ok) {
      const jd = await jikanRes.json();
      const malId = jd?.data?.[0]?.mal_id;
      if (malId) {
        const anilistRes = await anilistFetch(`query($idMal:Int){Media(idMal:$idMal,type:ANIME){id}}`, { idMal: malId }, { revalidate: 86400 });
        if (anilistRes.ok) {
          const aj = await anilistRes.json();
          return aj.data?.Media?.id || null;
        }
      }
    }
  } catch {}

  return null;
},
  ["anilist-id-resolve"],
  { revalidate: 86400 }
);

// Wrapper: if cached result is null (stale failure), retry once fresh
export async function getAnilistId(tmdbId: number): Promise<number | null> {
  const cached = await _getAnilistIdCached(tmdbId);
  if (cached !== null) return cached;
  // Null cached — one fresh retry
  try {
    const res = await anilistFetch(`query($id:Int){Media(id:$id,type:ANIME){id}}`, { id: tmdbId });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.Media?.id ?? null;
  } catch { return null; }
}

// ─── Episode fetching (Jikan primary + Kitsu/AniDB fallback) ───

const JIKAN_API = "https://api.jikan.moe/v4";

async function fetchJikanEpisodes(malId: number): Promise<AnimeEpisode[]> {
  if (!malId || malId <= 0) return [];
  try {
    // Fetch page 1 to detect total pages
    const firstRes = await fetch(`${JIKAN_API}/anime/${malId}/episodes?page=1`, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 86400 },
    });
    if (!firstRes.ok) return [];
    const firstData = await firstRes.json();
    const firstPage: AnimeEpisode[] = (firstData.data || []).map((ep: any) => ({
      number: ep.mal_id || 0,
      title: ep.title || `Episode ${ep.mal_id}`,
      titleJapanese: ep.title_japanese || "",
      airDate: ep.aired ? ep.aired.slice(0, 10) : "",
      thumbnail: null,
      synopsis: ep.synopsis || "",
      duration: ep.duration || 0,
    }));

    const totalPages = firstData.pagination?.last_visible_page || 1;
    if (totalPages <= 1) return firstPage.sort((a, b) => a.number - b.number);

    // Fetch remaining pages in parallel (cached, runs once per anime per day)
    const remainingResults = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) => i + 2).map(async (page) => {
        try {
          const res = await fetch(`${JIKAN_API}/anime/${malId}/episodes?page=${page}`, {
            headers: { "Accept": "application/json" },
            next: { revalidate: 86400 },
          });
          if (!res.ok) return [] as AnimeEpisode[];
          const data = await res.json();
          return ((data.data || []) as any[]).map((ep: any) => ({
            number: ep.mal_id || 0,
            title: ep.title || `Episode ${ep.mal_id}`,
            titleJapanese: ep.title_japanese || "",
            airDate: ep.aired ? ep.aired.slice(0, 10) : "",
            thumbnail: null,
            synopsis: ep.synopsis || "",
            duration: ep.duration || 0,
          }));
        } catch {
          return [] as AnimeEpisode[];
        }
      })
    );

    const allEpisodes = [firstPage, ...remainingResults].flat();
    return allEpisodes.sort((a, b) => a.number - b.number);
  } catch {
    return [];
  }
}

const KITSU_API = "https://kitsu.io/api/edge";

// ─── Kitsu Anime ID lookup (cached per title) ───

async function findKitsuAnimeId(title: string): Promise<number | null> {
  try {
    const searchUrl = `${KITSU_API}/anime?filter[text]=${encodeURIComponent(title)}&page[limit]=3`;
    const res = await fetch(searchUrl, {
      headers: { "Accept": "application/vnd.api+json" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.data || [];
    return results[0]?.id || null;
  } catch {
    return null;
  }
}

// ─── Kitsu Episode Fetch (sequential, for fallback) ───

async function fetchKitsuEpisodes(title: string, maxPages = 5): Promise<AnimeEpisode[]> {
  try {
    const animeId = await findKitsuAnimeId(title);
    if (!animeId) return [];

    const allEpisodes: any[] = [];
    let offset = 0;
    const pageLimit = 20;
    while (allEpisodes.length < pageLimit * maxPages) {
      const epUrl = `${KITSU_API}/anime/${animeId}/episodes?page%5Blimit%5D=${pageLimit}&page%5Boffset%5D=${offset}&sort=number`;
      const epRes = await fetch(epUrl, {
        headers: { "Accept": "application/vnd.api+json" },
        next: { revalidate: 86400 },
      });
      if (!epRes.ok) break;
      const epData = await epRes.json();
      const page = epData.data || [];
      if (page.length === 0) break;
      allEpisodes.push(...page);
      if (page.length < pageLimit) break;
      offset += pageLimit;
    }

    return allEpisodes.map((ep: any) => {
      const attrs = ep.attributes || {};
      const titles = attrs.titles || {};
      const thumb = attrs.thumbnail?.original || null;
      return {
        number: attrs.number || 0,
        title: attrs.canonicalTitle || titles.en_us || titles.en_jp || `Episode ${attrs.number}`,
        titleJapanese: titles.ja_jp || "",
        airDate: attrs.airdate || "",
        thumbnail: thumb,
        synopsis: attrs.synopsis || attrs.description || "",
        duration: attrs.length || 0,
      };
    });
  } catch {
    return [];
  }
}

// ─── Kitsu Thumbnails-Only (parallel, high performance) ───

export async function fetchKitsuThumbnails(title: string, totalPages = 100): Promise<Map<number, string>> {
  const thumbs = new Map<number, string>();
  try {
    const animeId = await findKitsuAnimeId(title);
    if (!animeId) return thumbs;

    const pageLimit = 20;
    const batchSize = 10; // parallel fetches per batch

    // First: fetch page 1 to detect total pages
    const firstUrl = `${KITSU_API}/anime/${animeId}/episodes?page%5Blimit%5D=${pageLimit}&page%5Boffset%5D=0&sort=number`;
    const firstRes = await fetch(firstUrl, {
      headers: { "Accept": "application/vnd.api+json" },
      next: { revalidate: 86400 },
    });
    if (!firstRes.ok) return thumbs;
    const firstData = await firstRes.json();
    const firstPage = firstData.data || [];
    for (const ep of firstPage) {
      const attrs = ep.attributes || {};
      const thumb = attrs.thumbnail?.original || null;
      if (thumb) thumbs.set(attrs.number || 0, thumb);
    }
    if (firstPage.length < pageLimit) return thumbs; // single page series

    // Batch-fetch remaining pages in parallel
    const maxPages = Math.min(totalPages, Math.ceil(firstData.meta?.count / pageLimit) || totalPages);
    for (let batchStart = 1; batchStart < maxPages; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, maxPages);
      const promises: Promise<void>[] = [];

      for (let page = batchStart; page < batchEnd; page++) {
        const offset = page * pageLimit;
        const url = `${KITSU_API}/anime/${animeId}/episodes?page%5Blimit%5D=${pageLimit}&page%5Boffset%5D=${offset}&sort=number`;
        promises.push(
          fetch(url, {
            headers: { "Accept": "application/vnd.api+json" },
            next: { revalidate: 86400 },
          }).then(async (res) => {
            if (!res.ok) return;
            const data = await res.json();
            for (const ep of data.data || []) {
              const attrs = ep.attributes || {};
              const thumb = attrs.thumbnail?.original || null;
              if (thumb) thumbs.set(attrs.number || 0, thumb);
            }
          }).catch(() => {})
        );
      }

      await Promise.all(promises);
    }
  } catch {
    // Fail silently
  }
  return thumbs;
}

async function fetchAniDBEpisodes(title: string): Promise<AnimeEpisode[]> {
  try {
    // Step 1: Download titles dump and find AID
    const dumpRes = await fetch("https://anidb.net/api/animetitles.xml.gz", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept-Encoding": "gzip" },
      next: { revalidate: 86400 },
    });
    if (!dumpRes.ok) return [];

    // Gunzip in Node.js
    const { gunzipSync } = await import("zlib");
    const buf = Buffer.from(await dumpRes.arrayBuffer());
    const xml = gunzipSync(buf).toString("utf-8");

    // Simple regex to find matching anime ID
    const titleLower = title.toLowerCase();
    const animeRegex = /<anime\s+aid="(\d+)">([\s\S]*?)<\/anime>/g;
    let aid: string | null = null;
    let match;
    while ((match = animeRegex.exec(xml)) !== null) {
      const block = match[2].toLowerCase();
      if (block.includes(titleLower)) {
        aid = match[1];
        break;
      }
    }
    if (!aid) return [];

    // Step 2: Fetch full anime data with episodes
    const apiUrl = `http://api.anidb.net:9001/httpapi?request=anime&client=seriez&clientver=1&protover=1&aid=${aid}`;
    const apiRes = await fetch(apiUrl, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept-Encoding": "gzip" },
      next: { revalidate: 86400 },
    });
    if (!apiRes.ok) return [];

    const apiBuf = Buffer.from(await apiRes.arrayBuffer());
    let apiXml: string;
    try {
      apiXml = gunzipSync(apiBuf).toString("utf-8");
    } catch {
      apiXml = apiBuf.toString("utf-8");
    }

    // Parse episodes
    const epRegex = /<episode[^>]*>([\s\S]*?)<\/episode>/g;
    const episodes: AnimeEpisode[] = [];
    let epMatch;
    while ((epMatch = epRegex.exec(apiXml)) !== null) {
      const block = epMatch[1];

      // Skip OPs/EDs (type != 1)
      const typeMatch = block.match(/<epno[^>]*type="(\d+)"/);
      if (typeMatch && typeMatch[1] !== "1") continue;

      const num = parseInt(block.match(/<epno[^>]*>(\d+)<\/epno>/)?.[1] || "0");
      if (num === 0) continue;

      const enTitle = block.match(/<title xml:lang="en">([^<]*)<\/title>/)?.[1] || "";
      const jaTitle = block.match(/<title xml:lang="ja">([^<]*)<\/title>/)?.[1] || "";
      const airDate = block.match(/<airdate>([^<]*)<\/airdate>/)?.[1] || "";
      const duration = parseInt(block.match(/<length>(\d+)<\/length>/)?.[1] || "0");
      const synopsis = (block.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] || "").trim();

      episodes.push({
        number: num,
        title: enTitle || `Episode ${num}`,
        titleJapanese: jaTitle,
        airDate,
        thumbnail: null,
        synopsis,
        duration,
      });
    }

    return episodes.sort((a, b) => a.number - b.number);
  } catch {
    return [];
  }
}

// ─── AniList streamingEpisodes → Crunchyroll thumbnails ───

async function fetchAniListStreamingThumbnails(title: string): Promise<Map<number, string>> {
  const thumbs = new Map<number, string>();
  try {
    // Search AniList by title, get streamingEpisodes
    const query = `
    query($search: String) {
      Media(search: $search, type: ANIME) {
        streamingEpisodes {
          title
          thumbnail
          url
          site
        }
      }
    }`;
    const res = await anilistFetch(query, { search: title }, { revalidate: 86400 });
    if (!res.ok) return thumbs;
    const json = await res.json();
    const eps = json.data?.Media?.streamingEpisodes || [];

    for (const ep of eps) {
      if (ep.site !== "Crunchyroll" || !ep.thumbnail) continue;
      // Extract episode number from title (e.g., "Episode 130 - ...")
      const numMatch = ep.title?.match(/Episode\s+(\d+)/i);
      if (!numMatch) continue;
      const num = parseInt(numMatch[1]);
      thumbs.set(num, ep.thumbnail);
    }
  } catch {
    // Fail silently
  }
  return thumbs;
}

// ─── Crunchyroll RSS Episode Thumbnails (free, no API key) ───

async function fetchCrunchyrollThumbnails(title: string): Promise<Map<number, string>> {
  const thumbs = new Map<number, string>();
  try {
    const res = await fetch("https://www.crunchyroll.com/rss/anime", {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return thumbs;
    const xml = await res.text();

    // Parse RSS items — match series title and extract episode number + thumbnail
    const titleLower = title.toLowerCase();
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const seriesTitle = block.match(/<crunchyroll:seriesTitle>([^<]*)<\/crunchyroll:seriesTitle>/)?.[1] || "";
      if (!seriesTitle.toLowerCase().includes(titleLower)) continue;

      const epNum = block.match(/<crunchyroll:episodeNumber>([^<]*)<\/crunchyroll:episodeNumber>/)?.[1] || "";
      const num = parseInt(epNum);
      if (!num) continue;

      const enclosure = block.match(/<enclosure[^>]*url="([^"]+)"/)?.[1] || "";
      if (enclosure) thumbs.set(num, enclosure);
    }
  } catch {
    // Fail silently
  }
  return thumbs;
}

export const getAnimeEpisodes = unstable_cache(
  async (
  title: string,
  titleRomaji: string,
  idMal?: number,
  titleNative?: string,
  seriesDuration?: number,
  anilistId?: number
): Promise<AnimeEpisode[]> => {
  let episodes: AnimeEpisode[] = [];

  // Track 0: ani.zip (AniDB) — primary and most accurate, fetched directly by
  // AniList id (no fuzzy title search). Provides episode titles in multiple
  // languages, air dates, runtimes and TVDB thumbnails in a single call.
  if (anilistId && anilistId > 0) {
    const anizip = await fetchAniZipByAnilistId(anilistId);
    const anizipEps = anizipEpisodesToAnimeEpisodes(anizip?.episodes);
    if (anizipEps.length > 0) {
      episodes = anizipEps;
    }
  }

  // Track A: Kitsu (primary — has episode numbers, most complete for airing shows
  // where Jikan/MAL data lags behind. Avoid Jikan's missing/empty episode lists.)
  if (episodes.length === 0) {
    const searchTitle = titleRomaji || title;
    let kitsuEps = await fetchKitsuEpisodes(searchTitle);
    if (kitsuEps.length === 0 && title !== searchTitle) {
      kitsuEps = await fetchKitsuEpisodes(title);
    }
    if (kitsuEps.length > 0) {
      episodes = kitsuEps;
    }
  }

  // Track B: Jikan (MyAnimeList) — fallback when Kitsu has nothing
  if (episodes.length === 0 && idMal && idMal > 0) {
    const jikanEps = await fetchJikanEpisodes(idMal);
    if (jikanEps.length > 0) episodes = jikanEps;
  }

  // Track C: AniDB fallback (slower, no thumbnails)
  if (episodes.length === 0) {
    const anidbEps = await fetchAniDBEpisodes(titleRomaji || title);
    if (anidbEps.length > 0) episodes = anidbEps;
  }

  // Merge anime-native thumbnails into episodes (Kitsu + AniList streaming +
  // Crunchyroll RSS). TMDB/TVmaze are intentionally excluded — anime pages must
  // never use TMDB data, which would surface live-action adaptation thumbnails.
  if (episodes.length > 0) {
    // Parallel: Kitsu + AniList streaming + Crunchyroll RSS (all independent sources)
    const searchTitle = titleRomaji || title;
    const [kitsuThumbs, alThumbs, crThumbs] = await Promise.all([
      episodes.filter(ep => !ep.thumbnail).length > 0
        ? fetchKitsuThumbnails(searchTitle, 100).catch(() => new Map<number, string>())
        : Promise.resolve(new Map<number, string>()),
      fetchAniListStreamingThumbnails(searchTitle).catch(() => new Map<number, string>()),
      fetchCrunchyrollThumbnails(searchTitle).catch(() => new Map<number, string>()),
    ]);

    // Apply Kitsu thumbnails
    if (kitsuThumbs.size > 0) {
      episodes = episodes.map(ep => {
        if (ep.thumbnail) return ep;
        const thumb = kitsuThumbs.get(ep.number);
        return thumb ? { ...ep, thumbnail: thumb } : ep;
      });
    }
    // Apply AniList streaming thumbnails
    if (alThumbs.size > 0) {
      episodes = episodes.map(ep => {
        if (ep.thumbnail) return ep;
        const thumb = alThumbs.get(ep.number);
        return thumb ? { ...ep, thumbnail: thumb } : ep;
      });
    }
    // Apply Crunchyroll RSS thumbnails
    if (crThumbs.size > 0) {
      episodes = episodes.map(ep => {
        if (ep.thumbnail) return ep;
        const thumb = crThumbs.get(ep.number);
        return thumb ? { ...ep, thumbnail: thumb } : ep;
      });
    }
  }

  // Apply seriesDuration as fallback for episodes with missing duration
  if (seriesDuration && seriesDuration > 0) {
    episodes = episodes.map(ep => 
      ep.duration > 0 ? ep : { ...ep, duration: seriesDuration }
    );
  }

  return episodes;
  },
  ["anime-episodes"],
  { revalidate: 86400 }
);

// ─── Deep relations enrichment ───

/**
 * Collect ALL TV anime seasons (sequel/prequel chain) via AniList relations BFS.
 * AniList's `relations` is the most accurate and complete source for "which anime
 * is the sequel/prequel" and tags each edge with SEQUEL/PREQUEL + the target's
 * format (TV/SPECIAL/MOVIE). We follow only TV-format SEQUEL/PREQUEL edges, which
 * yields the clean season chain (e.g. SAO → SAO II directly, skipping the SPECIAL
 * "Extra Edition" that Kitsu/MAL route through).
 *
 * AniList previously returned 403; that was a bot-block triggered by missing
 * Origin/Referer headers. Sending `Origin: https://anilist.co` fixes it.
 */
export const enrichAnimeRelations = async (
  currentId: number,
  _existingRelations: { id: number; title: string; type: string; format: string; seasonYear: number | null; status?: string }[],
  currentYear: number,
): Promise<{ id: number; title: string; type: string; format: string; seasonYear: number | null; isOriginal: boolean }[]> => {
  return persistentCache("enrichAnimeRelationsAniList", [currentId, currentYear], 60, async () => {
    const seen = new Set<number>();
    const queued = new Set<number>([currentId]);
    const result: { id: number; title: string; format: string; seasonYear: number | null }[] = [];

    const queue: number[] = [currentId];
    let earliestYear = currentYear || Infinity;
    let earliestId = currentId;

    while (queue.length > 0) {
      const batch = queue.splice(0, 6);
      const neighbors = await Promise.all(
        batch.map((anilistId) => fetchAniListSeasonNeighbors(anilistId))
      );

      for (const items of neighbors) {
        for (const n of items) {
          if (seen.has(n.id)) continue;
          seen.add(n.id);
          if (n.id === currentId) continue;
          // Display only TV entries as seasons, but keep walking THROUGH
          // intermediary movies/specials so the chain isn't broken (e.g.
          // SAO II → Ordinal Scale (movie) → Alicization).
          if (n.format === "TV") {
            result.push({ id: n.id, title: n.title, format: "TV", seasonYear: n.seasonYear });
            if (n.seasonYear && n.seasonYear <= earliestYear) { earliestYear = n.seasonYear; earliestId = n.id; }
          }
          if (!queued.has(n.id)) {
            queued.add(n.id);
            queue.push(n.id);
          }
        }
      }
    }

    // Dedupe by anilist id (preserve insertion order).
    const seenId = new Set<number>();
    const deduped: { id: number; title: string; format: string; seasonYear: number | null }[] = [];
    for (const r of result) {
      if (seenId.has(r.id)) continue;
      seenId.add(r.id);
      deduped.push(r);
    }

    return deduped.map(r => ({
      id: r.id,
      title: r.title,
      type: "ANIME" as const,
      format: r.format,
      seasonYear: r.seasonYear,
      isOriginal: r.id === earliestId,
    }));
  });
};

/**
 * Fetch one level of sequel/prequel neighbors for an AniList id, returning BOTH
 * TV and non-TV (SPECIAL/MOVIE/OVA) targets. The BFS uses this to keep walking
 * the chain THROUGH intermediary movies/specials (e.g. SAO II → "Ordinal Scale"
 * movie → Alicization) while still only displaying TV entries as seasons.
 * Sends Origin/Referer so AniList doesn't 403.
 */
async function fetchAniListSeasonNeighbors(anilistId: number): Promise<{ id: number; title: string; format: string; seasonYear: number | null }[]> {
  try {
    const query = `query($id:Int){Media(id:$id){relations{edges{relationType node{id title{english romaji} format seasonYear}}}}}`;
    const res = await anilistFetch(query, { id: anilistId }, { revalidate: 86400 });
    if (!res.ok) return [];
    const json = await res.json();
    const edges = json.data?.Media?.relations?.edges || [];
    const out: { id: number; title: string; format: string; seasonYear: number | null }[] = [];
    for (const e of edges) {
      const rel = e.relationType;
      if (rel !== "SEQUEL" && rel !== "PREQUEL") continue;
      const node = e.node;
      if (!node) continue;
      out.push({
        id: node.id,
        title: node.title?.english || node.title?.romaji || "Unknown",
        format: node.format || "",
        seasonYear: node.seasonYear || null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

// ─── Staff Detail ───

export type StaffDetail = {
  id: number;
  name: string;
  nativeName: string;
  photo: string | null;
  birthday: string | null;
  birthplace: string | null;
  description: string | null;
  knownFor: string;
  credits: {
    id: number;
    title: string;
    format: string;
    poster: string | null;
    rating: number;
  }[];
};

export async function getStaffDetail(id: number): Promise<StaffDetail | null> {
  try {
    const query = `
      query {
        Staff(id: ${id}) {
          id
          name { full native }
          image { large }
          description
          primaryOccupations
          dateOfBirth { year month day }
          age
          homeTown
          staffMedia(sort: POPULARITY_DESC, perPage: 20) {
            edges {
              staffRole
              node {
                id
                title { romaji english }
                type
                format
                coverImage { large }
                averageScore
              }
            }
          }
        }
      }
    `;
    const res = await anilistFetch(query, {}, { revalidate: 86400 });
    if (!res.ok) return null;
    const json = await res.json();
    const s = json?.data?.Staff;
    if (!s) return null;

    const birthday = s.dateOfBirth?.year
      ? `${s.dateOfBirth.year}-${String(s.dateOfBirth.month || 1).padStart(2, "0")}-${String(s.dateOfBirth.day || 1).padStart(2, "0")}`
      : null;

    // Gather director-role entries, deduplicate by id (prioritize full "Director" over "Episode Director")
    const seenIds = new Map<number, { title: string; format: string; poster: string | null; rating: number; isFullDirector: boolean }>();
    for (const e of (s.staffMedia?.edges || [])) {
      const role = e.staffRole || "";
      if (!role.includes("Director")) continue;
      const n = e.node;
      const id = n.id;
      const isFullDirector = role === "Director";
      const existing = seenIds.get(id);
      if (!existing || (isFullDirector && !existing.isFullDirector)) {
        seenIds.set(id, {
          title: n.title?.english || n.title?.romaji || "Unknown",
          format: n.format || "Unknown",
          poster: n.coverImage?.large || null,
          rating: n.averageScore ? Math.round(n.averageScore / 10) : 0,
          isFullDirector,
        });
      }
    }
    const credits = Array.from(seenIds.entries()).map(([id, info]) => ({
      id,
      title: info.title,
      format: info.format,
      poster: info.poster,
      rating: info.rating,
    }));

    return {
      id: s.id,
      name: s.name?.full || "Unknown",
      nativeName: s.name?.native || "",
      photo: s.image?.large || null,
      birthday,
      birthplace: s.homeTown || null,
      description: s.description || null,
      knownFor: (s.primaryOccupations || [])[0] || "Staff",
      credits,
    };
  } catch {
    return null;
  }
}

// ─── Upcoming anime (NOT_YET_RELEASED, sorted by popularity) ───

const UPCOMING_QUERY = `
query UpcomingAnime($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(status: NOT_YET_RELEASED, type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
      id
      title { romaji english }
      coverImage { extraLarge }
      bannerImage
      averageScore
      seasonYear
      startDate { year month day }
      description
      genres
    }
  }
}`;

export async function getAnimeUpcoming(): Promise<{ id: number; title: string; poster: string | null; rating: number; year: number; type: "anime"; genres: string[]; daysUntil: number | null; overview: string; backdrop: string | null }[]> {
  try {
    const res = await anilistFetch(UPCOMING_QUERY, { page: 1, perPage: 4 }, { revalidate: 3600 });
    if (!res.ok) {
      // AniList down — fall back to Kitsu upcoming anime
      return fetchKitsuUpcomingAnime(4);
    }
    const json = await res.json();
    const media = json.data?.Page?.media || [];
    const results: { id: number; title: string; poster: string | null; rating: number; year: number; type: "anime"; genres: string[]; daysUntil: number | null; overview: string; backdrop: string | null }[] = [];
    for (const m of media) {
      const sd = m.startDate;
      let daysUntil: number | null = null;
      if (sd?.year && sd?.month && sd?.day) {
        const release = new Date(sd.year, sd.month - 1, sd.day);
        const diff = Math.ceil((release.getTime() - Date.now()) / 86400000);
        daysUntil = diff > 0 ? diff : null;
      }
      let backdrop = m.bannerImage || null;
      if (!backdrop) {
        const title = m.title?.romaji || m.title?.english || "";
        const year = m.seasonYear || 0;
        if (title && year) backdrop = await searchKitsuBackdrop(title, year);
      }
      results.push({
        id: m.id,
        title: m.title?.english || m.title?.romaji || "Unknown",
        poster: m.coverImage?.extraLarge || m.coverImage?.large || null,
        backdrop,
        rating: Math.round((m.averageScore / 10) * 10) / 10 || 0,
        year: m.seasonYear || 0,
        type: "anime" as const,
        genres: (m.genres || []).slice(0, 5),
        daysUntil,
        overview: (m.description || "").replace(/<[^>]*>/g, "").slice(0, 300),
      });
    }
    return results;
  } catch {
    return [];
  }
}

/** Kitsu fallback for upcoming anime (AniList down). */
async function fetchKitsuUpcomingAnime(limit = 4): Promise<{ id: number; title: string; poster: string | null; rating: number; year: number; type: "anime"; genres: string[]; daysUntil: number | null; overview: string; backdrop: string | null }[]> {
  try {
    const res = await fetch(`https://kitsu.io/api/edge/anime?filter%5Bstatus%5D=upcoming&sort=-startDate&page%5Blimit%5D=${limit}`, {
      headers: { "Accept": "application/vnd.api+json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const data = json.data || [];
    return await Promise.all(data.map(async (item: any): Promise<any | null> => {
      const a = item.attributes || {};
      const kitsuId = Number(item.id) || 0;
      if (!kitsuId) return null;
      // Resolve AniList id via mappings so /anime/{id} links work
      let anilistId = kitsuId;
      try {
        const mRes = await fetch(`${KITSU_ANIME_API}/${kitsuId}?include=mappings`, {
          headers: { "Accept": "application/vnd.api+json" },
          next: { revalidate: 86400 },
        });
        if (mRes.ok) {
          const mJson = await mRes.json();
          const mapping = (mJson.included || []).find((inc: any) => inc.type === "mappings" && inc.attributes?.externalSite === "anilist/anime");
          if (mapping?.attributes?.externalId) anilistId = Number(mapping.attributes.externalId);
        }
      } catch {}
      const posterImg = a.posterImage || {};
      const coverImg = a.coverImage || {};
      const startYear = a.startDate ? Number(String(a.startDate).slice(0, 4)) || 0 : 0;
      // daysUntil from startDate
      let daysUntil: number | null = null;
      if (a.startDate) {
        const d = new Date(a.startDate);
        if (!isNaN(d.getTime())) {
          const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
          daysUntil = diff > 0 ? diff : null;
        }
      }
      return {
        id: anilistId,
        title: a.canonicalTitle || a.titles?.en || "Unknown",
        poster: normalizeKitsuPoster(posterImg.large || posterImg.medium || posterImg.original, kitsuId),
        backdrop: coverImg.original || coverImg.large || null,
        rating: a.averageRating ? Math.round((a.averageRating / 10) * 10) / 10 : 0,
        year: startYear,
        type: "anime" as const,
        genres: [],
        daysUntil,
        overview: (a.synopsis || "").slice(0, 300),
      };
    })).then((rs) => rs.filter((r): r is NonNullable<typeof r> => r !== null));
  } catch {
    return [];
  }
}

// ─── One Piece saga navigation (AniList id=21) ───

export interface AnimeSaga {
  name: string;
  start: number;
  end: number;
}

export const ONE_PIECE_SAGAS: AnimeSaga[] = [
  { name: "East Blue", start: 1, end: 61 },
  { name: "Alabasta", start: 62, end: 135 },
  { name: "Sky Island", start: 136, end: 206 },
  { name: "Water 7", start: 207, end: 325 },
  { name: "Thriller Bark", start: 326, end: 384 },
  { name: "Summit War", start: 385, end: 516 },
  { name: "Fish-Man Island", start: 517, end: 574 },
  { name: "Dressrosa", start: 575, end: 746 },
  { name: "Whole Cake Island", start: 747, end: 889 },
  { name: "Wano Country", start: 890, end: 1085 },
  { name: "Final Saga", start: 1086, end: 9999 },
];

export function getAnimeSagas(anilistId: number): AnimeSaga[] | null {
  if (anilistId === 21) return ONE_PIECE_SAGAS;
  return null;
}

// ─── Trending anime ───

const TRENDING_QUERY = `
query TrendingAnime($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
      id
      title { romaji english }
      coverImage { extraLarge }
      bannerImage
      averageScore
      seasonYear
      description
      genres
    }
  }
}`;

const KITSU_BASE = "https://kitsu.io/api/edge";
const KITSU_UA = "Seriez/1.0";

async function searchKitsuBackdrop(title: string, year: number): Promise<string | null> {
  try {
    const query = encodeURIComponent(title);
    const url = `${KITSU_BASE}/anime?filter[text]=${query}&page[limit]=5`;
    const res = await fetch(url, {
      headers: { "Accept": "application/vnd.api+json", "User-Agent": KITSU_UA },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const match = (json.data || []).find((a: any) => {
      const y = parseInt(a.attributes?.startDate?.split("-")[0]);
      return y === year || Math.abs(y - year) <= 1;
    });
    return match?.attributes?.coverImage?.original || null;
  } catch {
    return null;
  }
}

export async function getAnimeTrending(): Promise<TmdbResult[]> {
  try {
    const res = await anilistFetch(TRENDING_QUERY, { page: 1, perPage: 14 }, { revalidate: 3600 });
    if (!res.ok) {
      // AniList down — fall back to Kitsu trending
      return fetchKitsuTrendingAnime(14);
    }
    const json = await res.json();
    const media = json.data?.Page?.media || [];
    const results: TmdbResult[] = [];
    for (const m of media) {
      let backdrop = m.bannerImage || null;
      if (!backdrop) {
        const title = m.title?.romaji || m.title?.english || "";
        const year = m.seasonYear || 0;
        if (title && year) backdrop = await searchKitsuBackdrop(title, year);
      }
      results.push({
        id: m.id,
        title: m.title?.english || m.title?.romaji || "Unknown",
        poster: m.coverImage?.extraLarge || m.coverImage?.large || null,
        backdrop,
        rating: Math.round((m.averageScore / 10) * 10) / 10 || 0,
        year: m.seasonYear || 0,
        type: "anime" as const,
        overview: m.description?.replace(/<[^>]*>/g, "").slice(0, 300) || "",
        genres: m.genres?.slice(0, 5) || [],
        daysUntil: null,
      });
    }
    return results;
  } catch {
    return [];
  }
}
