import { NextRequest, NextResponse } from "next/server";

// Security: allow trusted image CDNs (host-based, not string-prefix based)
const ALLOWED_HOSTS = new Set([
  "image.tmdb.org",
  "s4.anilist.co",
  "media.kitsu.app",
  "img.flixpatrol.com",
  "flixpatrol.com",
  "cdn.myanimelist.net",
  "img1.ak.crunchyroll.com",
  "static.tvmaze.com",
]);

// Hosts that may only be fetched under specific paths
const HOST_PATH_PREFIX: Record<string, string[]> = {
  "flixpatrol.com": ["/runtime/cache/files/posters/"],
};

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const FETCH_TIMEOUT_MS = 10_000;

function isAllowed(target: URL): boolean {
  if (target.protocol !== "https:") return false;
  const host = target.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return false;

  const restricted = HOST_PATH_PREFIX[host];
  if (restricted && !restricted.some((p) => target.pathname.startsWith(p))) {
    return false;
  }
  return true;
}

async function respondWithImage(res: Response): Promise<NextResponse> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    return new NextResponse("Not an image", { status: 415 });
  }

  const declared = Number(res.headers.get("content-length") || "0");
  if (declared > MAX_BYTES) {
    return new NextResponse("Too large", { status: 413 });
  }

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) {
    return new NextResponse("Too large", { status: 413 });
  }

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) {
    return new NextResponse("Missing url param", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  if (!isAllowed(target)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

  try {
    let res = await fetch(target.toString(), {
      // Never auto-follow: an allowed CDN must not be able to bounce this
      // proxy to an arbitrary internal or third-party address.
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        return new NextResponse("Redirect not allowed", { status: 502 });
      }
      let next: URL;
      try {
        next = new URL(location, target);
      } catch {
        return new NextResponse("Redirect not allowed", { status: 502 });
      }
      // Only follow a bounce that stays on the allowlist
      if (!isAllowed(next)) {
        return new NextResponse("Redirect not allowed", { status: 502 });
      }
      res = await fetch(next.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": UA },
      });
    }

    if (!res.ok) {
      return new NextResponse("Not found", { status: 404 });
    }
    return await respondWithImage(res);
  } catch {
    return new NextResponse("Error", { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
