const ANILIST_API = "https://graphql.anilist.co";

import { validateAndReplaceTrailers } from "./yt-validator";

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

// ─── Types ───

export type AnimeDetail = {
  id: number;
  idMal: number;
  title: string;
  titleRomaji: string;
  titleNative: string;
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
  staff: { name: string; role: string }[];
  characters: { name: string; role: string; voiceActor: string; image: string | null }[];
  recommendations: AnimeRecItem[];
  trailer: { id: string; site: string } | null;
  relations: { id: number; title: string; type: string; format: string; seasonYear: number | null }[];
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
        name { full }
        primaryOccupations
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

// ─── TMDB backdrop fallback for anime missing bannerImage ───

const TMDB_SEARCH = "https://api.themoviedb.org/3/search/movie";
const TMDB_IMAGE = "https://image.tmdb.org/t/p/w1280";

async function fetchTMDBBackdrop(title: string, year: number, titleRomaji?: string): Promise<string | null> {
  if (!process.env.TMDB_API_KEY) return null;
  try {
    // Build search candidates: subtitle first → exact → main → romaji
    const parts = title.split(":");
    const main = parts[0].trim();
    const subtitle = parts.slice(1).join(":").trim();
    const candidates = [
      { query: title, year },
      { query: title },
    ];
    // Subtitle-only often matches better than main title on TMDB
    if (subtitle) {
      candidates.push({ query: subtitle, year });
      candidates.push({ query: subtitle });
    }
    // Main title as last resort
    candidates.push({ query: main, year });
    candidates.push({ query: main });
    if (titleRomaji) {
      const romajiParts = titleRomaji.split(":");
      const mainRomaji = romajiParts[0].trim();
      const subRomaji = romajiParts.slice(1).join(":").trim();
      if (subRomaji && subRomaji !== subtitle) {
        candidates.push({ query: subRomaji, year });
      }
      candidates.push({ query: mainRomaji, year });
    }
    for (const c of candidates) {
      const params = new URLSearchParams({
        api_key: process.env.TMDB_API_KEY!,
        query: c.query,
      });
      if (c.year) params.set("year", String(c.year));
      const url = `${TMDB_SEARCH}?${params}`;
      const res = await fetch(url, { next: { revalidate: 86400 } });
      if (!res.ok) continue;
      const data = await res.json();
      const match = data.results?.[0];
      if (match?.backdrop_path) {
        return `${TMDB_IMAGE}${match.backdrop_path}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function getAnimeDetail(id: number): Promise<AnimeDetail | null> {
  try {
    // Retry AniList fetch with backoff (handles 429 + network errors)
    let res: Response | undefined;
    for (let attempt = 1; attempt <= 3; attempt++) {
      res = await fetch(ANILIST_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ query: DETAIL_QUERY, variables: { id } }),
        next: { revalidate: 3600 },
      });
      if (res.ok) break; // success
      if (res.status === 429 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      } else if (!res.ok && attempt < 3) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    if (!res!.ok) return null;
    const json = await res!.json();
    const m = json.data?.Media;
    if (!m) return null;

    // Characters with voice actors
    const characters = (m.characters?.edges || []).map((e: any) => ({
      name: e.node?.name?.full || "Unknown",
      role: e.role || "",
      voiceActor: e.voiceActors?.[0]?.name?.full || "",
      image: e.node?.image?.medium || null,
    }));

    // Staff (directors, writers, etc.)
    const staff = (m.staff?.nodes || []).map((s: any) => ({
      name: s.name?.full || "Unknown",
      role: (s.primaryOccupations || [])[0] || "Staff",
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
      idMal: m.idMal || 0,
      title: m.title?.english || m.title?.romaji || "Unknown",
      titleRomaji: m.title?.romaji || "",
      titleNative: m.title?.native || "",
      overview: (m.description || "").replace(/<br\s*\/?>/gi, " ").replace(/ {2,}/g, " ").trim(),
      poster: m.coverImage?.extraLarge || m.coverImage?.large || "",
      backdrop: m.bannerImage || "",
      rating: Math.round(((m.averageScore || 0) / 10) * 10) / 10,
      popularity: m.popularity || 0,
      year: m.seasonYear || 0,
      season: formatSeason(m.season),
      format: m.format || "TV",
      status: formatStatus(m.status),
      episodes: m.episodes || 0,
      duration: m.duration || 0,
      genres: m.genres || [],
      tags,
      studios,
      staff,
      characters,
      recommendations,
      trailer: null as { id: string; site: string } | null,
      relations,
    };

    // TMDB backdrop fallback when AniList bannerImage is null
    if (!result.backdrop && result.year) {
      result.backdrop = (await fetchTMDBBackdrop(result.title, result.year, result.titleRomaji)) || "";
    }

    // Validate trailer (if AnyList has one) or search YouTube (if not)
    const animeTitle = m.title?.english || m.title?.romaji || "";
    const validated = await validateAndReplaceTrailers(
      trailer ? [{ key: trailer.id, name: "Trailer" }] : [],
      `${animeTitle} official trailer`,
      1,
      undefined,
      m.id
    );
    if (validated.length > 0) {
      result.trailer = { id: validated[0].key, site: "YouTube" };
    }

    return result;
  } catch {
    return null;
  }
}

// ─── Episode fetching (Jikan primary + Kitsu/AniDB fallback) ───

const JIKAN_API = "https://api.jikan.moe/v4";

async function fetchJikanEpisodes(malId: number): Promise<AnimeEpisode[]> {
  if (!malId || malId <= 0) return [];
  try {
    const allEpisodes: AnimeEpisode[] = [];
    let page = 1;

    while (true) {
      const res = await fetch(`${JIKAN_API}/anime/${malId}/episodes?page=${page}`, {
        headers: { "Accept": "application/json" },
        next: { revalidate: 86400 },
      });
      if (!res.ok) break;
      const data = await res.json();
      const eps = data.data || [];
      if (eps.length === 0) break;

      for (const ep of eps) {
        allEpisodes.push({
          number: ep.mal_id || 0,
          title: ep.title || `Episode ${ep.mal_id}`,
          titleJapanese: ep.title_japanese || "",
          airDate: ep.aired ? ep.aired.slice(0, 10) : "",
          thumbnail: null, // Jikan doesn't provide thumbnails
          synopsis: ep.synopsis || "",
          duration: ep.duration || 0,
        });
      }

      if (!data.pagination?.has_next_page) break;
      page++;
    }

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

// ─── TMDB Episode Thumbnails ───

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w780";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY!;

async function fetchTMDBThumbnails(title: string): Promise<Map<number, string>> {
  const thumbs = new Map<number, string>();
  try {
    // Step 1: Search TMDB for the anime as a TV show
    const searchUrl = `${TMDB_API}/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}`;
    const searchRes = await fetch(searchUrl, { next: { revalidate: 86400 } });
    if (!searchRes.ok) return thumbs;
    const searchData = await searchRes.json();
    const tvResults = searchData.results || [];
    if (tvResults.length === 0) return thumbs;
    const tvId = tvResults[0].id;

    // Step 2: Fetch all seasons' episodes
    const tvRes = await fetch(
      `${TMDB_API}/tv/${tvId}?api_key=${TMDB_KEY}`,
      { next: { revalidate: 86400 } }
    );
    if (!tvRes.ok) return thumbs;
    const tvData = await tvRes.json();
    const seasons = (tvData.seasons || []).filter((s: any) => s.season_number > 0);

    // Step 3: Fetch all seasons' episodes in parallel (TMDB has per-season still images)
    const seasonNumbers = seasons.map((s: any) => s.season_number);
    const seasonResults = await Promise.all(
      seasonNumbers.map(async (sn: number) => {
        try {
          const epRes = await fetch(
            `${TMDB_API}/tv/${tvId}/season/${sn}?api_key=${TMDB_KEY}`,
            { next: { revalidate: 86400 } }
          );
          if (!epRes.ok) return [];
          const epData = await epRes.json();
          return (epData.episodes || []).filter((ep: any) => ep.still_path);
        } catch {
          return [];
        }
      })
    );
    for (const epList of seasonResults) {
      for (const ep of epList) {
        if (ep.episode_number) {
          thumbs.set(ep.episode_number, `${TMDB_IMAGE_BASE}${ep.still_path}`);
        }
      }
    }
  } catch {
    // Fail silently — thumbnails are optional
  }
  return thumbs;
}

// ─── TVmaze Episode Thumbnails (free, no API key) ───

async function fetchTVmazeThumbnails(title: string): Promise<Map<number, string>> {
  const thumbs = new Map<number, string>();
  try {
    // Step 1: Search TVmaze
    const searchUrl = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`;
    const searchRes = await fetch(searchUrl, { next: { revalidate: 86400 } });
    if (!searchRes.ok) return thumbs;
    const searchData = await searchRes.json();
    if (!searchData.length) return thumbs;
    const showId = searchData[0].show.id;

    // Step 2: Fetch all episodes
    const epRes = await fetch(`https://api.tvmaze.com/shows/${showId}/episodes`, {
      next: { revalidate: 86400 },
    });
    if (!epRes.ok) return thumbs;
    const episodes = await epRes.json();

    // Map by sequential episode number across all seasons
    for (let i = 0; i < episodes.length; i++) {
      const ep = episodes[i];
      if (ep.image?.medium) {
        // Use sequential number (1-based) — matches Jikan/Kitsu flat numbering
        thumbs.set(i + 1, ep.image.medium);
      }
    }
  } catch {
    // Fail silently
  }
  return thumbs;
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
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query, variables: { search: title } }),
      next: { revalidate: 86400 },
    });
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

export async function getAnimeEpisodes(
  title: string,
  titleRomaji: string,
  idMal?: number,
  titleNative?: string
): Promise<AnimeEpisode[]> {
  let episodes: AnimeEpisode[] = [];

  // Track A: Jikan (MyAnimeList) — fastest, no page limit, reliable for all episode counts
  if (idMal && idMal > 0) {
    const jikanEps = await fetchJikanEpisodes(idMal);
    if (jikanEps.length > 0) episodes = jikanEps;
  }

  // Track B: Kitsu (has episode thumbnails + titles + air dates)
  // Only used if Jikan fails — kept with page limit for safety
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

  // Track C: AniDB fallback (slower, no thumbnails)
  if (episodes.length === 0) {
    const anidbEps = await fetchAniDBEpisodes(titleRomaji || title);
    if (anidbEps.length > 0) episodes = anidbEps;
  }

  // Merge TMDB + TVmaze thumbnails into episodes (runs regardless of source)
  if (episodes.length > 0) {
    // Try native Japanese first (correct TMDB anime entry), then romaji, then english
    const searchTitles = [titleNative, titleRomaji, title].filter(Boolean) as string[];
    let tmdbThumbs = new Map<number, string>();
    for (const t of searchTitles) {
      tmdbThumbs = await fetchTMDBThumbnails(t);
      if (tmdbThumbs.size > 0) break;
    }
    // TVmaze as fallback
    if (tmdbThumbs.size === 0) {
      for (const t of searchTitles) {
        tmdbThumbs = await fetchTVmazeThumbnails(t);
        if (tmdbThumbs.size > 0) break;
      }
    }
    if (tmdbThumbs.size > 0) {
      episodes = episodes.map(ep => {
        const thumb = tmdbThumbs.get(ep.number);
        return thumb ? { ...ep, thumbnail: thumb } : ep;
      });
    }

    // Kitsu thumbnail merge — main Japanese source, parallel 10x batches
    {
      const missingThumbs = episodes.filter(ep => !ep.thumbnail).length;
      if (missingThumbs > 0) {
        const searchTitle = titleRomaji || title;
        const kitsuThumbs = await fetchKitsuThumbnails(searchTitle, 100);
        if (kitsuThumbs.size > 0) {
          episodes = episodes.map(ep => {
            if (ep.thumbnail) return ep;
            const thumb = kitsuThumbs.get(ep.number);
            return thumb ? { ...ep, thumbnail: thumb } : ep;
          });
        }
      }
    }

    // AniList streamingEpisodes (Crunchyroll) merge
    {
      const alThumbs = await fetchAniListStreamingThumbnails(titleRomaji || title);
      if (alThumbs.size > 0) {
        episodes = episodes.map(ep => {
          if (ep.thumbnail) return ep;
          const thumb = alThumbs.get(ep.number);
          return thumb ? { ...ep, thumbnail: thumb } : ep;
        });
      }
    }

    // Crunchyroll RSS merge — last resort (may fail on datacenter IPs)
    {
      const crThumbs = await fetchCrunchyrollThumbnails(titleRomaji || title);
      if (crThumbs.size > 0) {
        episodes = episodes.map(ep => {
          if (ep.thumbnail) return ep;
          const thumb = crThumbs.get(ep.number);
          return thumb ? { ...ep, thumbnail: thumb } : ep;
        });
      }
    }
  }

  return episodes;
}

// ─── Deep relations enrichment (2 levels) ───

const RELATIONS_ONLY_QUERY = `
query($id: Int) {
  Media(id: $id) {
    id
    title { romaji english }
    relations {
      edges {
        relationType
        node {
          id
          title { romaji english }
          type
          format
          seasonYear
        }
      }
    }
  }
}`;

/**
 * Collect ALL unique TV anime relations via BFS across the relation graph.
 * Iterates until no new TV entries are discovered (full franchise coverage).
 */
export async function enrichAnimeRelations(
  currentId: number,
  existingRelations: { id: number; title: string; type: string; format: string; seasonYear: number | null }[]
): Promise<{ id: number; title: string; type: string; format: string; seasonYear: number | null }[]> {
  const seen = new Set<number>([currentId]);
  const result: { id: number; title: string; type: string; format: string; seasonYear: number | null }[] = [];

  // Start with existing TV relations
  const queue = existingRelations.filter(r => r.format === "TV");
  for (const r of queue) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      result.push(r);
    }
  }

  // BFS: keep fetching relations until no new TV entries
  while (queue.length > 0) {
    const batch = queue.splice(0, 5); // fetch up to 5 at a time
    const promises = batch.map(async (rel) => {
      try {
        const res = await fetch(ANILIST_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: RELATIONS_ONLY_QUERY, variables: { id: rel.id } }),
          next: { revalidate: 86400 },
        });
        if (!res.ok) return [];
        const json = await res.json();
        const edges = json.data?.Media?.relations?.edges || [];
        return edges
          .filter((e: any) => e.node?.type === "ANIME" && e.node?.format === "TV" && (e.relationType === "SEQUEL" || e.relationType === "PREQUEL"))
          .map((e: any) => ({
            id: e.node.id,
            title: e.node.title?.english || e.node.title?.romaji || "Unknown",
            type: "ANIME" as const,
            format: e.node.format || "",
            seasonYear: e.node.seasonYear || null,
          }));
      } catch {
        return [];
      }
    });

    const results = await Promise.all(promises);
    for (const items of results) {
      for (const item of items) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          result.push(item);
          queue.push(item);
        }
      }
    }
  }

  return result;
}
