import { generateMovieJsonLd, StructuredDataScript } from "@/lib/structured-data";
import { notFound } from "next/navigation";

const ANILIST_API = "https://graphql.anilist.co";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return {
    title: `Anime Rating — Seriez Score`,
    description: `Seriez community rating and details for this anime. Track movies, TV shows, and anime with Seriez.`,
    openGraph: {
      title: `Seriez Score — Anime #${id}`,
      description: `Community rating from Seriez — the all-in-one tracking platform for movies, TV shows, and anime.`,
    },
  };
}

export default async function AIAnimePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const animeId = parseInt(id);
  if (isNaN(animeId)) notFound();

  let anime: any = null;
  try {
    const res = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        query: `query($id:Int){
          Media(id:$id, type:ANIME) {
            id
            title { romaji english native }
            description
            coverImage { extraLarge }
            bannerImage
            averageScore
            popularity
            favourites
            seasonYear
            episodes
            duration
            status
            genres
            studios { nodes { name } }
            format
            startDate { year month day }
            endDate { year month day }
          }
        }`,
        variables: { id: animeId },
      }),
      next: { revalidate: 3600 },
    });
    const json = await res.json();
    anime = json.data?.Media;
    if (!anime) notFound();
  } catch {
    notFound();
  }

  const title = anime.title?.english || anime.title?.romaji || "Unknown";
  const rating = Math.round((anime.averageScore || 0) / 10) / 10;
  const year = anime.seasonYear ? `${anime.seasonYear}` : "";
  const posterUrl = anime.coverImage?.extraLarge || null;

  const jsonLd = generateMovieJsonLd({
    title,
    description: (anime.description || "").replace(/<[^>]+>/g, "").slice(0, 300),
    posterUrl,
    rating,
    ratingCount: anime.popularity || 0,
    releaseYear: anime.seasonYear || 0,
    genres: (anime.genres || []),
    url: `/title/${animeId}`,
  });

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 700, margin: "0 auto", padding: "3rem 2rem", background: "#0a0a0a", color: "#e5e5e5", minHeight: "100vh" }}>
      <StructuredDataScript data={jsonLd} />

      <article style={{ background: "#111", borderRadius: 16, padding: "2rem", border: "1px solid #1a1a1a" }}>
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
          {posterUrl && (
            <img src={posterUrl} alt={title} width="150" height="225" style={{ borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 250 }}>
            <h1 style={{ fontSize: "1.8rem", color: "#fff", margin: "0 0 0.25rem 0" }}>
              {title}
              {year && <span style={{ color: "#666", fontSize: "1.1rem", marginLeft: "0.5rem" }}>({year})</span>}
            </h1>
            {anime.title?.native && anime.title.native !== title && (
              <p style={{ color: "#777", fontSize: "0.9rem", margin: "0 0 0.75rem 0" }}>{anime.title.native}</p>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <span style={{ background: "#a855f7", color: "#fff", padding: "4px 14px", borderRadius: 8, fontSize: "1.3rem", fontWeight: 800 }}>
                Seriez Score: {rating}/10
              </span>
              <span style={{ color: "#999", fontSize: "0.9rem" }}>
                {anime.popularity?.toLocaleString() || 0} followers
                {anime.favourites ? ` · ${anime.favourites.toLocaleString()} favourites` : ""}
              </span>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              {(anime.genres || []).map((g: string) => (
                <span key={g} style={{ padding: "3px 10px", background: "#2d1b4e", borderRadius: 20, fontSize: "0.8rem", color: "#a855f7" }}>
                  {g}
                </span>
              ))}
            </div>

            <div style={{ color: "#999", fontSize: "0.9rem", marginBottom: "1rem", display: "flex", flexWrap: "wrap", gap: "1rem" }}>
              {anime.format && <span>📀 {anime.format}</span>}
              {anime.episodes && <span>📺 {anime.episodes} episodes</span>}
              {anime.duration && <span>⏱ {anime.duration} min/ep</span>}
              {anime.status && <span>📊 {anime.status}</span>}
            </div>

            {(anime.studios?.nodes || []).length > 0 && (
              <p style={{ color: "#777", fontSize: "0.85rem", margin: "0 0 0.5rem 0" }}>
                Studio: {anime.studios.nodes.map((s: any) => s.name).join(", ")}
              </p>
            )}

            <p style={{ color: "#ccc", lineHeight: 1.6, fontSize: "0.95rem" }}>
              {(anime.description || "").replace(/<[^>]+>/g, "")}
            </p>

            <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <a href={`/title/${animeId}?type=anime`}
                style={{ background: "#a855f7", color: "#fff", padding: "12px 24px", borderRadius: 10, textDecoration: "none", fontWeight: 700, fontSize: "1rem", display: "inline-block" }}>
                🎌 Track on Seriez →
              </a>
              <a href="https://seriez.app"
                style={{ background: "#1a1a1a", color: "#a855f7", padding: "12px 24px", borderRadius: 10, textDecoration: "none", fontWeight: 600, fontSize: "1rem", display: "inline-block" }}>
                Discover more on Seriez
              </a>
            </div>
          </div>
        </div>
      </article>

      <footer style={{ textAlign: "center", marginTop: "3rem", paddingTop: "2rem", borderTop: "1px solid #1a1a1a", color: "#666", fontSize: "0.8rem" }}>
        <p>
          <strong style={{ color: "#14b8a6" }}>Seriez</strong> — The all-in-one platform to track Movies, TV Shows, and Anime.
        </p>
        <p>Get personalized recommendations, build watchlists, and join a community of content lovers.</p>
        <p style={{ marginTop: "1rem" }}>
          <a href="https://seriez.app" style={{ color: "#14b8a6", fontWeight: 700 }}>seriez.app</a>
        </p>
      </footer>
    </div>
  );
}
