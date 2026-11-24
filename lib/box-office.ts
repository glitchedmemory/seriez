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
export async function getBoxOffice(country: string): Promise<BoxOfficeResult[]> {
  const snapshot = await readSnapshot();
  if (!snapshot) {
    console.warn("[box-office] snapshot missing - serving empty list");
    return [];
  }

  const forCountry = snapshot.countries?.[country];
  if (forCountry && forCountry.length > 0) return forCountry.slice(0, 7);

  // No data for this country yet.
  //
  // This used to fall back to the US chart, which meant a visitor in France,
  // Korea or Japan was shown American films under their own country's header.
  // Box office is weekly and every country publishes on its own delay, so an
  // empty entry is normal and expected -- not a reason to substitute another
  // country's numbers. The UI shows an empty state instead.
  if (country !== "US") {
    console.warn(
      `[box-office] no data for ${country} (week ${snapshot.week}) - serving empty list`
    );
  }
  return [];
}

/** Age of the snapshot in hours, or null when it cannot be read. */
export async function getBoxOfficeAgeHours(): Promise<number | null> {
  const snapshot = await readSnapshot();
  if (!snapshot?.generatedAt) return null;
  const t = Date.parse(snapshot.generatedAt);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 3600000;
}
