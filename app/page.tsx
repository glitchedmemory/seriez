export const dynamic = "force-dynamic";

import { getTrending, getUpcoming } from "@/lib/tmdb";
import type { TmdbResult } from "@/lib/tmdb";
import { getAnimeUpcoming } from "@/lib/anilist";
import { getBoxOffice, getCountryName } from "@/lib/box-office";
import HomeClient from "@/components/HomeClient";
import { headers } from "next/headers";

export default async function Home() {
  let trending: Awaited<ReturnType<typeof getTrending>> = [];
  let upcoming: Awaited<ReturnType<typeof getUpcoming>> = [];
  let animeUpcoming: Awaited<ReturnType<typeof getAnimeUpcoming>> = [];
  let boxOffice: Awaited<ReturnType<typeof getBoxOffice>> = [];

  // Detect country from Cloudflare or Vercel headers
  const hdrs = await headers();
  const countryCode = (hdrs.get("cf-ipcountry") || hdrs.get("x-vercel-ip-country") || "US").toUpperCase();
  const region = getCountryName(countryCode);

  try {
    [trending, upcoming, animeUpcoming, boxOffice] = await Promise.all([
      getTrending(),
      getUpcoming(),
      getAnimeUpcoming(),
      getBoxOffice(countryCode),
    ]);
  } catch {
    // fallback: empty arrays, HomeClient shows empty states
  }

  // Remove Pritam and Pedro (TMDB TV 243206), inject Spider-Man: Brand New Day (TMDB 969681)
  const PRITAM_ID = 243206;
  const SPIDEY_ID = 969681;
  upcoming = upcoming.filter(item => item.id !== PRITAM_ID);

  let spideyData: TmdbResult | null = null;
  try {
    const spideyRes = await fetch(
      `https://api.themoviedb.org/3/movie/${SPIDEY_ID}?api_key=${process.env.TMDB_API_KEY}`,
      { next: { revalidate: 3600 } }
    );
    const spideyJson = await spideyRes.json();
    if (spideyJson.id) {
      spideyData = {
        id: spideyJson.id,
        title: spideyJson.title,
        poster: spideyJson.poster_path ? `https://image.tmdb.org/t/p/w500${spideyJson.poster_path}` : null,
        backdrop: spideyJson.backdrop_path ? `https://image.tmdb.org/t/p/w1280${spideyJson.backdrop_path}` : null,
        rating: Math.round(spideyJson.vote_average * 10) / 10,
        year: spideyJson.release_date ? parseInt(spideyJson.release_date.slice(0, 4)) : 0,
        type: "movie" as const,
        overview: spideyJson.overview || "",
        genres: (spideyJson.genres || []).slice(0, 3).map((g: any) => g.name),
        daysUntil: spideyJson.release_date
          ? Math.ceil((new Date(spideyJson.release_date).getTime() - Date.now()) / 86400000)
          : null,
      };
    }
  } catch {}

  if (spideyData) {
    upcoming = [spideyData, ...upcoming];
  }

  // Merge & shuffle: movies + TV + anime, random order per request
  const allUpcoming = [...upcoming, ...animeUpcoming];
  for (let i = allUpcoming.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allUpcoming[i], allUpcoming[j]] = [allUpcoming[j], allUpcoming[i]];
  }

  return <HomeClient trending={trending} upcoming={allUpcoming} animeUpcoming={[]} boxOffice={boxOffice} region={region} randomSeed={Date.now()} />;
}