const ANILIST_API = "https://graphql.anilist.co";

// ─── Types ───

export type AnimeDetail = {
  id: number;
  title: string;
  titleRomaji: string;
  titleNative: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  rating: number;       // 0-10 scale
  popularity: number;
  year: number;
  season: string;
  format: string;       // TV, MOVIE, OVA, ONA, SPECIAL, MUSIC
  status: string;       // FINISHED, RELEASING, NOT_YET_RELEASED, CANCELLED, HIATUS
  episodes: number;
  duration: number;     // minutes per episode
  genres: string[];
  tags: { name: string; rank: number }[];
  studios: string[];
  staff: { name: string; role: string }[];
  characters: { name: string; role: string; voiceActor: string; image: string | null }[];
  recommendations: AnimeRecItem[];
  trailer: { id: string; site: string } | null;
  relations: { id: number; title: string; type: string; format: string }[];
};

export type AnimeRecItem = {
  id: number;
  title: string;
  poster: string | null;
  rating: number;
  year: number;
  genres: string[];
};

// ─── GraphQL Query ───

const DETAIL_QUERY = `
query($id: Int) {
  Media(id: $id) {
    id
    title { romaji english native }
    description(asHtml: false)
    coverImage { extraLarge }
    bannerImage
    averageScore
    popularity
    seasonYear
    season
    format
    status
    episodes
    duration
    genres
    tags { name rank }
    studios(sort: FAVOURITES_DESC) {
      nodes { name isAnimationStudio }
    }
    staff(sort: RELEVANCE, perPage: 8) {
      nodes {
        name { full }
        primaryOccupations
      }
    }
    characters(sort: ROLE, perPage: 15) {
      edges {
        role
        node { name { full } image { medium } }
        voiceActors(language: JAPANESE) { name { full } image { medium } }
      }
    }
    recommendations(sort: RATING_DESC, perPage: 12) {
      nodes {
        mediaRecommendation {
          id
          title { romaji english }
          coverImage { large }
          averageScore
          seasonYear
          genres
        }
      }
    }
    trailer { id site thumbnail }
    relations {
      nodes {
        id
        title { romaji english }
        type
        format
      }
    }
  }
}`;

// ─── Format helpers ───

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    FINISHED: "Finished",
    RELEASING: "Airing",
    NOT_YET_RELEASED: "Upcoming",
    CANCELLED: "Cancelled",
    HIATUS: "On Hiatus",
  };
  return map[status] || status;
}

function formatSeason(season: string | null): string {
  if (!season) return "";
  const map: Record<string, string> = {
    WINTER: "Winter",
    SPRING: "Spring",
    SUMMER: "Summer",
    FALL: "Fall",
  };
  return map[season] || season;
}

// ─── Main fetch ───

export async function getAnimeDetail(id: number): Promise<AnimeDetail | null> {
  try {
    const res = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query: DETAIL_QUERY, variables: { id } }),
      next: { revalidate: 3600 },
    });

    if (!res.ok) return null;
    const json = await res.json();
    const m = json.data?.Media;
    if (!m) return null;

    // Characters with voice actors
    const characters = (m.characters?.edges || []).map((e: any) => ({
      name: e.node?.name?.full || "Unknown",
      role: e.role || "",
      voiceActor: e.voiceActors?.[0]?.name?.full || "",
      image: e.node?.image?.medium || null,
    }));

    // Staff (directors, writers, etc.)
    const staff = (m.staff?.nodes || []).map((s: any) => ({
      name: s.name?.full || "Unknown",
      role: (s.primaryOccupations || [])[0] || "Staff",
    }));

    // Studios
    const studios = (m.studios?.nodes || [])
      .filter((s: any) => s.isAnimationStudio)
      .map((s: any) => s.name);

    // Recommendations
    const recommendations: AnimeRecItem[] = (m.recommendations?.nodes || [])
      .map((n: any) => {
        const r = n.mediaRecommendation;
        if (!r) return null;
        return {
          id: r.id,
          title: r.title?.english || r.title?.romaji || "Unknown",
          poster: r.coverImage?.large || null,
          rating: Math.round((r.averageScore / 10) * 10) / 10 || 0,
          year: r.seasonYear || 0,
          genres: (r.genres || []).slice(0, 4),
        };
      })
      .filter(Boolean);

    // Relations (sequels, prequels, side stories)
    const relations = (m.relations?.nodes || [])
      .filter((r: any) => r.type === "ANIME")
      .map((r: any) => ({
        id: r.id,
        title: r.title?.english || r.title?.romaji || "Unknown",
        type: r.type || "ANIME",
        format: r.format || "",
      }));

    // Trailer
    const trailer = m.trailer?.site === "youtube" ? {
      id: m.trailer.id,
      site: "YouTube",
    } : null;

    // Tags (top 8, no spoilers)
    const tags = (m.tags || [])
      .filter((t: any) => !t.isGeneralSpoiler && !t.isMediaSpoiler)
      .sort((a: any, b: any) => b.rank - a.rank)
      .slice(0, 8)
      .map((t: any) => ({ name: t.name, rank: t.rank }));

    return {
      id: m.id,
      title: m.title?.english || m.title?.romaji || "Unknown",
      titleRomaji: m.title?.romaji || "",
      titleNative: m.title?.native || "",
      overview: (m.description || "").replace(/<br\s*\/?>/gi, " ").replace(/ {2,}/g, " ").trim(),
      poster: m.coverImage?.extraLarge || null,
      backdrop: m.bannerImage || null,
      rating: Math.round(((m.averageScore || 0) / 10) * 10) / 10,
      popularity: m.popularity || 0,
      year: m.seasonYear || 0,
      season: formatSeason(m.season),
      format: m.format || "TV",
      status: formatStatus(m.status),
      episodes: m.episodes || 0,
      duration: m.duration || 0,
      genres: m.genres || [],
      tags,
      studios,
      staff,
      characters,
      recommendations,
      trailer,
      relations,
    };
  } catch {
    return null;
  }
}
