declare module "next-pwa" {
  import type { NextConfig } from "next";
  interface PWAOptions {
    dest?: string;
    register?: boolean;
    skipWaiting?: boolean;
    disable?: boolean;
    runtimeCaching?: Array<{
      urlPattern: RegExp | ((ctx: { url: URL }) => boolean);
      handler: "NetworkFirst" | "CacheFirst" | "StaleWhileRevalidate" | "NetworkOnly" | "CacheOnly";
      options?: {
        cacheName?: string;
        expiration?: { maxEntries?: number; maxAgeSeconds?: number };
        networkTimeoutSeconds?: number;
      };
    }>;
  }
  function withPWA(options: PWAOptions): (nextConfig: NextConfig) => NextConfig;
  export default withPWA;
}
