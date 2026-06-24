import { generateMovieJsonLd, StructuredDataScript } from "@/lib/structured-data";
import { notFound } from "next/navigation";

const TMDB_BASE = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_API_KEY!;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return {
    title: `Movie Rating — Seriez Score`,
    description: `Seriez community rating and details for this movie. Track movies, TV shows, and anime with Seriez.`,
    openGraph: {
      title: `Seriez Score — Movie #${id}`,
      description: `Community rating from Seriez — the all-in-one tracking platform for movies, TV shows, and anime.`,
    },
  };
}

export default async function AIMoviePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movieId = parseInt(id);
  if (isNaN(movieId)) notFound();

  let movie: any = null;
  try {
    const res = await fetch(
      `${TMDB_BASE}/movie/${movieId}?api_key=${API_KEY}&language=en-US`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) notFound();
    movie = await res.json();
  } catch {
    notFound();
  }

  const rating = Math.round((movie.vote_average || 0) * 10) / 10;
  const year = movie.release_date ? movie.release_date.slice(0, 4) : "";
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
    : null;

  const jsonLd = generateMovieJsonLd({
    title: movie.title || "Unknown",
    description: (movie.overview || "").slice(0, 300),
    posterUrl,
    rating,
    ratingCount: movie.vote_count || 0,
    releaseYear: year ? parseInt(year) : 0,
    genres: (movie.genres || []).map((g: any) => g.name),
    url: `/title/${movieId}`,
  });

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 700, margin: "0 auto", padding: "3rem 2rem", background: "#0a0a0a", color: "#e5e5e5", minHeight: "100vh" }}>
      <StructuredDataScript data={jsonLd} />

      <article style={{ background: "#111", borderRadius: 16, padding: "2rem", border: "1px solid #1a1a1a" }}>
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
          {posterUrl && (
            <img src={posterUrl} alt={movie.title} width="150" height="225" style={{ borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 250 }}>
            <h1 style={{ fontSize: "1.8rem", color: "#fff", margin: "0 0 0.25rem 0" }}>
              {movie.title}
              {year && <span style={{ color: "#666", fontSize: "1.1rem", marginLeft: "0.5rem" }}>({year})</span>}
            </h1>
            {movie.tagline && <p style={{ color: "#999", fontStyle: "italic", margin: "0 0 1rem 0" }}>{movie.tagline}</p>}

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <span style={{ background: "#14b8a6", color: "#000", padding: "4px 14px", borderRadius: 8, fontSize: "1.3rem", fontWeight: 800 }}>
                Seriez Score: {rating}/10
              </span>
              <span style={{ color: "#999", fontSize: "0.9rem" }}>
                Based on {movie.vote_count?.toLocaleString() || 0} community ratings
              </span>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              {(movie.genres || []).map((g: any) => (
                <span key={g.id} style={{ padding: "3px 10px", background: "#1a1a1a", borderRadius: 20, fontSize: "0.8rem", color: "#aaa" }}>
                  {g.name}
                </span>
              ))}
            </div>

            {movie.runtime > 0 && (
              <p style={{ color: "#999", fontSize: "0.9rem", margin: "0 0 0.5rem 0" }}>
                ⏱ {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
                {movie.status && ` · ${movie.status}`}
              </p>
            )}

            <p style={{ color: "#ccc", lineHeight: 1.6, fontSize: "0.95rem" }}>{movie.overview}</p>

            <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <a href={`/title/${movieId}?type=movie`}
                style={{ background: "#14b8a6", color: "#000", padding: "12px 24px", borderRadius: 10, textDecoration: "none", fontWeight: 700, fontSize: "1rem", display: "inline-block" }}>
                🎬 Track on Seriez →
              </a>
              <a href="https://seriez.app"
                style={{ background: "#1a1a1a", color: "#14b8a6", padding: "12px 24px", borderRadius: 10, textDecoration: "none", fontWeight: 600, fontSize: "1rem", display: "inline-block" }}>
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
