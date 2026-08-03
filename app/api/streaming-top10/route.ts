import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    const filePath = join(process.cwd(), "data", "streaming-top10.json");

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: "Data not available yet" },
        { status: 503 }
      );
    }

    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);

    return NextResponse.json(
      { updated_at: parsed.updated_at, data: parsed.data },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200",
        },
      }
    );
  } catch (e) {
    console.error("Failed to read streaming top 10 data:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
