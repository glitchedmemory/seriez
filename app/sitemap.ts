import { MetadataRoute } from "next";
import fs from "fs";
import path from "path";
import { anilistFetch } from "@/lib/anilist";

const BASE_URL = "https://seriez.app";
const LOCALES = ["en", "ko", "ja", "zh", "fr", "de", "es", "pt"] as const;
const TMDB_BASE = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_API_KEY!;
const PAGES = 25;
const PRIORITY_CUTOFF = 100;

// Anime pages (/anime/[id]) use AniList IDs — see app/anime/[id]/page.tsx.
const ANILIST_PAGES = 20; // 20 x 50 = top 1,000 anime by popularity
const ANILIST_PER_PAGE = 50;
const ANILIST_MIN_IDS = 100; // fewer than this means the API failed: keep the previous list
const ANIME_ID_CACHE = path.join(process.cwd(), ".cache", "sitemap-anime-ids.json");

async function fetchTMDBIds(endpoint: string): Promise<number[]> {
  const ids = new Set<number>();
  for (let page = 1; page <= PAGES; page++) {
    try {
      const url = `${TMDB_BASE}${endpoint}?api_key=${API_KEY}&language=en-US&page=${page}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`[sitemap] TMDB ${endpoint} page ${page}: ${res.status}`);
        continue;
      }
      const data = await res.json();
      for (const item of data.results || []) {
        ids.add(item.id as number);
      }
    } catch (e) {
      console.error(`[sitemap] TMDB ${endpoint} page ${page} fetch error:`, e);
    }
  }
  return Array.from(ids);
}

function readCachedAnimeIds(): number[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(ANIME_ID_CACHE, "utf8"));
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function writeCachedAnimeIds(ids: number[]): void {
  try {
    fs.mkdirSync(path.dirname(ANIME_ID_CACHE), { recursive: true });
    fs.writeFileSync(ANIME_ID_CACHE, JSON.stringify(ids));
  } catch (e) {
    console.error("[sitemap] anime id cache write failed:", e);
  }
}

async function fetchAniListIds(): Promise<number[]> {
  const ids = new Set<number>();
  for (let page = 1; page <= ANILIST_PAGES; page++) {
    try {
      const res = await anilistFetch(
        `query { Page(page: ${page}, perPage: ${ANILIST_PER_PAGE}) { media(sort: POPULARITY_DESC, type: ANIME) { id } } }`,
        {},
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) {
        console.error(`[sitemap] AniList page ${page}: ${res.status}`);
        continue;
      }
      const data = await res.json();
      for (const m of data?.data?.Page?.media || []) {
        if (typeof m?.id === "number") ids.add(m.id as number);
      }
    } catch (e) {
      console.error(`[sitemap] AniList page ${page} fetch error:`, e);
    }
  }
  return Array.from(ids);
}

// Top anime IDs, with a persisted fallback so a transient AniList outage can
// never silently empty the anime section of the sitemap.
async function getAnimeIds(): Promise<number[]> {
  const fresh = await fetchAniListIds();
  if (fresh.length >= ANILIST_MIN_IDS) {
    writeCachedAnimeIds(fresh);
    return fresh;
  }
  const cached = readCachedAnimeIds();
  if (cached.length) {
    console.warn(`[sitemap] AniList returned only ${fresh.length} ids — falling back to ${cached.length} cached ids`);
    return cached;
  }
  console.error("[sitemap] AniList returned no usable ids and no cache is available");
  return [];
}

function urlWithAlternates(path: string, priority: number, changeFreq: MetadataRoute.Sitemap[number]["changeFrequency"]): any {
  const entry: any = {
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: changeFreq,
    priority,
  };
  // Add hreflang alternates
  entry.alternates = {
    languages: Object.fromEntries(
      LOCALES.map((l) => [
        l,
        l === "en" ? `${BASE_URL}${path}` : `${BASE_URL}/${l}${path}`,
      ])
    ),
  };
  return entry;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    { path: "", priority: 1.0, freq: "daily" as const },
    { path: "/about", priority: 0.8, freq: "monthly" as const },
    { path: "/terms", priority: 0.5, freq: "monthly" as const },
    { path: "/privacy", priority: 0.5, freq: "monthly" as const },
    { path: "/search", priority: 0.6, freq: "weekly" as const },
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((s) =>
    urlWithAlternates(s.path, s.priority, s.freq)
  );

  const [movieIds, tvIds, animeIds] = await Promise.all([
    fetchTMDBIds("/movie/popular"),
    fetchTMDBIds("/tv/popular"),
    getAnimeIds(),
  ]);

  console.log(`[sitemap] movies: ${movieIds.length}, tv: ${tvIds.length}, anime: ${animeIds.length}`);

  const movieEntries: MetadataRoute.Sitemap = movieIds.map((id, i) =>
    urlWithAlternates(
      `/movie/${id}`,
      i < PRIORITY_CUTOFF ? 0.9 : 0.7,
      "weekly"
    )
  );

  const tvEntries: MetadataRoute.Sitemap = tvIds.map((id, i) =>
    urlWithAlternates(
      `/tv/${id}/season/1`,
      i < PRIORITY_CUTOFF ? 0.9 : 0.7,
      "weekly"
    )
  );

  const animeEntries: MetadataRoute.Sitemap = animeIds.map((id, i) =>
    urlWithAlternates(
      `/anime/${id}`,
      i < PRIORITY_CUTOFF ? 0.9 : 0.7,
      "weekly"
    )
  );

  return [...staticEntries, ...movieEntries, ...tvEntries, ...animeEntries];
}
