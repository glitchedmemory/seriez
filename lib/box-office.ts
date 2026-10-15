import fs from "fs/promises";
import path from "path";

export const revalidate = 3600;

// ─── Types ───

interface BoxOfficeResult {
  id: number;
  title: string;
  poster: string | null;
  year: number;
  rating: number;
  type: "movie";
  backdrop: null;
  overview: string;
  genres: string[];
  daysUntil: null;
  boxOffice: { gross: string };
}

interface BoxOfficeFile {
  generatedAt: string;
  week: string;
  countries: Record<string, BoxOfficeResult[]>;
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
  CN: "China",
  BR: "Brazil",
};

export function getCountryName(code: string): string {
  return COUNTRY_NAMES[code] || code;
}

// ─── Read the pre-scraped snapshot ───
//
// IMPORTANT: this file deliberately contains NO Playwright and NO scraping.
// Headless Chromium used to be launched from inside the Next.js server on
// every cache miss, which repeatedly exhausted the heap and crashed the app
// (47 OOM crashes / 477 PM2 restarts). Scraping now runs out-of-process via
// scripts/scrape-boxoffice.mjs; this module only reads its output.
//
// If the snapshot is missing or stale, we serve whatever is on disk (or an
// empty list) so the page never blocks on a scrape.

const SNAPSHOT = path.join(process.cwd(), "data", "boxoffice.json");

async function readSnapshot(): Promise<BoxOfficeFile | null> {
  try {
    const raw = await fs.readFile(SNAPSHOT, "utf-8");
    return JSON.parse(raw) as BoxOfficeFile;
  } catch {
    return null;
  }
}

export async function getBoxOffice(country: string): Promise<BoxOfficeResult[]> {
  const snapshot = await readSnapshot();
  if (!snapshot) {
    console.warn("[box-office] snapshot missing - serving empty list");
    return [];
  }

  const forCountry = snapshot.countries?.[country];
  if (forCountry && forCountry.length > 0) return forCountry.slice(0, 7);

  // Fall back to US, matching the previous in-app behaviour.
  const us = snapshot.countries?.US ?? [];
  return us.slice(0, 7);
}
