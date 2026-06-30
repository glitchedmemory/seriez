import type { NextConfig } from "next";
import withPWA from "next-pwa";
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  turbopack: {},
  allowedDevOrigins: ["*.trycloudflare.com"],
  async rewrites() {
    return [];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "static.tvmaze.com" },
      { protocol: "https", hostname: "media.kitsu.app" },
      { protocol: "https", hostname: "img.flixpatrol.com" },
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "cdn.myanimelist.net" },
      { protocol: "https", hostname: "img1.ak.crunchyroll.com" },
      { protocol: "https", hostname: "placehold.co" },
    ],
    unoptimized: false,
  },
};

const pwaOptions: any = {
  dest: "public",
  register: true,
  skipWaiting: true,
  clientsClaim: true,
  selfDestroying: true,
  disable: process.env.NODE_ENV === "development",
  buildExcludes: [/chunks\/.*\.css$/, /chunks\/.*\.css\.map$/, /^\/sw\.js$/],
  runtimeCaching: [
    {
      urlPattern: /\.js(\?.*)?$/,
      handler: "NetworkFirst",
      options: {
        cacheName: "js",
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
        networkTimeoutSeconds: 3,
      },
    },
    {
      urlPattern: /\.(?:woff2?|ttf|otf|png|svg|ico)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets",
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\.css(\?.*)?$/,
      handler: "NetworkFirst",
      options: {
        cacheName: "css",
        expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 },
        networkTimeoutSeconds: 3,
      },
    },
    {
      urlPattern: /^https:\/\/image\.tmdb\.org\/.*/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "tmdb-images",
        expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /^https:\/\/s4\.anilist\.co\/.*/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "anilist-images",
        expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
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
};

const withNextIntl = createNextIntlPlugin('./i18n.ts');

export default withNextIntl(withPWA(pwaOptions)(nextConfig));
