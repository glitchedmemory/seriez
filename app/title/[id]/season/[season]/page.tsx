import SeasonClient from "@/components/SeasonClient";
import { notFound } from "next/navigation";

const TMDB_BASE = "https://api.themoviedb.org/3";
const ANILIST_API = "https://graphql.anilist.co";
const API_KEY = process.env.TMDB_API_KEY!;

function poster(path: string | null) {
  return path ? `https://image.tmdb.org/t/p/w342${path}` : null;
}

/** Fetch AniList banner image for a given anime title */
async function fetchAnilistBanner(title: string): Promise<string | null> {
  try {
    const res = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query($search: String) { Media(search: $search, type: ANIME) { bannerImage } }`,
        variables: { search: title },
      }),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.Media?.bannerImage || null;
  } catch {
    return null;
  }
}

async function get(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("language", "en-US");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

interface Props {
  params: Promise<{ id: string; season: string }>;
}

export default async function SeasonPage({ params }: Props) {
  const { id, season } = await params;
  const seriesId = parseInt(id);
  const seasonNum = parseInt(season);
  if (isNaN(seriesId) || isNaN(seasonNum)) notFound();

  try {
    // Fetch series detail + season detail in parallel
    const [seriesData, credits, similar, videos, seasonData, keywordsData] = await Promise.all([
      get(`/tv/${seriesId}`),
      get(`/tv/${seriesId}/credits`),
      get(`/tv/${seriesId}/similar`),
      get(`/tv/${seriesId}/videos`),
      get(`/tv/${seriesId}/season/${seasonNum}`),
      get(`/tv/${seriesId}/keywords`).catch(() => ({ results: [] })),
    ]);

    // AniList banner fallback for anime without TMDB backdrop
    const isAnimated = (seriesData.genres || []).some((g: any) => g.id === 16);
    const anilistBanner = (!seriesData.backdrop_path && isAnimated)
      ? await fetchAnilistBanner(seriesData.name).catch(() => null)
      : null;

    // Extract keyword IDs
    const keywordIds: number[] = ((keywordsData as any).results || []).map((k: any) => k.id);

    // Format cast
    const cast = (credits.cast || []).slice(0, 15).map((c: any) => ({
      id: c.id,
      name: c.name,
      character: c.character || "Unknown",
      photo: poster(c.profile_path),
    }));

    // Format trailers — match to this season
    const seasonAirDate = seasonData.air_date ? new Date(seasonData.air_date) : null;
    const allTrailers = (videos.results || [])
      .filter((v: any) => v.site === "YouTube" && ["Trailer", "Teaser"].includes(v.type));

    // First: try to match by season number in name
    const seasonPattern = new RegExp(
      `(season|s)\\s*${seasonNum}|season ${seasonNum}`,
      "i"
    );
    const seasonMatched = allTrailers.filter((v: any) =>
      seasonPattern.test(v.name)
    );

    // Second: match by publish date (±12 months of season air date)
    let dateMatched: any[] = [];
    if (seasonAirDate) {
      const before = new Date(seasonAirDate);
      before.setMonth(before.getMonth() - 12);
      const after = new Date(seasonAirDate);
      after.setMonth(after.getMonth() + 12);
      dateMatched = allTrailers.filter((v: any) => {
        if (!v.published_at) return false;
        const d = new Date(v.published_at);
        return d >= before && d <= after;
      });
    }

    // Combine and deduplicate, prefer name matches
    const seen = new Set<string>();
    const trailers: any[] = [];
    for (const v of [...seasonMatched, ...dateMatched]) {
      if (!seen.has(v.key)) {
        seen.add(v.key);
        trailers.push(v);
      }
    }

    // Fallback: search YouTube directly for season-specific trailer
    if (trailers.length === 0) {
      const query = encodeURIComponent(
        `${seriesData.name} season ${seasonNum} official trailer`
      );
      try {
        const ddgRes = await fetch(
          `https://html.duckduckgo.com/html/?q=${query}+site:youtube.com`,
          { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 86400 } }
        );
        const html = await ddgRes.text();
        // Extract YouTube video IDs from search results
        const ytMatches = html.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/g) || [];
        const ytIds = [...new Set(ytMatches.map((u: string) => u.split("v=")[1]?.slice(0, 11)))];
        for (const ytId of ytIds.slice(0, 3)) {
          trailers.push({
            key: ytId,
            name: `Season ${seasonNum} Trailer`,
            site: "YouTube",
            type: "Trailer",
          });
        }
      } catch {
        // silent — no trailers remain empty
      }
    }

    // Format episodes
    const episodes = (seasonData.episodes || []).map((ep: any) => ({
      number: ep.episode_number,
      name: ep.name || `Episode ${ep.episode_number}`,
      overview: ep.overview || "",
      still: poster(ep.still_path),
      rating: Math.round((ep.vote_average || 0) * 10) / 10,
      voteCount: ep.vote_count || 0,
      airDate: ep.air_date || "",
      runtime: ep.runtime || 0,
    }));

    // Format similar with deep curation (genre + keyword + overview text similarity)
    const sourceGenreIds: number[] = (seriesData.genres || []).map((g: any) => g.id);
    const genreSet = new Set(sourceGenreIds);
    const sourceIsAnimated = sourceGenreIds.includes(16);
    const minGenreMatch = genreSet.size <= 1 ? 1 : Math.min(2, Math.ceil(genreSet.size / 2));
    const sourceOverview = (seriesData.overview || "").toLowerCase();
    const sourceKeywords = keywordIds;

    // Base filter: TV only, not self, not anime (if source isn't), genre match, year ≥2000
    const candidates = ((similar as any).results || [])
      .filter((item: any) => item.id !== seriesData.id)
      .filter((item: any) => item.name)
      .filter((item: any) => sourceIsAnimated || !(item.genre_ids || []).includes(16));

    // Score each candidate: genre 40% + keyword 30% + overview text 30%
    const scored = candidates.map((item: any) => {
      const itemGenres: number[] = item.genre_ids || [];
      const dateStr = item.first_air_date || item.release_date || "";
      const year = dateStr ? parseInt(dateStr.slice(0, 4)) : 0;
      const itemOverview = (item.overview || "").toLowerCase();

      // Genre score
      const genreOverlap = itemGenres.filter((gid: number) => genreSet.has(gid));
      const genreScore = sourceGenreIds.length > 0
        ? genreOverlap.length / Math.max(sourceGenreIds.length, 1)
        : 0;

      // Keyword score
      const kwOverlap = sourceKeywords.filter((kid: number) =>
        (item.genre_ids || []).includes(kid)
      );
      const kwScore = sourceKeywords.length > 0
        ? kwOverlap.length / Math.max(sourceKeywords.length, 1)
        : 0;

      // Text similarity (Jaccard on word sets)
      const srcArr = sourceOverview.split(/\W+/).filter((w: string) => w.length > 2);
      const itemArr = itemOverview.split(/\W+/).filter((w: string) => w.length > 2);
      const srcSet = new Set(srcArr);
      const itemSet = new Set(itemArr);
      let intersectCount = 0;
      for (const w of srcSet) { if (itemSet.has(w)) intersectCount++; }
      const unionCount = new Set([...srcArr, ...itemArr]).size;
      const textScore = unionCount > 0 ? intersectCount / unionCount : 0;

      const combined = genreScore * 0.4 + kwScore * 0.3 + textScore * 0.3;
      return {
        id: item.id,
        title: item.name || item.title || "Unknown",
        poster: poster(item.poster_path),
        rating: Math.round((item.vote_average || 0) * 10) / 10,
        year,
        type: "tv" as "movie" | "tv",
        _score: combined,
        _genreOverlap: genreOverlap.length,
      };
    });

    // Filter with fallback: strict → loose → any (section must NEVER be empty)
    let similarItems = scored
      .filter((item: any) => item._genreOverlap >= minGenreMatch && item.year >= 2000)
      .sort((a: any, b: any) => b._score - a._score)
      .slice(0, 12);

    if (similarItems.length === 0) {
      similarItems = scored
        .filter((item: any) => item._genreOverlap >= 1 && item.year >= 2000)
        .sort((a: any, b: any) => b._score - a._score)
        .slice(0, 12);
    }
    if (similarItems.length === 0) {
      similarItems = scored
        .sort((a: any, b: any) => b._score - a._score)
        .slice(0, 12);
    }

    const data = {
      // Series info
      id: seriesData.id,
      title: seriesData.name || "Unknown",
      tagline: seriesData.tagline || "",
      overview: seriesData.overview || "",
      posterPath: poster(seriesData.poster_path),
      backdropPath: poster(seriesData.backdrop_path),
      anilistBanner: anilistBanner || null,
      rating: Math.round(seriesData.vote_average * 10) / 10,
      voteCount: seriesData.vote_count || 0,
      year: seriesData.first_air_date ? parseInt(seriesData.first_air_date.slice(0, 4)) : 0,
      genres: (seriesData.genres || []).map((g: any) => g.name),
      status: seriesData.status || "Unknown",
      type: "tv" as const,
      totalSeasons: seriesData.number_of_seasons || 0,
      totalEpisodes: seriesData.number_of_episodes || 0,
      createdBy: (seriesData.created_by || []).map((c: any) => c.name),
      networks: (seriesData.networks || []).map((n: any) => n.name),
      lastAirDate: seriesData.last_air_date || "",
      cast,
      trailers,
      similar: similarItems,
      // Season info
      seasonNumber: seasonNum,
      seasonName: seasonData.name || `Season ${seasonNum}`,
      seasonOverview: seasonData.overview || "",
      seasonPoster: poster(seasonData.poster_path) || poster(seriesData.poster_path),
      seasonAirDate: seasonData.air_date || "",
      episodes,
    };

    return <SeasonClient data={data} />;
  } catch (e: any) {
    console.error("Season page error:", e.message);
    notFound();
  }
}
