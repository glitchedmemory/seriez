export const dynamic = "force-dynamic";

import { getTrending, getUpcoming } from "@/lib/tmdb";
import type { TmdbResult } from "@/lib/tmdb";
import { getAnimeUpcoming, getAnimeTrending } from "@/lib/anilist";
import { getBoxOffice, getCountryName } from "@/lib/box-office";
import { getTonightsPick } from "@/lib/curation";
import HomeClient from "@/components/HomeClient";
import { headers } from "next/headers";

export default async function Home() {
  let trending: Awaited<ReturnType<typeof getTrending>> = [];
  let upcoming: Awaited<ReturnType<typeof getUpcoming>> = [];
  let animeUpcoming: Awaited<ReturnType<typeof getAnimeUpcoming>> = [];
  let animeTrending: Awaited<ReturnType<typeof getAnimeTrending>> = [];
  let boxOffice: Awaited<ReturnType<typeof getBoxOffice>> = [];

  // Detect country from Cloudflare or Vercel headers
  const hdrs = await headers();
  const countryCode = (hdrs.get("cf-ipcountry") || hdrs.get("x-vercel-ip-country") || "US").toUpperCase();
  const region = getCountryName(countryCode);

  try {
    [trending, upcoming, animeUpcoming, animeTrending, boxOffice] = await Promise.all([
      getTrending(),
      getUpcoming(),
      getAnimeUpcoming(),
      getAnimeTrending(),
      getBoxOffice(countryCode),
    ]);
  } catch {
    // fallback: empty arrays, HomeClient shows empty states
  }

  // Merge anime trending into the pool
  trending = [...trending, ...animeTrending];

  // Remove obscure TV shows + Pritam and Pedro
  const REMOVE_IDS = [
    243206, // Pritam and Pedro
    258230, // Last Seen (no poster, rating 0)
    319124, // Taskmaster NL (obscure)
    325874, // Specijalisti Zagreb (obscure)
    316540, // Bittersweet Love (obscure)
    297577, // Rizzler News (no poster, fake entry)
  ];
  upcoming = upcoming.filter(item => !REMOVE_IDS.includes(item.id) && item.poster);

  // Inject anticipated titles: Spider-Man + 3 upcoming TV shows
  const KEY = process.env.TMDB_API_KEY;
  const injectIds = [
    { id: 969681, type: "movie" as const }, // Spider-Man: Brand New Day
    { id: 97546, type: "tv" as const },     // Ted Lasso S4 (Aug 4)
    { id: 95350, type: "tv" as const },     // Lanterns (HBO, Aug 16)
    { id: 95480, type: "tv" as const },     // Slow Horses S6 (Apple TV+, Sep 16)
    { id: 291350, type: "tv" as const },    // Anna Pigeon (USA Network, Aug 7)
    { id: 213375, type: "tv" as const },    // VisionQuest (Disney+, Oct 14)
  ];

  const injected: TmdbResult[] = (
    await Promise.all(
      injectIds.map(async ({ id, type }) => {
        try {
          const ep = type === "tv" ? "/tv" : "/movie";
          const res = await fetch(
            `https://api.themoviedb.org/3${ep}/${id}?api_key=${KEY}`,
            { next: { revalidate: 3600 } }
          );
          const j = await res.json();
          if (!j.id) return null;

          const dateStr = type === "tv"
            ? j.next_episode_to_air?.air_date || j.first_air_date
            : j.release_date;
          const daysUntil = dateStr
            ? Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
            : null;

          return {
            id: j.id,
            title: j.title || j.name || "Unknown",
            poster: j.poster_path ? `https://image.tmdb.org/t/p/w500${j.poster_path}` : null,
            backdrop: j.backdrop_path ? `https://image.tmdb.org/t/p/w1280${j.backdrop_path}` : null,
            rating: Math.round((j.vote_average || 0) * 10) / 10,
            year: dateStr ? parseInt(dateStr.slice(0, 4)) : 0,
            type,
            overview: j.overview || "",
            genres: (j.genres || []).slice(0, 3).map((g: any) => g.name),
            daysUntil: daysUntil && daysUntil > 0 ? daysUntil : null,
          } as TmdbResult;
        } catch {
          return null;
        }
      })
    )
  ).filter(Boolean) as TmdbResult[];

  upcoming = [...injected, ...upcoming];

  // Merge & shuffle: movies + TV + anime, random order per request. Filter out items without posters.
  const allUpcoming = [...upcoming, ...animeUpcoming].filter(item => item.poster);
  for (let i = allUpcoming.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allUpcoming[i], allUpcoming[j]] = [allUpcoming[j], allUpcoming[i]];
  }

  // ponytail: separate try/catch so curation failure doesn't break the page
  const COUNTRY_TZ: Record<string, string> = {
    US: "America/New_York", GB: "Europe/London", KR: "Asia/Seoul", JP: "Asia/Tokyo",
    CN: "Asia/Shanghai", DE: "Europe/Berlin", FR: "Europe/Paris", ES: "Europe/Madrid",
    IT: "Europe/Rome", AU: "Australia/Sydney", CA: "America/Toronto", BR: "America/Sao_Paulo",
    IN: "Asia/Kolkata", MX: "America/Mexico_City", RU: "Europe/Moscow", NL: "Europe/Amsterdam",
    SE: "Europe/Stockholm", NO: "Europe/Oslo", DK: "Europe/Copenhagen", FI: "Europe/Helsinki",
    PL: "Europe/Warsaw", TR: "Europe/Istanbul", AR: "America/Argentina/Buenos_Aires",
    CL: "America/Santiago", CO: "America/Bogota", PE: "America/Lima", PH: "Asia/Manila",
    ID: "Asia/Jakarta", TH: "Asia/Bangkok", VN: "Asia/Ho_Chi_Minh", SG: "Asia/Singapore",
    MY: "Asia/Kuala_Lumpur", NZ: "Pacific/Auckland", ZA: "Africa/Johannesburg",
    EG: "Africa/Cairo", NG: "Africa/Lagos", KE: "Africa/Nairobi", IL: "Asia/Jerusalem",
    AE: "Asia/Dubai", SA: "Asia/Riyadh", PT: "Europe/Lisbon", AT: "Europe/Vienna",
    BE: "Europe/Brussels", CH: "Europe/Zurich", IE: "Europe/Dublin", CZ: "Europe/Prague",
    HU: "Europe/Budapest", RO: "Europe/Bucharest", UA: "Europe/Kyiv", GR: "Europe/Athens",
    TW: "Asia/Taipei", HK: "Asia/Hong_Kong",
  };
  const tz = COUNTRY_TZ[countryCode];
  let curated: Awaited<ReturnType<typeof getTonightsPick>> = null;
  try { curated = await getTonightsPick(tz); } catch {}

  return <HomeClient trending={trending} upcoming={allUpcoming} animeUpcoming={[]} boxOffice={boxOffice} region={region} randomSeed={Date.now()} curatedHero={curated?.hero} curatedNextHero={curated?.nextHero} />;
}
