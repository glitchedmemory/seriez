import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return new NextResponse("Missing url param", { status: 400 });
  }

  // Security: allow trusted image CDNs
  const ALLOWED = [
    "https://image.tmdb.org/",
    "https://s4.anilist.co/",
    "https://media.kitsu.app/",
    "https://img.flixpatrol.com/",
    "https://flixpatrol.com/runtime/cache/files/posters/",
    "https://cdn.myanimelist.net/",
    "https://img1.ak.crunchyroll.com/",
    "https://static.tvmaze.com/",
  ];
  if (!ALLOWED.some((prefix) => url.startsWith(prefix))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) {
      return new NextResponse("Not found", { status: 404 });
    }
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const cacheControl = "public, max-age=86400, stale-while-revalidate=604800";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      },
    });
  } catch {
    return new NextResponse("Error", { status: 502 });
  }
}
