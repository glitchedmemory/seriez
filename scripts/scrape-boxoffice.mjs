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
 * COUNTRY TIMING
 * --------------
 * Box office is a WEEKLY metric and each country publishes on its own delay.
 * Measured on 2026-11-23: for the current week the US already had 105 rows
 * while GB/AU/MX/KR/JP/FR/DE/ES/CN/BR all had 0. FR was still empty for the
 * PREVIOUS week. A single run therefore cannot fill every country.
 *
 * A country that returns nothing keeps its previous data instead of being
 * overwritten with the US list. Showing the US chart under a "France" header
 * was wrong; a one-week-old French chart is not.
 *
 * USAGE
 *   node scripts/scrape-boxoffice.mjs
 *   node scripts/scrape-boxoffice.mjs --week 2026W46   (force a specific week)
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

function getBOMWeek(offsetDays = 7) {
  const now = new Date();
  // Current weekend's data isn't published until Saturday, so use last week.
  const lastWeek = new Date(now.getTime() - offsetDays * 86400000);
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
  ];

  for (const { query, year: y } of strategies) {
    const params = new URLSearchParams({ api_key: TMDB_KEY, query, language: "en-US" });
    if (y > 0) params.set("primary_release_year", String(y));
    try {
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
  return {
    id: 0,
    title,
    poster: null,
    year: 0,
    rating: 0,
    type: "movie",
  };
}

// ─── Box Office Mojo (shared for every area) ───

async function fetchBOM(area, week) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const url = `https://www.boxofficemojo.com/weekend/${week}/` + (area ? `?area=${area}` : "");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    const rows = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("table.mojo-body-table tr").forEach((row) => {
        const t = row.querySelector(".mojo-field-type-release");
        const g = row.querySelector(".mojo-field-type-money");
        if (!t || !g) return;
        const title = (t.textContent || "").trim();
        const gross = (g.textContent || "").trim();
        // Skip the header rows, which also carry these class names.
        if (!title || !gross || title === "Release" || /^\$?[\d,]+$/.test(title)) return;
        out.push({ title, gross });
      });
      return out.slice(0, 10);
    });
    return rows;
  } finally {
    await browser.close();
  }
}


// ─── France: AlloCiné ───
//
// Box Office Mojo publishes French data late and sometimes not at all
// (measured 2026-11-23: FR was empty for the previous week). AlloCiné has the
// live French chart, so France uses it instead of falling back to the US list.
// The page no longer exposes admission counts, so only titles are read.

async function fetchAllocine() {
  const res = await fetch("https://www.allocine.fr/boxoffice/france/", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const marks = [...html.matchAll(/class="meta-title-link"[^>]*>([^<]+)<\/a>/g)];
  return marks.slice(0, 10).map((m) => ({
    title: m[1].replace(/&#0?39;/g, "'").replace(/&amp;/g, "&").trim(),
    gross: "",
  }));
}

// ─── Read whatever is already on disk (for the carry-forward rule) ───

async function readExisting() {
  try {
    const raw = await fs.readFile(OUT_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── Main ───

async function main() {
  const started = Date.now();
  const argWeek = process.argv.find((a) => a.startsWith("--week="));
  const week = argWeek ? argWeek.split("=")[1] : getBOMWeek(7);
  const existing = await readExisting();

  console.log(`[scrape-boxoffice] week=${week} countries=${COUNTRIES.length}`);

  const out = {
    generatedAt: new Date().toISOString(),
    week,
    countries: {},
  };

  for (const country of COUNTRIES) {
    let results = [];
    try {
      // France has its own source: BOM rarely carries FR rows in time.
      const raw =
        country === "FR"
          ? await fetchAllocine()
          : await fetchBOM(country === "US" ? "" : country, week);
      for (const item of raw) {
        const m = await tmdbSearch(item.title);
        results.push({
          ...m,
          backdrop: null,
          overview: "",
          genres: [],
          daysUntil: null,
          boxOffice: { gross: item.gross },
        });
      }
    } catch (e) {
      console.error(`[scrape-boxoffice] ${country} failed:`, e?.message || String(e));
    }

    if (results.length === 0) {
      // This country has not published this week yet. Keep the last good list
      // rather than replacing it with another country's chart.
      const prev = existing?.countries?.[country];
      if (prev && prev.length > 0) {
        results = prev;
        console.log(`[scrape-boxoffice] ${country}: 0 new - kept ${prev.length} from ${existing.generatedAt}`);
      } else {
        console.log(`[scrape-boxoffice] ${country}: 0 new - nothing to keep`);
      }
    } else {
      console.log(`[scrape-boxoffice] ${country}: ${results.length}`);
    }

    out.countries[country] = results.slice(0, PER_COUNTRY);
  }

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(out, null, 2));

  const filled = Object.values(out.countries).filter((v) => v.length > 0).length;
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[scrape-boxoffice] ${filled}/${COUNTRIES.length} countries have data`);
  console.log(`[scrape-boxoffice] wrote ${OUT_FILE} in ${secs}s`);
}

main().catch((e) => {
  console.error("[scrape-boxoffice] fatal:", e);
  process.exit(1);
});
