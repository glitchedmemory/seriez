import type { NextConfig } from "next";
import withPWA from "next-pwa";

const config: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
      {
        protocol: "https",
        hostname: "img.flixpatrol.com",
      },
      {
        protocol: "https",
        hostname: "s4.anilist.co",
      },
    ],
  },
};

const nextConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
})(config);

export default nextConfig;
