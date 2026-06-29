import { MetadataRoute } from "next";

const BASE_URL = "https://seriez.app";
const LOCALES = ["en", "ko", "ja", "zh", "fr", "de", "es"] as const;
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

  const [movieIds, tvIds] = await Promise.all([
    fetchTMDBIds("/movie/popular"),
    fetchTMDBIds("/tv/popular"),
  ]);

  console.log(`[sitemap] movies: ${movieIds.length}, tv: ${tvIds.length}`);

  const movieEntries: MetadataRoute.Sitemap = movieIds.map((id, i) =>
    urlWithAlternates(
      `/title/${id}?type=movie`,
      i < PRIORITY_CUTOFF ? 0.9 : 0.7,
      "weekly"
    )
  );

  const tvEntries: MetadataRoute.Sitemap = tvIds.map((id, i) =>
    urlWithAlternates(
      `/title/${id}?type=tv`,
      i < PRIORITY_CUTOFF ? 0.9 : 0.7,
      "weekly"
    )
  );

  return [...staticEntries, ...movieEntries, ...tvEntries];
}
