import { MetadataRoute } from "next";

const BASE_URL = "https://seriez.app";
const TMDB_BASE = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_API_KEY!;
const PAGES = 25;
const PRIORITY_CUTOFF = 100;

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  const [movieIds, tvIds] = await Promise.all([
    fetchTMDBIds("/movie/popular"),
    fetchTMDBIds("/tv/popular"),
  ]);

  console.log(`[sitemap] movies: ${movieIds.length}, tv: ${tvIds.length}`);

  const movieUrls: MetadataRoute.Sitemap = movieIds.map((id, i) => ({
    url: `${BASE_URL}/title/${id}?type=movie`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: i < PRIORITY_CUTOFF ? 0.9 : 0.7,
  }));

  const tvUrls: MetadataRoute.Sitemap = tvIds.map((id, i) => ({
    url: `${BASE_URL}/title/${id}?type=tv`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: i < PRIORITY_CUTOFF ? 0.9 : 0.7,
  }));

  return [...staticPages, ...movieUrls, ...tvUrls];
}
