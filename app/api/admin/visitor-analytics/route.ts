import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername, STAFF_ROLES } from "@/lib/auth-helper";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { data: userData } = await supabaseAdmin
      .from("users").select("role").eq("username", username).maybeSingle();
    if (!STAFF_ROLES.includes(userData?.role || "")) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // --- Page views (human visits, last 7 days) ---
    const { data: visits } = await supabaseAdmin
      .from("human_visits")
      .select("path, locale, created_at")
      .gte("created_at", sevenDaysAgo);

    // Total real (human) visits
    const { count: totalHumanVisits7d } = await supabaseAdmin
      .from("human_visits")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo);

    // Per-page counts
    const pageMap: Record<string, number> = {};
    for (const v of visits || []) {
      const p = v.path || "/";
      pageMap[p] = (pageMap[p] || 0) + 1;
    }
    const top_pages = Object.entries(pageMap)
      .sort((a, b) => b[1] - a[1])
      .map(([path, count]) => ({ path, count }));

    // Daily visits (trend)
    const dailyMap: Record<string, number> = {};
    for (const v of visits || []) {
      const day = (v.created_at || "").slice(0, 10);
      if (day) dailyMap[day] = (dailyMap[day] || 0) + 1;
    }
    const daily_visits = Object.entries(dailyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    // --- Content visits: country + device + top titles (last 7 days) ---
    const { data: contentVisits } = await supabaseAdmin
      .from("content_visits")
      .select("tmdb_id, media_type, country, device, source")
      .gte("created_at", sevenDaysAgo);

    // Share-driven visits (utm_source=share)
    const { count: shareVisits7d } = await supabaseAdmin
      .from("content_visits")
      .select("*", { count: "exact", head: true })
      .eq("source", "share")
      .gte("created_at", sevenDaysAgo);

    // Referrer (origin) breakdown — from human_visits.referrer
    const { data: humanVisitsWithRef } = await supabaseAdmin
      .from("human_visits")
      .select("referrer")
      .gte("created_at", sevenDaysAgo);

    const referrerMap: Record<string, number> = {};
    for (const v of humanVisitsWithRef || []) {
      const raw = v.referrer || "";
      if (!raw) continue;
      let host = "unknown";
      try {
        host = new URL(raw).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }
      referrerMap[host] = (referrerMap[host] || 0) + 1;
    }
    const referrers = Object.entries(referrerMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([referrer, count]) => ({ referrer, count }));

    // Country breakdown
    const countryMap: Record<string, number> = {};
    for (const c of contentVisits || []) {
      const k = c.country || "Unknown";
      countryMap[k] = (countryMap[k] || 0) + 1;
    }
    const countries = Object.entries(countryMap)
      .sort((a, b) => b[1] - a[1])
      .map(([country, count]) => ({ country, count }));

    // Device breakdown
    const deviceMap: Record<string, number> = {};
    for (const c of contentVisits || []) {
      const k = c.device || "unknown";
      deviceMap[k] = (deviceMap[k] || 0) + 1;
    }
    const devices = Object.entries(deviceMap)
      .sort((a, b) => b[1] - a[1])
      .map(([device, count]) => ({ device, count }));

    // Top visited titles
    const titleMap: Record<string, number> = {};
    for (const c of contentVisits || []) {
      const k = `${c.media_type}-${c.tmdb_id}`;
      titleMap[k] = (titleMap[k] || 0) + 1;
    }
    const top_titles = Object.entries(titleMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([key, count]) => {
        const [media_type, tmdb_id] = key.split("-");
        return { tmdb_id: parseInt(tmdb_id), media_type, count };
      });

    return NextResponse.json({
      total_human_visits_7d: totalHumanVisits7d || 0,
      share_visits_7d: shareVisits7d || 0,
      top_pages: top_pages.slice(0, 20),
      daily_visits,
      countries: countries.slice(0, 15),
      devices,
      referrers,
      top_titles,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
