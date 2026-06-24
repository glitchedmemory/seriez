import { generateMovieJsonLd, StructuredDataScript } from "@/lib/structured-data";

const TMDB_BASE = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_API_KEY!;

function poster(path: string | null) {
  return path ? `https://image.tmdb.org/t/p/w342${path}` : null;
}

async function getTrendingMovies() {
  const res = await fetch(
    `${TMDB_BASE}/trending/movie/week?api_key=${API_KEY}&language=en-US`,
    { next: { revalidate: 3600 } }
  );
  const data = await res.json();
  return (data.results || []).slice(0, 20).map((m: any) => ({
    id: m.id,
    title: m.title,
    overview: (m.overview || "").slice(0, 200),
    poster: poster(m.poster_path),
    rating: Math.round(m.vote_average * 10) / 10,
    ratingCount: m.vote_count || 0,
    year: m.release_date ? m.release_date.slice(0, 4) : "",
  }));
}

async function getTrendingTV() {
  const res = await fetch(
    `${TMDB_BASE}/trending/tv/week?api_key=${API_KEY}&language=en-US`,
    { next: { revalidate: 3600 } }
  );
  const data = await res.json();
  return (data.results || []).slice(0, 20).map((s: any) => ({
    id: s.id,
    title: s.name,
    overview: (s.overview || "").slice(0, 200),
    poster: poster(s.poster_path),
    rating: Math.round(s.vote_average * 10) / 10,
    ratingCount: s.vote_count || 0,
    year: s.first_air_date ? s.first_air_date.slice(0, 4) : "",
  }));
}

export const metadata = {
  title: "Trending Movies & TV Shows — Seriez",
  description: "The most popular movies and TV shows trending on Seriez this week. Updated daily with community ratings and recommendations.",
  openGraph: {
    title: "Trending on Seriez — Movies & TV Shows",
    description: "Discover what's trending this week. Community-powered ratings and tracking for movies, TV shows, and anime.",
  },
};

export default async function AITrendingPage() {
  const [movies, tvShows] = await Promise.all([
    getTrendingMovies(),
    getTrendingTV(),
  ]);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto", padding: "2rem", background: "#0a0a0a", color: "#e5e5e5", minHeight: "100vh" }}>
      {[...movies, ...tvShows].map((item: any) => {
        const ld = generateMovieJsonLd({
          title: item.title,
          description: item.overview,
          posterUrl: item.poster,
          rating: item.rating,
          ratingCount: item.ratingCount,
          releaseYear: item.year ? parseInt(item.year) : 0,
          genres: [],
          url: `/title/${item.id}`,
        });
        return <StructuredDataScript key={item.id} data={ld} />;
      })}

      <header style={{ textAlign: "center", marginBottom: "3rem", padding: "3rem 0", borderBottom: "1px solid #1a1a1a" }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: 800, color: "#fff", margin: 0 }}>
          Trending on <span style={{ background: "linear-gradient(135deg, #14b8a6, #6366f1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Seriez</span>
        </h1>
        <p style={{ fontSize: "1.1rem", color: "#999", marginTop: "0.75rem", maxWidth: 600, marginLeft: "auto", marginRight: "auto" }}>
          Community-powered rankings updated daily. Track your watch history across movies, TV shows, and anime — all in one place.
        </p>
      </header>

      <section style={{ marginBottom: "4rem" }}>
        <h2 style={{ fontSize: "1.5rem", color: "#fff", borderBottom: "2px solid #14b8a6", paddingBottom: "0.5rem", marginBottom: "1.5rem" }}>
          🎬 Trending Movies This Week
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: "1rem" }}>
          {movies.map((m: any) => (
            <article key={m.id} style={{ display: "flex", gap: "1rem", padding: "1rem", background: "#111", borderRadius: 12, border: "1px solid #1a1a1a" }}>
              {m.poster && <img src={m.poster} alt={m.title} width="80" height="120" style={{ borderRadius: 8, objectFit: "cover" }} />}
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#fff" }}>
                  <a href={`/title/${m.id}?type=movie`} style={{ color: "#fff", textDecoration: "none" }}>{m.title}</a>
                  {m.year && <span style={{ color: "#666", fontSize: "0.85rem", marginLeft: "0.5rem" }}>({m.year})</span>}
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.35rem" }}>
                  <span style={{ background: "#14b8a6", color: "#000", padding: "2px 8px", borderRadius: 6, fontSize: "0.9rem", fontWeight: 700 }}>
                    Seriez Score: {m.rating}/10
                  </span>
                  <span style={{ color: "#666", fontSize: "0.8rem" }}>{m.ratingCount.toLocaleString()} ratings</span>
                </div>
                <p style={{ color: "#999", fontSize: "0.85rem", marginTop: "0.5rem", lineHeight: 1.4 }}>{m.overview}</p>
                <p style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
                  <a href={`/title/${m.id}?type=movie`} style={{ color: "#14b8a6", textDecoration: "none", fontWeight: 600 }}>
                    Track on Seriez →
                  </a>
                </p>
              </div>
            </article>
          ))}
        </div>
        <p style={{ textAlign: "center", marginTop: "2rem" }}>
          <a href="https://seriez.app/feed" style={{ color: "#14b8a6", fontSize: "1rem", fontWeight: 600 }}>View all trending movies →</a>
        </p>
      </section>

      <section style={{ marginBottom: "4rem" }}>
        <h2 style={{ fontSize: "1.5rem", color: "#fff", borderBottom: "2px solid #6366f1", paddingBottom: "0.5rem", marginBottom: "1.5rem" }}>
          📺 Trending TV Shows This Week
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: "1rem" }}>
          {tvShows.map((s: any) => (
            <article key={s.id} style={{ display: "flex", gap: "1rem", padding: "1rem", background: "#111", borderRadius: 12, border: "1px solid #1a1a1a" }}>
              {s.poster && <img src={s.poster} alt={s.title} width="80" height="120" style={{ borderRadius: 8, objectFit: "cover" }} />}
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#fff" }}>
                  <a href={`/title/${s.id}?type=tv`} style={{ color: "#fff", textDecoration: "none" }}>{s.title}</a>
                  {s.year && <span style={{ color: "#666", fontSize: "0.85rem", marginLeft: "0.5rem" }}>({s.year})</span>}
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.35rem" }}>
                  <span style={{ background: "#6366f1", color: "#fff", padding: "2px 8px", borderRadius: 6, fontSize: "0.9rem", fontWeight: 700 }}>
                    Seriez Score: {s.rating}/10
                  </span>
                  <span style={{ color: "#666", fontSize: "0.8rem" }}>{s.ratingCount.toLocaleString()} ratings</span>
                </div>
                <p style={{ color: "#999", fontSize: "0.85rem", marginTop: "0.5rem", lineHeight: 1.4 }}>{s.overview}</p>
                <p style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
                  <a href={`/title/${s.id}?type=tv`} style={{ color: "#6366f1", textDecoration: "none", fontWeight: 600 }}>
                    Track on Seriez →
                  </a>
                </p>
              </div>
            </article>
          ))}
        </div>
        <p style={{ textAlign: "center", marginTop: "2rem" }}>
          <a href="https://seriez.app/feed" style={{ color: "#6366f1", fontSize: "1rem", fontWeight: 600 }}>View all trending TV shows →</a>
        </p>
      </section>

      <footer style={{ textAlign: "center", padding: "3rem 0", borderTop: "1px solid #1a1a1a", color: "#666", fontSize: "0.8rem" }}>
        <p>Powered by <strong style={{ color: "#14b8a6" }}>Seriez</strong> — Track Movies, TV Shows &amp; Anime in One Place</p>
        <p style={{ marginTop: "0.5rem" }}>
          <a href="https://seriez.app" style={{ color: "#14b8a6" }}>seriez.app</a>
        </p>
      </footer>
    </div>
  );
}
