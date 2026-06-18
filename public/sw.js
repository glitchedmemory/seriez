// Seriez Service Worker — hand-written because next-pwa fails with Next.js 16 Turbopack
const CACHE_JS = "seriez-js-v3";
const CACHE_CSS = "seriez-css-v3";
const CACHE_STATIC = "seriez-static-v3";
const CACHE_TMDB = "seriez-tmdb-v3";
const CACHE_ANILIST = "seriez-anilist-v3";
const CACHE_PAGES = "seriez-pages-v3";

// JS: NetworkFirst (must update on new deploys)
const JS_PATTERN = /\.js(\?.*)?$/;
// CSS: NetworkFirst
const CSS_PATTERN = /\.css(\?.*)?$/;
// Static fonts/icons: CacheFirst
const STATIC_PATTERN = /\.(?:woff2?|ttf|otf|png|svg|ico)$/;
// TMDB images
const TMDB_PATTERN = /^https:\/\/image\.tmdb\.org\/.*/;
// AniList images
const ANILIST_PATTERN = /^https:\/\/s4\.anilist\.co\/.*/;

function isPage(url) {
  return url.origin === self.location.origin &&
    !url.pathname.startsWith("/api/") &&
    !url.pathname.startsWith("/_next/");
}

function isAPI(url) {
  return url.origin === self.location.origin &&
    url.pathname.startsWith("/api/");
}

// NetworkFirst helper
async function networkFirst(request, cacheName, timeoutMs = 3000) {
  const cache = await caches.open(cacheName);
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), timeoutMs)
    );
    const response = await Promise.race([fetch(request), timeoutPromise]);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw e;
  }
}

// CacheFirst helper
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

// StaleWhileRevalidate helper
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== "GET") return;

  // NEVER cache sw.js itself (would deadlock updates)
  if (url.pathname === "/sw.js") return;

  if (JS_PATTERN.test(url.pathname)) {
    event.respondWith(networkFirst(request, CACHE_JS));
  } else if (CSS_PATTERN.test(url.pathname)) {
    event.respondWith(networkFirst(request, CACHE_CSS));
  } else if (STATIC_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
  } else if (TMDB_PATTERN.test(url.href)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_TMDB));
  } else if (ANILIST_PATTERN.test(url.href)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_ANILIST));
  } else if (isAPI(url)) {
    event.respondWith(networkFirst(request, "seriez-api-v3", 3000));
  } else if (isPage(url)) {
    event.respondWith(networkFirst(request, CACHE_PAGES, 3000));
  }
  // All other requests (including _next/ static chunks) pass through to network
});
