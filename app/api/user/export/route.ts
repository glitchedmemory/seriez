import { NextRequest, NextResponse } from "next/server";
import { resolveUsername } from "@/lib/auth-helper";
import { createClient } from "@/lib/supabase/server";

// Rate limit: IP당 분당 1회
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1분

function checkRateLimit(req: NextRequest): boolean {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const lastCall = rateLimitMap.get(ip);
  if (lastCall && now - lastCall < RATE_LIMIT_WINDOW_MS) {
    return false; // rate limited
  }
  rateLimitMap.set(ip, now);
  return true;
}

function jsonToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    const values = headers.map((h) => {
      const v = row[h];
      if (v === null || v === undefined) return "";
      let s = String(v);
      // CSV Injection 방어: =, +, -, @, 탭, 캐리지리턴으로 시작하면 single quote prefix
      if (/^[=+\-@\t\r]/.test(s)) {
        s = "'" + s;
      }
      s = s.replace(/"/g, '""');
      return `"${s}"`;
    });
    lines.push(values.join(","));
  }
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  try {
    // Rate limit check
    if (!checkRateLimit(req)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before exporting again." },
        { status: 429 }
      );
    }

    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";

    const supabase = await createClient();

    // Fetch all user data
    const [reviewsRes, libraryRes] = await Promise.all([
      supabase
        .from("reviews")
        .select("tmdb_id, media_type, rating, content, has_spoiler, created_at")
        .eq("username", username)
        .order("created_at", { ascending: false }),
      supabase
        .from("media_trackings")
        .select("tmdb_id, media_type, status, rating, progress, updated_at")
        .order("updated_at", { ascending: false }),
    ]);

    const data: Record<string, unknown> = {
      username,
      exported_at: new Date().toISOString(),
      reviews: reviewsRes.data || [],
      library: libraryRes.data || [],
    };

    if (format === "csv") {
      // CSV: one combined flat file with sections
      const sections: string[] = [];
      sections.push(`# Seriez Data Export for ${username}`);
      sections.push(`# Exported: ${data.exported_at}`);
      sections.push("");

      sections.push("# Reviews");
      if (reviewsRes.data && reviewsRes.data.length > 0) {
        sections.push(jsonToCsv(reviewsRes.data));
      } else {
        sections.push("(no reviews)");
      }
      sections.push("");

      sections.push("# Library");
      if (libraryRes.data && libraryRes.data.length > 0) {
        sections.push(jsonToCsv(libraryRes.data));
      } else {
        sections.push("(no library items)");
      }

      return new NextResponse(sections.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="seriez-export-${username}.csv"`,
        },
      });
    }

    // Default: JSON
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="seriez-export-${username}.json"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
