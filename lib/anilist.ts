const ANILIST_API = "https://graphql.anilist.co";

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
  relations: { id: number; title: string; type: string; format: string }[];
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
          coverImage { large }
          averageScore
          seasonYear
          genres
        }
      }
    }
    trailer { id site thumbnail }
    relations {
      nodes {
        id
        title { romaji english }
        type
        format
      }
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

// ─── Main fetch ───

export async function getAnimeDetail(id: number): Promise<AnimeDetail | null> {
  try {
    const res = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query: DETAIL_QUERY, variables: { id } }),
      next: { revalidate: 3600 },
    });

    if (!res.ok) return null;
    const json = await res.json();
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
          poster: r.coverImage?.large || null,
          rating: Math.round((r.averageScore / 10) * 10) / 10 || 0,
          year: r.seasonYear || 0,
          genres: (r.genres || []).slice(0, 4),
        };
      })
      .filter(Boolean);

    // Relations (sequels, prequels, side stories)
    const relations = (m.relations?.nodes || [])
      .filter((r: any) => r.type === "ANIME")
      .map((r: any) => ({
        id: r.id,
        title: r.title?.english || r.title?.romaji || "Unknown",
        type: r.type || "ANIME",
        format: r.format || "",
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

    return {
      id: m.id,
      idMal: m.idMal || 0,
      title: m.title?.english || m.title?.romaji || "Unknown",
      titleRomaji: m.title?.romaji || "",
      titleNative: m.title?.native || "",
      overview: (m.description || "").replace(/<br\s*\/?>/gi, " ").replace(/ {2,}/g, " ").trim(),
      poster: m.coverImage?.extraLarge || null,
      backdrop: m.bannerImage || null,
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
      trailer,
      relations,
    };
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

async function fetchKitsuEpisodes(title: string): Promise<AnimeEpisode[]> {
  try {
    // Step 1: Search Kitsu by title
    const searchUrl = `${KITSU_API}/anime?filter[text]=${encodeURIComponent(title)}&page[limit]=3`;
    const searchRes = await fetch(searchUrl, {
      headers: { "Accept": "application/vnd.api+json" },
      next: { revalidate: 86400 },
    });
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const results = searchData.data || [];
    if (results.length === 0) return [];

    // Pick the best match (first result is usually correct)
    const animeId = results[0].id;

    // Step 2: Fetch all episodes (Kitsu limit is 20 per page)
    const allEpisodes: any[] = [];
    let offset = 0;
    const pageLimit = 20;
    while (true) {
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
      if (page.length < pageLimit) break; // last page
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

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w300";
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

    // Step 3: Fetch episodes for each season (only first 3 seasons to limit requests)
    for (const season of seasons.slice(0, 3)) {
      const epRes = await fetch(
        `${TMDB_API}/tv/${tvId}/season/${season.season_number}?api_key=${TMDB_KEY}`,
        { next: { revalidate: 86400 } }
      );
      if (!epRes.ok) continue;
      const epData = await epRes.json();
      for (const ep of epData.episodes || []) {
        if (ep.still_path && ep.episode_number) {
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

export async function getAnimeEpisodes(
  title: string,
  titleRomaji: string,
  idMal?: number,
  titleNative?: string
): Promise<AnimeEpisode[]> {
  let episodes: AnimeEpisode[] = [];

  // Track A: Kitsu (has episode thumbnails + titles + air dates)
  const searchTitle = titleRomaji || title;
  let kitsuEps = await fetchKitsuEpisodes(searchTitle);
  if (kitsuEps.length === 0 && title !== searchTitle) {
    kitsuEps = await fetchKitsuEpisodes(title);
  }
  if (kitsuEps.length > 0) {
    episodes = kitsuEps;
  }

  // Track B: Jikan (MyAnimeList) — reliable but no thumbnails
  if (episodes.length === 0 && idMal && idMal > 0) {
    const jikanEps = await fetchJikanEpisodes(idMal);
    if (jikanEps.length > 0) episodes = jikanEps;
  }

  // Track C: AniDB fallback (slower, no thumbnails)
  if (episodes.length === 0) {
    const anidbEps = await fetchAniDBEpisodes(titleRomaji || title);
    if (anidbEps.length > 0) episodes = anidbEps;
  }

  // Merge TMDB + TVmaze thumbnails into episodes (runs regardless of source)
  if (episodes.length > 0) {
    // Try romaji, english, and native japanese titles for best coverage
    const searchTitles = [titleRomaji, title, titleNative].filter(Boolean) as string[];
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
  }

  return episodes;
}
