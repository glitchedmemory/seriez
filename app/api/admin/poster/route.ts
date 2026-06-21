import { NextRequest, NextResponse } from "next/server";
import { upsertCustomPoster } from "@/lib/custom-posters";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tmdbId, posterUrl, mediaType } = body;

    if (!tmdbId || !posterUrl) {
      return NextResponse.json(
        { error: "Missing tmdbId or posterUrl" },
        { status: 400 }
      );
    }

    if (!posterUrl.startsWith("http")) {
      return NextResponse.json(
        { error: "posterUrl must be a valid URL" },
        { status: 400 }
      );
    }

    const result = await upsertCustomPoster(
      tmdbId,
      posterUrl,
      mediaType || "tv"
    );

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Upload failed" },
      { status: 500 }
    );
  }
}
