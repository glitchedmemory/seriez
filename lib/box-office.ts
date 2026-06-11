// Multi-country box office scraper
// US: Box Office Mojo | UK: FDA | KR: KOFIC | JP: eiga.com | FR: AlloCiné
// DE: InsideKino | AU: Box Office Mojo | MX: CANACINE | ES: taquillaespana.es

import type { TmdbResult } from "@/lib/tmdb";

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

// ─── TMDB poster matching ───

async function tmdbSearch(title: string): Promise<MatchResult | null> {
  // Strategy 1: title + year extraction
  const yearMatch = title.match(/\((\d{4})\)/);
  const cleanTitle = title.replace(/\s*\(\d{4}\)\s*/, "").trim();
  const year = yearMatch ? parseInt(yearMatch[1]) : 0;

  const strategies = [
    { query: cleanTitle, year },
    { query: cleanTitle, year: 0 },
    // For subtitled movies: "Movie Name: Subtitle" → "Movie Name"
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
          poster: `https://image.tmdb.org/t/p/w342${match.poster_path}`,
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

// ─── Wikipedia poster fallback ───

async function wikipediaPoster(title: string): Promise<string | null> {
  try {
    // Try common Wikipedia URL patterns
    const slugs = [
      title.replace(/\s+/g, "_").replace(/[^\w_-]/g, ""),
      title.replace(/\s+/g, "_") + "_(film)",
      title.replace(/\s+/g, "_") + "_(2026_film)",
      title.replace(/\s+/g, "_") + "_(2025_film)",
    ];

    for (const slug of slugs) {
      const apiUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(slug)}&prop=text&format=json&origin=*`;
      const res = await fetch(apiUrl, {
        headers: { "User-Agent": "Seriez/1.0 (box-office-bot)" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = data?.parse?.text?.["*"] || "";
      // Extract first upload.wikimedia.org image (usually the poster/infobox image)
      const m = text.match(/src="(\/\/upload\.wikimedia\.org\/wikipedia\/[^"]+\.(?:jpg|png|jpeg))"/i);
      if (m) {
        // Get full resolution version
        const full = "https:" + m[1].replace(/\/thumb\//, "/").replace(/\/\d+px-[^/]+$/, "");
        return full;
      }
    }
  } catch {}
  return null;
}

// ─── Text-only fallback (deterministic ID + null poster) ───

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function textFallback(title: string): MatchResult {
  return {
    id: hashCode(title),
    title,
    poster: null,
    year: 0,
    rating: 0,
    type: "movie",
  };
}

// ─── Poster resolution pipeline ───

async function resolvePoster(title: string): Promise<MatchResult> {
  // 1. TMDB search
  const tmdb = await tmdbSearch(title);
  if (tmdb) return tmdb;

  // 2. Wikipedia fallback
  const wp = await wikipediaPoster(title);
  if (wp) {
    const fb = textFallback(title);
    fb.poster = wp;
    return fb;
  }

  // 3. Text-only fallback
  return textFallback(title);
}

// ─── US: Box Office Mojo ───

async function scrapeUS(): Promise<TmdbResult[]> {
  try {
    const res = await fetch("https://www.boxofficemojo.com/weekend/2026W23/", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Extract movie titles and weekend grosses
    const items: RawBoxOfficeItem[] = [];
    const titleRegex = /class="a-link-normal" href="\/release\/rl\d+\/[^"]*">([^<]+)<\/a>/g;
    const grossRegex = /mojo-field-type-money mojo-estimatable">([^<]+)<\/td>/g;

    const titles: string[] = [];
    const grosses: string[] = [];
    let m: RegExpExecArray | null;

    while ((m = titleRegex.exec(html)) !== null) {
      titles.push(m[1].trim());
    }
    while ((m = grossRegex.exec(html)) !== null) {
      grosses.push(m[1].trim());
    }

    // Pair titles with their weekend gross (first gross after each title)
    for (let i = 0; i < Math.min(titles.length, grosses.length, 10); i++) {
      items.push({ title: titles[i], gross: grosses[i] });
    }

    // Resolve posters
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

// ─── UK: FDA (Film Distributors' Association) ───

async function scrapeUK(): Promise<TmdbResult[]> {
  try {
    const res = await fetch("https://filmdistributorsassociation.com/", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Extract from the "UK and Ireland Top 5 Films" table
    const items: RawBoxOfficeItem[] = [];
    // Pattern: <td>N</td><td>Movie Title</td><td>Distributor</td>...<td class="right">£X,XXX,XXX</td>
    const rowRegex = /<tr><td>\d+<\/td><td>([^<]+)<\/td><td>[^<]*<\/td><td>[^<]*<\/td><td class="right">([^<]+)<\/td>/g;
    let m: RegExpExecArray | null;
    while ((m = rowRegex.exec(html)) !== null) {
      items.push({ title: m[1].trim(), gross: m[2].trim() });
    }

    const results: TmdbResult[] = [];
    for (const item of items.slice(0, 10)) {
      const match = await resolvePoster(item.title);
      results.push({
        ...match,
        backdrop: null,
        overview: "",
        genres: [],
        daysUntil: null,
        boxOffice: { gross: item.gross },
      } as TmdbResult);
    }
    return results;
  } catch {
    return [];
  }
}

// ─── AU/MX: Box Office Mojo (same scraper, different area) ───

async function scrapeBOMArea(area: string): Promise<TmdbResult[]> {
  try {
    const res = await fetch(`https://www.boxofficemojo.com/weekend/2026W23/?area=${area}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) return [];
    const html = await res.text();

    const items: RawBoxOfficeItem[] = [];
    const titleRegex = /class="a-link-normal" href="\/release\/rl\d+\/[^"]*">([^<]+)<\/a>/g;
    const grossRegex = /mojo-field-type-money mojo-estimatable">([^<]+)<\/td>/g;

    const titles: string[] = [];
    const grosses: string[] = [];
    let m: RegExpExecArray | null;

    while ((m = titleRegex.exec(html)) !== null) titles.push(m[1].trim());
    while ((m = grossRegex.exec(html)) !== null) grosses.push(m[1].trim());

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

async function scrapeAU(): Promise<TmdbResult[]> { return scrapeBOMArea("AU"); }
async function scrapeMX(): Promise<TmdbResult[]> { return scrapeBOMArea("MX"); }

// ─── KR: KOFIC API (needs free API key from kobis.or.kr) ───

const KOFIC_KEY = process.env.KOFIC_API_KEY || "";

async function scrapeKR(): Promise<TmdbResult[]> {
  if (!KOFIC_KEY) return []; // unconfigured
  try {
    // Get yesterday's date in YYYYMMDD format (KOFIC updates daily)
    const d = new Date(Date.now() - 86400000);
    const targetDt = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const res = await fetch(
      `http://kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchDailyBoxOfficeList.json?key=${KOFIC_KEY}&targetDt=${targetDt}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const list = data?.boxOfficeResult?.dailyBoxOfficeList || [];

    const results: TmdbResult[] = [];
    for (const item of list.slice(0, 10)) {
      const title = item.movieNm;
      const movieCd = item.movieCd;

      // Fetch English title from KOFIC movie detail for TMDB matching
      let engTitle = "";
      try {
        const detailRes = await fetch(
          `http://kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieInfo.json?key=${KOFIC_KEY}&movieCd=${movieCd}`
        );
        if (detailRes.ok) {
          const detail = await detailRes.json();
          engTitle = detail?.movieInfoResult?.movieInfo?.movieNmEn || "";
        }
      } catch {}

      // Try Korean title first, then English for poster matching
      const match = (engTitle && await resolvePoster(engTitle))
        || await resolvePoster(title)
        || (engTitle ? textFallback(engTitle) : textFallback(title));
      if (engTitle && match.title === title) match.title = engTitle; // prefer English

      results.push({
        ...match,
        backdrop: null,
        overview: "",
        genres: [],
        daysUntil: null,
        boxOffice: { gross: `${item.audiCnt?.toLocaleString() || "?"}명` },
      } as unknown as TmdbResult);
    }
    return results;
  } catch {
    return [];
  }
}

async function scrapeES(): Promise<TmdbResult[]> { return scrapeBOMArea("ES"); }
async function scrapeJP(): Promise<TmdbResult[]> { return scrapeBOMArea("JP"); }
async function scrapeDE(): Promise<TmdbResult[]> { return scrapeBOMArea("DE"); }
async function scrapeFR(): Promise<TmdbResult[]> {
  try {
    const res = await fetch("https://www.boxofficemojo.com/intl/france/", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) return [];
    const html = await res.text();

    // FR intl page: different structure — extract unique titles + first gross
    const items: RawBoxOfficeItem[] = [];
    const seen = new Set<string>();
    const titleRegex = /class="a-link-normal" href="\/release\/rl\d+\/[^"]*">([^<]+)<\/a>/g;
    const grossRegex = />(\$[\d,]+)</g;

    const titles: string[] = [];
    const grosses: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = titleRegex.exec(html)) !== null) titles.push(m[1].trim());
    while ((m = grossRegex.exec(html)) !== null) grosses.push(m[1]);

    for (let i = 0; i < Math.min(titles.length, grosses.length, 10); i++) {
      if (!seen.has(titles[i])) {
        seen.add(titles[i]);
        items.push({ title: titles[i], gross: grosses[i] });
      }
    }

    const results: TmdbResult[] = [];
    for (const item of items) {
      const match = await resolvePoster(item.title);
      results.push({
        ...match, backdrop: null, overview: "", genres: [], daysUntil: null,
        boxOffice: { gross: item.gross },
      } as unknown as TmdbResult);
    }
    return results;
  } catch { return []; }
}

// ─── Main export ───

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

export async function getBoxOffice(country: string): Promise<TmdbResult[]> {
  const scraper = SCRAPERS[country];
  if (!scraper) return scrapeUS();
  const results = await scraper();
  // Fallback to US if no results from country-specific scraper
  if (results.length === 0 && country !== "US") return scrapeUS();
  return results;
}
