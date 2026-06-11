export const dynamic = "force-dynamic";

import { getTrending, getUpcoming } from "@/lib/tmdb";
import { getBoxOffice, getCountryName } from "@/lib/box-office";
import HomeClient from "@/components/HomeClient";
import { headers } from "next/headers";

export default async function Home() {
  let trending: Awaited<ReturnType<typeof getTrending>> = [];
  let upcoming: Awaited<ReturnType<typeof getUpcoming>> = [];
  let boxOffice: Awaited<ReturnType<typeof getBoxOffice>> = [];

  // Detect country from Cloudflare or Vercel headers
  const hdrs = await headers();
  const countryCode = (hdrs.get("cf-ipcountry") || hdrs.get("x-vercel-ip-country") || "US").toUpperCase();
  const region = getCountryName(countryCode);

  try {
    [trending, upcoming, boxOffice] = await Promise.all([
      getTrending(),
      getUpcoming(),
      getBoxOffice(countryCode),
    ]);
  } catch {
    // fallback: empty arrays, HomeClient shows empty states
  }

  return <HomeClient trending={trending} upcoming={upcoming} boxOffice={boxOffice} region={region} randomSeed={Date.now()} />;
}