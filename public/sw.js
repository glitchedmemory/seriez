// Seriez Service Worker — passthrough only (no caching).
//
// Previous versions cached page HTML and static assets, which caused stale
// season lists and missing posters to persist in users' browsers after every
// deploy. To permanently fix that, this worker no longer caches ANYTHING:
// it just tears down every old cache and lets all requests hit the network.
const CACHE_VERSION = "seriez-v11";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Delete every cache this origin ever created, from any older version.
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await clients.claim();
    })()
  );
});

self.addEventListener("fetch", () => {
  // Do nothing — let all requests go straight to the network.
});
