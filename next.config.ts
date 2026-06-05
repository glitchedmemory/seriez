import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "img.flixpatrol.com" },
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "placehold.co" },
    ],
    unoptimized: false,
  },
};

export default nextConfig;
