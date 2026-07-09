import SeasonClient from "@/components/SeasonClient";
import { fetchKitsuThumbnails } from "@/lib/anilist";
import { validateAndReplaceTrailers } from "@/lib/yt-validator";
import { notFound } from "next/navigation";
import { generateTVJsonLd, StructuredDataScript } from "@/lib/structured-data";
import { unstable_cache } from "next/cache";

const TMDB_BASE = "https://api.themoviedb.org/3";
const ANILIST_API = "https://graphql.anilist.co";
const API_KEY = process.env.TMDB_API_KEY!;

function poster(path: string | null) {
  return path ? `https://image.tmdb.org/t/p/w780${path}` : null;
}

function backdrop(path: string | null) {
  return path ? `https://image.tmdb.org/t/p/original${path}` : null;
}

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

const getSeasonData = unstable_cache(
  async (seriesId: number, seasonNum: number) => {
    const [seriesData, credits, similar, videos, seasonData, keywordsData, aggregateCredits] = await Promise.all([
      get(`/tv/${seriesId}`),
      get(`/tv/${seriesId}/credits`),
      get(`/tv/${seriesId}/similar`),
      get(`/tv/${seriesId}/videos`),
      get(`/tv/${seriesId}/season/${seasonNum}`),
      get(`/tv/${seriesId}/keywords`).catch(() => ({ results: [] })),
      get(`/tv/${seriesId}/aggregate_credits`),
    ]);

    const isAnimated = (seriesData.genres || []).some((g: any) => g.id === 16);
    const anilistBanner = (!seriesData.backdrop_path && isAnimated)
      ? await fetchAnilistBanner(seriesData.name).catch(() => null)
      : null;

    const keywordIds: number[] = ((keywordsData as any).results || []).map((k: any) => k.id);

    const aggCrew = (aggregateCredits as any).crew || [];
    const directors = aggCrew
      .filter((c: any) => (c.jobs || []).some((j: any) => j.job === "Director"))
      .sort((a: any, b: any) => {
        const aEp = (a.jobs || []).find((j: any) => j.job === "Director")?.episode_count || 0;
        const bEp = (b.jobs || []).find((j: any) => j.job === "Director")?.episode_count || 0;
        return bEp - aEp;
      })
      .map((d: any) => ({
        id: d.id, name: d.name, character: "Director", photo: poster(d.profile_path),
      }));

    const cast = [
      ...directors,
      ...(credits.cast || []).slice(0, 15).map((c: any) => ({
        id: c.id, name: c.name, character: c.character || "Unknown", photo: poster(c.profile_path),
      })),
    ];

    const seasonAirDate = seasonData.air_date ? new Date(seasonData.air_date) : null;
    const allTrailers = (videos.results || [])
      .filter((v: any) => v.site === "YouTube" && ["Trailer", "Teaser"].includes(v.type));
    const seasonPattern = new RegExp(`(season|s)\\s*${seasonNum}|season ${seasonNum}`, "i");
    const seasonMatched = allTrailers.filter((v: any) => seasonPattern.test(v.name));
    let dateMatched: any[] = [];
    if (seasonAirDate) {
      const before = new Date(seasonAirDate); before.setMonth(before.getMonth() - 12);
      const after = new Date(seasonAirDate); after.setMonth(after.getMonth() + 12);
      dateMatched = allTrailers.filter((v: any) => {
        if (!v.published_at) return false;
        const d = new Date(v.published_at);
        return d >= before && d <= after;
      });
    }
    const seasonTitles = [...seasonMatched, ...dateMatched];
    const deduped: any[] = [];
    const seenTrailer = new Set<string>();
    for (const v of seasonTitles) { if (!seenTrailer.has(v.key)) { seenTrailer.add(v.key); deduped.push(v); } }
    const rawVideos = deduped.slice(0, 3).map((v: any) => ({ key: v.key, name: v.name || "Trailer" }));
    const searchQuery = `${seriesData.name} season ${seasonNum} official trailer`;
    const validatedTrailers = await validateAndReplaceTrailers(rawVideos, searchQuery);

    const episodes = (seasonData.episodes || []).map((ep: any) => ({
      number: ep.episode_number, name: ep.name || `Episode ${ep.episode_number}`,
      overview: ep.overview || "", still: poster(ep.still_path),
      rating: Math.round((ep.vote_average || 0) * 10) / 10, voteCount: ep.vote_count || 0,
      airDate: ep.air_date || "", runtime: ep.runtime || 0,
    }));

    if (isAnimated && episodes.some((ep: any) => !ep.still)) {
      const kitsuThumbs = await fetchKitsuThumbnails(seriesData.name, 50).catch(() => new Map());
      if (kitsuThumbs.size > 0) {
        for (const ep of episodes) {
          if (!ep.still && kitsuThumbs.has(ep.number)) ep.still = kitsuThumbs.get(ep.number)!;
        }
      }
    }

    const sourceGenreIds: number[] = (seriesData.genres || []).map((g: any) => g.id);
    const genreSet = new Set(sourceGenreIds);
    const sourceIsAnimated = sourceGenreIds.includes(16);
    const minGenreMatch = genreSet.size <= 1 ? 1 : Math.min(2, Math.ceil(genreSet.size / 2));
    const sourceOverview = (seriesData.overview || "").toLowerCase();
    const sourceKeywords = keywordIds;

    const candidates = ((similar as any).results || [])
      .filter((item: any) => item.id !== seriesData.id)
      .filter((item: any) => item.name)
      .filter((item: any) => sourceIsAnimated || !(item.genre_ids || []).includes(16));

    const scored = candidates.map((item: any) => {
      const itemGenres: number[] = item.genre_ids || [];
      const dateStr = item.first_air_date || item.release_date || "";
      const year = dateStr ? parseInt(dateStr.slice(0, 4)) : 0;
      const itemOverview = (item.overview || "").toLowerCase();
      const genreOverlap = itemGenres.filter((gid: number) => genreSet.has(gid));
      const genreScore = sourceGenreIds.length > 0 ? genreOverlap.length / Math.max(sourceGenreIds.length, 1) : 0;
      const kwOverlap = sourceKeywords.filter((kid: number) => (item.genre_ids || []).includes(kid));
      const kwScore = sourceKeywords.length > 0 ? kwOverlap.length / Math.max(sourceKeywords.length, 1) : 0;
      const srcArr = sourceOverview.split(/\W+/).filter((w: string) => w.length > 2);
      const itemArr = itemOverview.split(/\W+/).filter((w: string) => w.length > 2);
      const srcSet = new Set(srcArr); const itemSet = new Set(itemArr);
      let intersectCount = 0; for (const w of srcSet) { if (itemSet.has(w)) intersectCount++; }
      const unionCount = new Set([...srcArr, ...itemArr]).size;
      const textScore = unionCount > 0 ? intersectCount / unionCount : 0;
      const combined = genreScore * 0.4 + kwScore * 0.3 + textScore * 0.3;
      return { id: item.id, title: item.name || item.title || "Unknown", poster: poster(item.poster_path),
        rating: Math.round((item.vote_average || 0) * 10) / 10, year, type: "tv" as "movie" | "tv",
        _score: combined, _genreOverlap: genreOverlap.length };
    });

    let similarItems = scored.filter((item: any) => item._genreOverlap >= minGenreMatch && item.year >= 2000)
      .sort((a: any, b: any) => b._score - a._score).slice(0, 12);
    if (similarItems.length === 0) {
      similarItems = scored.filter((item: any) => item._genreOverlap >= 1 && item.year >= 2000)
        .sort((a: any, b: any) => b._score - a._score).slice(0, 12);
    }
    if (similarItems.length === 0) {
      similarItems = scored.sort((a: any, b: any) => b._score - a._score).slice(0, 12);
    }

    const youtubeBackdrop = (!seriesData.backdrop_path && validatedTrailers.length > 0)
      ? `https://img.youtube.com/vi/${validatedTrailers[0].key}/maxresdefault.jpg` : null;

    return {
      id: seriesData.id, title: seriesData.name || "Unknown", tagline: seriesData.tagline || "",
      overview: seriesData.overview || "", posterPath: poster(seriesData.poster_path),
      backdropPath: backdrop(seriesData.backdrop_path), youtubeBackdrop,
      anilistBanner: anilistBanner || null,
      rating: Math.round(seriesData.vote_average * 10) / 10, voteCount: seriesData.vote_count || 0,
      year: seriesData.first_air_date ? parseInt(seriesData.first_air_date.slice(0, 4)) : 0,
      genres: (seriesData.genres || []).map((g: any) => g.name),
      status: seriesData.status || "Unknown", type: "tv" as const,
      totalSeasons: seriesData.number_of_seasons || 0, totalEpisodes: seriesData.number_of_episodes || 0,
      createdBy: (seriesData.created_by || []).map((c: any) => c.name),
      networks: (seriesData.networks || []).map((n: any) => n.name),
      lastAirDate: seriesData.last_air_date || "", cast,
      trailers: validatedTrailers.map((v) => ({ key: v.key, name: v.name, site: "YouTube", type: "Trailer" })),
      similar: similarItems,
      seasonNumber: seasonNum, seasonName: seasonData.name || `Season ${seasonNum}`,
      seasonOverview: seasonData.overview || "",
      seasonPoster: poster(seasonData.poster_path) || poster(seriesData.poster_path),
      seasonAirDate: seasonData.air_date || "", episodes,
      firstAirDate: seriesData.first_air_date || "",
    };
  },
  ["season-data"],
  { revalidate: 86400 }
);

interface Props {
  params: Promise<{ id: string; season: string }>;
}

export default async function SeasonPage({ params }: Props) {
  const { id, season } = await params;
  const seriesId = parseInt(id);
  const seasonNum = parseInt(season);
  if (isNaN(seriesId) || isNaN(seasonNum)) notFound();

  try {
    const data = await getSeasonData(seriesId, seasonNum);

    // Compute daysUntil (dynamic — computed per request, but data is cached)
    if (data.firstAirDate) {
      const diff = Math.ceil((new Date(data.firstAirDate).getTime() - Date.now()) / 86400000);
      if (diff > 0) (data as any).daysUntil = diff;
    }

    const jsonLd = generateTVJsonLd({
      title: data.title, description: data.overview, posterUrl: data.posterPath,
      rating: data.rating, ratingCount: data.voteCount, releaseYear: data.year,
      genres: data.genres, url: `/title/${seriesId}/season/${seasonNum}`,
      totalSeasons: data.totalSeasons, status: data.status, networks: data.networks,
    });

    return (
      <>
        <StructuredDataScript data={jsonLd} />
        <SeasonClient data={data} />
      </>
    );
  } catch (e: any) {
    console.error("Season page error:", e.message);
    notFound();
  }
}
