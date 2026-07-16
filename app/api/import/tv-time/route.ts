import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_API = "https://api.themoviedb.org/3";

type ImportResult = {
  shows: number;
  episodes: number;
  movies: number;
  failed: string[];
};

async function tvdbToTmdb(tvdbId: number): Promise<number | null> {
  try {
    const res = await fetch(
      `${TMDB_API}/find/${tvdbId}?external_source=tvdb_id&api_key=${TMDB_KEY}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const tv = json.tv_results?.[0];
    return tv?.id ?? null;
  } catch {
    return null;
  }
}

async function findMovie(name: string, year?: string): Promise<number | null> {
  try {
    const query = year ? `${name} year:${year}` : name;
    const res = await fetch(
      `${TMDB_API}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.results?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (!file.name.endsWith(".csv")) return NextResponse.json({ error: "Only CSV files accepted" }, { status: 400 });

  const text = await file.text();
  const result: ImportResult = { shows: 0, episodes: 0, movies: 0, failed: [] };

  const rows = text.split("\n").filter(Boolean);
  if (rows.length < 2) return NextResponse.json({ error: "CSV is empty" }, { status: 400 });

  // Detect CSV type: tracking-prod-records-v2.csv (TV) or tracking-prod-records.csv (movies)
  const header = rows[0].toLowerCase();
  const isTvCsv = header.includes("s_id") && header.includes("season");

  if (isTvCsv) {
    // TV show CSV: s_id (TVDB), season_number, episode_number, created_at
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i].split(",");
      const tvdbId = parseInt(cols[0]); // s_id
      const season = parseInt(cols[1]);
      const episode = parseInt(cols[2]);

      if (!tvdbId || isNaN(tvdbId)) continue;

      const tmdbId = await tvdbToTmdb(tvdbId);
      if (!tmdbId) {
        result.failed.push(`TVDB ${tvdbId} — no TMDB match`);
        continue;
      }

      // Upsert show tracking
      try {
        await supabase.from("media_trackings").upsert({
          user_id: user.id,
          tmdb_id: tmdbId,
          media_type: "tv",
          status: "watched",
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,tmdb_id,media_type" });

        // Mark episode as watched (if season/episode provided)
        if (!isNaN(season) && !isNaN(episode)) {
          await supabase.from("episode_watched").upsert({
            user_id: user.id,
            tmdb_id: tmdbId,
            season_number: season,
            episode_number: episode,
            watched_at: new Date().toISOString(),
          }, { onConflict: "user_id,tmdb_id,season_number,episode_number" });
          result.episodes++;
        }
        result.shows++;
      } catch (e) {
        result.failed.push(`TMDB ${tmdbId} — DB error`);
      }
    }
  } else {
    // Movie CSV: movie name, release year
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i].split(",");
      const name = cols[0]?.trim();
      const year = cols[1]?.trim();

      if (!name) continue;

      const movieId = await findMovie(name, year);
      if (!movieId) {
        result.failed.push(`${name} — no TMDB match`);
        continue;
      }

      try {
        await supabase.from("media_trackings").upsert({
          user_id: user.id,
          tmdb_id: movieId,
          media_type: "movie",
          status: "watched",
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,tmdb_id,media_type" });
        result.movies++;
      } catch (e) {
        result.failed.push(`${name} — DB error`);
      }
    }
  }

  return NextResponse.json(result);
}
