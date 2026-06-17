import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername } from "@/lib/auth-helper";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function jsonToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    const values = headers.map((h) => {
      const v = row[h];
      if (v === null || v === undefined) return "";
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    });
    lines.push(values.join(","));
  }
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";

    // Fetch all user data
    const [reviewsRes, libraryRes] = await Promise.all([
      supabaseAdmin
        .from("reviews")
        .select("tmdb_id, media_type, title, year, rating, content, created_at")
        .eq("username", username)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("media_trackings")
        .select("tmdb_id, media_type, title, year, status, rating, updated_at")
        .eq("username", username)
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
