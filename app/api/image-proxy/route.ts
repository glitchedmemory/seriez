import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return new NextResponse("Missing url param", { status: 400 });
  }

  // Security: only allow FlixPatrol poster URLs
  if (!url.startsWith("https://flixpatrol.com/runtime/cache/files/posters/")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Seriez/1.0)" },
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
