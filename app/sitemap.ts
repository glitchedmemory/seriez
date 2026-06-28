import { MetadataRoute } from "next";

const BASE_URL = "https://seriez.app";
const TMDB_BASE = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_API_KEY!;
const PAGES = 25; // 25 pages × 20 = 500 titles each
const PRIORITY_CUTOFF = 100; // first 100 titles get priority 0.9, rest 0.7

async function fetchTMDBPage(endpoint: string, page: number) {
  const url = `${TMDB_BASE}${endpoint}?api_key=${API_KEY}&language=en-US&page=${page}`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map((item: any) => item.id) as number[];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  // Fetch popular movies & TV in parallel
  const moviePages = Array.from({ length: PAGES }, (_, i) => fetchTMDBPage("/movie/popular", i + 1));
  const tvPages = Array.from({ length: PAGES }, (_, i) => fetchTMDBPage("/tv/popular", i + 1));

  const [movieIds, tvIds] = await Promise.all([
    Promise.all(moviePages).then(arrs => [...new Set(arrs.flat())]),
    Promise.all(tvPages).then(arrs => [...new Set(arrs.flat())]),
  ]);

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
