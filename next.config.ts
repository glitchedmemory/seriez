import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  turbopack: {},
  allowedDevOrigins: ["*.trycloudflare.com"],
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

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    // Static assets: cache-first (CSS, JS, fonts, icons)
    {
      urlPattern: /\.(?:css|js|woff2?|ttf|otf|png|svg|ico)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets",
        expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    // TMDB images: stale-while-revalidate (show cached, update bg)
    {
      urlPattern: /^https:\/\/image\.tmdb\.org\/.*/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "tmdb-images",
        expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    // AniList images: stale-while-revalidate
    {
      urlPattern: /^https:\/\/s4\.anilist\.co\/.*/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "anilist-images",
        expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    // App pages: network-first (try fresh, fallback to cache)
    {
      urlPattern: ({ url }: { url: URL }) =>
        url.origin === self.location.origin &&
        !url.pathname.startsWith("/api/") &&
        !url.pathname.startsWith("/_next/"),
      handler: "NetworkFirst",
      options: {
        cacheName: "pages",
        expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
        networkTimeoutSeconds: 3,
      },
    },
    // API responses: network-first with short timeout
    {
      urlPattern: ({ url }: { url: URL }) =>
        url.origin === self.location.origin && url.pathname.startsWith("/api/"),
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
        networkTimeoutSeconds: 3,
      },
    },
  ],
})(nextConfig);
