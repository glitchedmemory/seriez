#!/usr/bin/env node
/**
 * Standalone box-office scraper.
 *
 * WHY THIS EXISTS
 * ---------------
 * This logic used to live in lib/box-office.ts and ran INSIDE the Next.js
 * server process. Every cache miss launched a fresh headless Chromium
 * (~650MB) to scrape Box Office Mojo -- for 11 countries, repeatedly. On a
 * 3.8GB / 2-vCPU box that repeatedly pushed the Node heap past its limit and
 * killed the server (47 OOM crashes, 477 PM2 restarts).
 *
 * Now the scraping runs here, out-of-process, on a schedule. The web server
 * only ever *reads* the JSON this script produces, so a traffic spike or a
 * Box Office Mojo slowdown can no longer take the site down.
 *
 * USAGE
 *   node scripts/scrape-boxoffice.mjs
 * Output: data/boxoffice.json
 */

import fs from "fs/promises";
import path from "path";

const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";
const OUT_FILE = path.join(process.cwd(), "data", "boxoffice.json");
const COUNTRIES = ["US", "GB", "AU", "MX", "KR", "JP", "FR", "DE", "ES", "CN", "BR"];
const PER_COUNTRY = 7;

if (!TMDB_KEY) {
  console.error("[scrape-boxoffice] TMDB_API_KEY missing - aborting");
  process.exit(1);
}

// ─── Dynamic week calculation (mirrors the in-app logic) ───

function getBOMWeek() {
  const now = new Date();
  // Current weekend's data isn't published until Saturday, so use last week.
  const lastWeek = new Date(now.getTime() - 7 * 86400000);
  const year = lastWeek.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = (jan1.getDay() + 6) % 7;
  const weekNum = Math.ceil(
    ((lastWeek.getTime() - jan1.getTime()) / 86400000 - dayOfWeek + 1) / 7
  );
  return `${year}W${weekNum}`;
}

// ─── TMDB matching ───

async function tmdbSearch(title) {
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
      const params = new URLSearchParams({ api_key: TMDB_KEY, query, language: "en-US" });
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

async function resolvePoster(title) {
  const match = await tmdbSearch(title);
  return match || { id: 0, title, poster: null, year: 0, rating: 0, type: "movie" };
}

// ─── Playwright scrapers (only chromium path needs it) ───

async function fetchBOMTable(url) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    return await page.evaluate(() => {
      const rows = [];
      document.querySelectorAll("table.mojo-body-table tr").forEach((row) => {
        const titleCell = row.querySelector(".mojo-field-type-release");
        const grossCell = row.querySelector(".mojo-field-type-money");
        if (titleCell && grossCell) {
          const title = (titleCell.textContent || "").trim();
          const gross = (grossCell.textContent || "").trim();
          if (title && gross && title !== "Release") rows.push({ title, gross });
        }
      });
      return rows.slice(0, 10);
    });
  } catch (e) {
    console.error("[scrape-boxoffice] fetchBOMTable error:", e?.message || String(e));
    return [];
  } finally {
    await browser.close();
  }
}

async function fetchBOMTableArea(url) {
  return fetchBOMTable(url);
}

// ─── Generic HTML-table scrapers (no browser) ───

async function scrapeHtmlList(url, titleRe, grossRe) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const titles = [];
    const grosses = [];
    let m;
    while ((m = titleRe.exec(html)) !== null) titles.push(m[1].trim());
    while ((m = grossRe.exec(html)) !== null) grosses.push(m[0].trim());
    const items = [];
    for (let i = 0; i < Math.min(titles.length, grosses.length, 10); i++) {
      items.push({ title: titles[i], gross: grosses[i] });
    }
    return items;
  } catch {
    return [];
  }
}

async function toResults(items) {
  const results = [];
  for (const item of items) {
    const match = await resolvePoster(item.title);
    results.push({
      ...match,
      backdrop: null,
      overview: "",
      genres: [],
      daysUntil: null,
      boxOffice: { gross: item.gross },
    });
  }
  return results;
}

// ─── Per-country scrapers ───

async function scrapeUS() {
  return toResults(await fetchBOMTable(`https://www.boxofficemojo.com/weekend/${getBOMWeek()}/`));
}

async function scrapeBOMArea(area) {
  return toResults(
    await fetchBOMTableArea(`https://www.boxofficemojo.com/weekend/${getBOMWeek()}/?area=${area}`)
  );
}

async function scrapeGB() {
  return toResults(
    await scrapeHtmlList(
      "https://filmdistributorsassociation.com/",
      /<h3[^>]*>([^<]+)<\/h3>/g,
      /£[\d,]+/g
    )
  );
}

async function scrapeKR() {
  return toResults(
    await scrapeHtmlList(
      "https://www.kobis.or.kr/kobis/business/stat/boxoffice/findWeekendBoxOfficeList.do",
      /<td[^>]*>\s*<span[^>]*>([^<]+)<\/span>/g,
      /[\d,]+원/g
    )
  );
}

async function scrapeFR() {
  return toResults(
    await scrapeHtmlList(
      "https://www.allocine.fr/boxoffice/france/",
      /class="meta-title-link"[^>]*>([^<]+)<\/a>/g,
      /[\d\s]+entrées/g
    )
  );
}

const SCRAPERS = {
  US: scrapeUS,
  GB: scrapeGB,
  KR: scrapeKR,
  FR: scrapeFR,
  AU: () => scrapeBOMArea("AU"),
  MX: () => scrapeBOMArea("MX"),
  ES: () => scrapeBOMArea("ES"),
  JP: () => scrapeBOMArea("JP"),
  DE: () => scrapeBOMArea("DE"),
  CN: () => scrapeBOMArea("CN"),
  BR: () => scrapeBOMArea("BR"),
};

// ─── Main ───

async function main() {
  const started = Date.now();
  console.log(`[scrape-boxoffice] week=${getBOMWeek()} countries=${COUNTRIES.length}`);

  const out = {
    generatedAt: new Date().toISOString(),
    week: getBOMWeek(),
    countries: {},
  };

  let usFallback = null;

  for (const country of COUNTRIES) {
    let results = [];
    try {
      const scraper = SCRAPERS[country];
      results = scraper ? await scraper() : [];
    } catch (e) {
      console.error(`[scrape-boxoffice] ${country} failed:`, e?.message || String(e));
    }

    if (country === "US") usFallback = results.slice(0, PER_COUNTRY);

    if (results.length === 0 && country !== "US") {
      // Mirror the in-app fallback so the UI never shows an empty section.
      if (usFallback) results = usFallback;
    }

    out.countries[country] = results.slice(0, PER_COUNTRY);
    console.log(`[scrape-boxoffice] ${country}: ${out.countries[country].length}`);
  }

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(out, null, 2));

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[scrape-boxoffice] wrote ${OUT_FILE} in ${secs}s`);
}

main().catch((e) => {
  console.error("[scrape-boxoffice] fatal:", e);
  process.exit(1);
});
