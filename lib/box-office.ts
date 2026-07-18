// Multi-country box office scraper
// US: Box Office Mojo | UK: FDA | KR: KOFIC | JP: eiga.com | FR: AlloCiné
// DE: InsideKino | AU: Box Office Mojo | MX: CANACINE | ES: taquillaespana.es

import type { TmdbResult } from "@/lib/tmdb";
import { unstable_cache } from "next/cache";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";

// ─── Types ───

interface RawBoxOfficeItem {
  title: string;
  gross: string;
}

interface MatchResult {
  id: number;
  title: string;
  poster: string | null;
  year: number;
  rating: number;
  type: "movie";
}

// ─── Dynamic week calculation ───

function getBOMWeek(): string {
  const now = new Date();
  // Box office data for the current weekend is not available until Saturday
  // Use last week's data instead
  const lastWeek = new Date(now.getTime() - 7 * 86400000);
  const year = lastWeek.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = (jan1.getDay() + 6) % 7;
  const weekNum = Math.ceil((((lastWeek.getTime() - jan1.getTime()) / 86400000) - dayOfWeek + 1) / 7);
  return `${year}W${weekNum}`;
}

// ─── Country name mapping ───

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  KR: "South Korea",
  JP: "Japan",
  FR: "France",
  DE: "Germany",
  AU: "Australia",
  MX: "Mexico",
  ES: "Spain",
};

export function getCountryName(code: string): string {
  return COUNTRY_NAMES[code] || code;
}

// ─── Playwright helper for JS-rendered Box Office Mojo ───

async function fetchBOMTable(url: string): Promise<RawBoxOfficeItem[]> {
  console.log("[box-office] fetchBOMTable starting:", url);
  const { chromium } = await import("playwright");
  console.log("[box-office] playwright imported");
  const browser = await chromium.launch({ headless: true });
  console.log("[box-office] browser launched");
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    
    // Extract movie rows from the weekend table
    const items: RawBoxOfficeItem[] = await page.evaluate(() => {
      const rows: { title: string; gross: string }[] = [];
      const tableRows = document.querySelectorAll("table.mojo-body-table tr");
      tableRows.forEach((row) => {
        const titleCell = row.querySelector(".mojo-field-type-release");
        const grossCell = row.querySelector(".mojo-field-type-money");
        if (titleCell && grossCell) {
          const title = (titleCell.textContent || "").trim();
          const gross = (grossCell.textContent || "").trim();
          if (title && gross && title !== "Release") {
            rows.push({ title, gross });
          }
        }
      });
      return rows.slice(0, 10);
    });

    console.log("[box-office] items extracted:", items.length);
    return items;
  } catch(e) {
    console.error("[box-office] fetchBOMTable error:", e instanceof Error ? e.message : String(e));
    return [];
  } finally {
    await browser.close();
  }
}

async function fetchBOMTableArea(url: string): Promise<RawBoxOfficeItem[]> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    // Extract movie rows from the weekend table
    const items: RawBoxOfficeItem[] = await page.evaluate(() => {
      const rows: { title: string; gross: string }[] = [];
      const tableRows = document.querySelectorAll("table.mojo-body-table tr");
      tableRows.forEach((row) => {
        const titleCell = row.querySelector(".mojo-field-type-release");
        const grossCell = row.querySelector(".mojo-field-type-money");
        if (titleCell && grossCell) {
          const title = (titleCell.textContent || "").trim();
          const gross = (grossCell.textContent || "").trim();
          if (title && gross && title !== "Release") {
            rows.push({ title, gross });
          }
        }
      });
      return rows.slice(0, 10);
    });

    console.log("[box-office] items extracted:", items.length);
    return items;
  } catch(e) {
    console.error("[box-office] fetchBOMTable error:", e instanceof Error ? e.message : String(e));
    return [];
  } finally {
    await browser.close();
  }
}

// ─── TMDB poster matching ───

async function tmdbSearch(title: string): Promise<MatchResult | null> {
  const yearMatch = title.match(/\((\d{4})\)/);
  const cleanTitle = title.replace(/\s*\(\d{4}\)\s*/, "").trim();
  const year = yearMatch ? parseInt(yearMatch[1]) : 0;

  const strategies = [
    { query: cleanTitle, year },
    { query: cleanTitle, year: 0 },
    { query: cleanTitle.split(":")[0].trim(), year },
  ];

  for (const { query, year: y } of strategies) {
    try {
      const params = new URLSearchParams({
        api_key: TMDB_KEY,
        query,
        language: "en-US",
      });
      if (y > 0) params.set("primary_release_year", String(y));

      const res = await fetch(`${TMDB_BASE}/search/movie?${params}`);
      if (!res.ok) continue;
      const data = await res.json();
      const match = data.results?.[0];
      if (match && match.poster_path) {
        return {
          id: match.id,
          title: match.title,
          poster: `https://image.tmdb.org/t/p/w780${match.poster_path}`,
          year: parseInt((match.release_date || "").slice(0, 4)) || 0,
          rating: Math.round(match.vote_average * 10) / 10,
          type: "movie",
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function resolvePoster(title: string): Promise<MatchResult> {
  const match = await tmdbSearch(title);
  if (match) return match;
  return {
    id: 0,
    title,
    poster: null,
    year: 0,
    rating: 0,
    type: "movie",
  };
}

// ─── US: Box Office Mojo (Playwright) ───

async function scrapeUS(): Promise<TmdbResult[]> {
  try {
    const url = `https://www.boxofficemojo.com/weekend/${getBOMWeek()}/`;
    const items = await fetchBOMTable(url);
    if (items.length === 0) return [];

    const results: TmdbResult[] = [];
    for (const item of items) {
      const match = await resolvePoster(item.title);
      results.push({
        ...match,
        backdrop: null,
        overview: "",
        genres: [],
        daysUntil: null,
        boxOffice: { gross: item.gross },
      } as unknown as TmdbResult);
    }
    return results;
  } catch {
    return [];
  }
}

// ─── UK: FDA ───

async function scrapeUK(): Promise<TmdbResult[]> {
  try {
    const res = await fetch("https://filmdistributorsassociation.com/", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) return [];
    const html = await res.text();

    const items: RawBoxOfficeItem[] = [];
    const titleRegex = /<h3[^>]*>([^<]+)<\/h3>/g;
    const grossRegex = /£[\d,]+/g;

    const titles: string[] = [];
    const grosses: string[] = [];
    let m: RegExpExecArray | null;

    while ((m = titleRegex.exec(html)) !== null) {
      titles.push(m[1].trim());
    }
    while ((m = grossRegex.exec(html)) !== null) {
      grosses.push(m[0].trim());
    }

    for (let i = 0; i < Math.min(titles.length, grosses.length, 10); i++) {
      items.push({ title: titles[i], gross: grosses[i] });
    }

    const results: TmdbResult[] = [];
    for (const item of items) {
      const match = await resolvePoster(item.title);
      results.push({
        ...match,
        backdrop: null,
        overview: "",
        genres: [],
        daysUntil: null,
        boxOffice: { gross: item.gross },
      } as unknown as TmdbResult);
    }
    return results;
  } catch {
    return [];
  }
}

// ─── AU/MX/ES/JP/DE: Box Office Mojo (Playwright, area-specific) ───

async function scrapeBOMArea(area: string): Promise<TmdbResult[]> {
  try {
    const url = `https://www.boxofficemojo.com/weekend/${getBOMWeek()}/?area=${area}`;
    const items = await fetchBOMTableArea(url);
    if (items.length === 0) return [];

    const results: TmdbResult[] = [];
    for (const item of items) {
      const match = await resolvePoster(item.title);
      results.push({
        ...match,
        backdrop: null,
        overview: "",
        genres: [],
        daysUntil: null,
        boxOffice: { gross: item.gross },
      } as unknown as TmdbResult);
    }
    return results;
  } catch {
    return [];
  }
}

async function scrapeAU(): Promise<TmdbResult[]> { return scrapeBOMArea("AU"); }
async function scrapeMX(): Promise<TmdbResult[]> { return scrapeBOMArea("MX"); }
async function scrapeES(): Promise<TmdbResult[]> { return scrapeBOMArea("ES"); }
async function scrapeJP(): Promise<TmdbResult[]> { return scrapeBOMArea("JP"); }
async function scrapeDE(): Promise<TmdbResult[]> { return scrapeBOMArea("DE"); }

// ─── KR: KOFIC ───

async function scrapeKR(): Promise<TmdbResult[]> {
  try {
    const res = await fetch("https://www.kobis.or.kr/kobis/business/stat/boxoffice/findWeekendBoxOfficeList.do", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) return [];
    const html = await res.text();

    const items: RawBoxOfficeItem[] = [];
    const titleRegex = /<td[^>]*>\s*<span[^>]*>([^<]+)<\/span>/g;
    const grossRegex = /[\d,]+원/g;

    const titles: string[] = [];
    const grosses: string[] = [];
    let m: RegExpExecArray | null;

    while ((m = titleRegex.exec(html)) !== null) {
      titles.push(m[1].trim());
    }
    while ((m = grossRegex.exec(html)) !== null) {
      grosses.push(m[0].trim());
    }

    for (let i = 0; i < Math.min(titles.length, grosses.length, 10); i++) {
      items.push({ title: titles[i], gross: grosses[i] });
    }

    const results: TmdbResult[] = [];
    for (const item of items) {
      const match = await resolvePoster(item.title);
      results.push({
        ...match,
        backdrop: null,
        overview: "",
        genres: [],
        daysUntil: null,
        boxOffice: { gross: item.gross },
      } as unknown as TmdbResult);
    }
    return results;
  } catch {
    return [];
  }
}

// ─── FR: AlloCiné ───

async function scrapeFR(): Promise<TmdbResult[]> {
  try {
    const res = await fetch("https://www.allocine.fr/boxoffice/france/", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) return [];
    const html = await res.text();

    const items: RawBoxOfficeItem[] = [];
    const titleRegex = /class="meta-title-link"[^>]*>([^<]+)<\/a>/g;
    const grossRegex = /[\d\s]+entrées/g;

    const titles: string[] = [];
    const grosses: string[] = [];
    let m: RegExpExecArray | null;

    while ((m = titleRegex.exec(html)) !== null) {
      titles.push(m[1].trim());
    }
    while ((m = grossRegex.exec(html)) !== null) {
      grosses.push(m[0].trim());
    }

    for (let i = 0; i < Math.min(titles.length, grosses.length, 10); i++) {
      items.push({ title: titles[i], gross: grosses[i] });
    }

    const results: TmdbResult[] = [];
    for (const item of items) {
      const match = await resolvePoster(item.title);
      results.push({
        ...match,
        backdrop: null,
        overview: "",
        genres: [],
        daysUntil: null,
        boxOffice: { gross: item.gross },
      } as unknown as TmdbResult);
    }
    return results;
  } catch {
    return [];
  }
}

// ─── Scraper registry ───

const SCRAPERS: Record<string, () => Promise<TmdbResult[]>> = {
  US: scrapeUS,
  GB: scrapeUK,
  AU: scrapeAU,
  MX: scrapeMX,
  KR: scrapeKR,
  JP: scrapeJP,
  FR: scrapeFR,
  DE: scrapeDE,
  ES: scrapeES,
};

export const getBoxOffice = unstable_cache(
  async (country: string): Promise<TmdbResult[]> => {
  const scraper = SCRAPERS[country];
  if (!scraper) {
    const result = (await scrapeUS()).slice(0, 7);
    console.log("[box-office] fallback to US for", country, "- count:", result.length);
    return result;
  }
  const results = await scraper();
  console.log("[box-office] country:", country, "- count:", results.length);
  if (results.length === 0 && country !== "US") {
    const fallback = (await scrapeUS()).slice(0, 7);
    console.log("[box-office] fallback to US for", country, "- count:", fallback.length);
    return fallback;
  }
  return results.slice(0, 7);
},
  ["box-office-v5"],
  { revalidate: 3600 }
);
