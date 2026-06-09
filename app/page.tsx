export const dynamic = "force-dynamic";

import { getTrending, getUpcoming, getNowPlaying } from "@/lib/tmdb";
import HomeClient from "@/components/HomeClient";
import { headers } from "next/headers";

export default async function Home() {
  let trending: Awaited<ReturnType<typeof getTrending>> = [];
  let upcoming: Awaited<ReturnType<typeof getUpcoming>> = [];
  let boxOffice: Awaited<ReturnType<typeof getNowPlaying>> = [];

  // Detect country from Cloudflare or Vercel headers
  const hdrs = await headers();
  const country = (hdrs.get("cf-ipcountry") || hdrs.get("x-vercel-ip-country") || "US").toUpperCase();

  try {
    [trending, upcoming, boxOffice] = await Promise.all([
      getTrending(),
      getUpcoming(),
      getNowPlaying(country),
    ]);
  } catch {
    // fallback: empty arrays, HomeClient shows empty states
  }

  // Deterministic seed from data — avoids busting ISR cache on every request
  const seed = trending.length > 0 ? trending[0].id : 0;
  return <HomeClient trending={trending} upcoming={upcoming} boxOffice={boxOffice} region={country} randomSeed={seed} />;
}