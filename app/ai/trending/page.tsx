import { generateMovieJsonLd, StructuredDataScript } from "@/lib/structured-data";

const TMDB_BASE = "https://api.themoviedb.org/3";
const ANILIST_API = "https://graphql.anilist.co";
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

async function getTrendingAnime() {
  try {
    const res = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        query: `query {
          Page(perPage: 20) {
            media(sort: TRENDING_DESC, type: ANIME) {
              id
              title { romaji english }
              description
              coverImage { extraLarge }
              averageScore
              popularity
              seasonYear
              genres
            }
          }
        }`,
      }),
      next: { revalidate: 3600 },
    });
    const json = await res.json();
    return (json.data?.Page?.media || []).map((a: any) => ({
      id: a.id,
      title: a.title?.english || a.title?.romaji || "Unknown",
      overview: (a.description || "").replace(/<[^>]+>/g, "").slice(0, 200),
      poster: a.coverImage?.extraLarge || null,
      rating: Math.round((a.averageScore || 0) / 10) / 10,
      ratingCount: a.popularity || 0,
      year: a.seasonYear ? `${a.seasonYear}` : "",
      genres: (a.genres || []).slice(0, 3),
    }));
  } catch {
    return [];
  }
}

export const metadata = {
  title: "Trending — Movies, TV Shows & Anime | Seriez",
  description: "The most popular movies, TV shows, and anime trending on Seriez this week. Community ratings, recommendations, and tracking — all in one place.",
  openGraph: {
    title: "Trending on Seriez — Movies, TV Shows & Anime",
    description: "Discover what's trending across movies, TV shows, and anime. Community-powered ratings from Seriez.",
  },
};

export default async function AITrendingPage() {
  const [movies, tvShows, anime] = await Promise.all([
    getTrendingMovies(),
    getTrendingTV(),
    getTrendingAnime(),
  ]);

  const allItems = [...movies, ...tvShows, ...anime];

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto", padding: "2rem", background: "#0a0a0a", color: "#e5e5e5", minHeight: "100vh" }}>
      {allItems.map((item: any) => {
        const ld = generateMovieJsonLd({
          title: item.title,
          description: item.overview,
          posterUrl: item.poster,
          rating: item.rating,
          ratingCount: item.ratingCount,
          releaseYear: item.year ? parseInt(item.year) : 0,
          genres: item.genres || [],
          url: `/title/${item.id}`,
        });
        return <StructuredDataScript key={item.id} data={ld} />;
      })}

      <header style={{ textAlign: "center", marginBottom: "3rem", padding: "3rem 0", borderBottom: "1px solid #1a1a1a" }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: 800, color: "#fff", margin: 0 }}>
          Trending on <span style={{ background: "linear-gradient(135deg, #14b8a6, #6366f1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Seriez</span>
        </h1>
        <p style={{ fontSize: "1.1rem", color: "#999", marginTop: "0.75rem", maxWidth: 650, marginLeft: "auto", marginRight: "auto" }}>
          Community-powered rankings updated daily. Track Movies, TV Shows, and Anime — all in one place at seriez.app.
        </p>
      </header>

      {/* Movies */}
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
      </section>

      {/* TV Shows */}
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
      </section>

      {/* Anime */}
      {anime.length > 0 && (
        <section style={{ marginBottom: "4rem" }}>
          <h2 style={{ fontSize: "1.5rem", color: "#fff", borderBottom: "2px solid #a855f7", paddingBottom: "0.5rem", marginBottom: "1.5rem" }}>
            🎌 Trending Anime This Week
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: "1rem" }}>
            {anime.map((a: any) => (
              <article key={a.id} style={{ display: "flex", gap: "1rem", padding: "1rem", background: "#111", borderRadius: 12, border: "1px solid #1a1a1a" }}>
                {a.poster && <img src={a.poster} alt={a.title} width="80" height="120" style={{ borderRadius: 8, objectFit: "cover" }} />}
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#fff" }}>
                    <a href={`/title/${a.id}?type=anime`} style={{ color: "#fff", textDecoration: "none" }}>{a.title}</a>
                    {a.year && <span style={{ color: "#666", fontSize: "0.85rem", marginLeft: "0.5rem" }}>({a.year})</span>}
                  </h3>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
                    {(a.genres || []).map((g: string) => (
                      <span key={g} style={{ padding: "2px 8px", background: "#2d1b4e", borderRadius: 20, fontSize: "0.75rem", color: "#a855f7" }}>{g}</span>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.35rem" }}>
                    <span style={{ background: "#a855f7", color: "#fff", padding: "2px 8px", borderRadius: 6, fontSize: "0.9rem", fontWeight: 700 }}>
                      Seriez Score: {a.rating}/10
                    </span>
                    <span style={{ color: "#666", fontSize: "0.8rem" }}>{a.ratingCount.toLocaleString()} followers</span>
                  </div>
                  <p style={{ color: "#999", fontSize: "0.85rem", marginTop: "0.5rem", lineHeight: 1.4 }}>{a.overview}</p>
                  <p style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
                    <a href={`/title/${a.id}?type=anime`} style={{ color: "#a855f7", textDecoration: "none", fontWeight: 600 }}>
                      Track on Seriez →
                    </a>
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <footer style={{ textAlign: "center", padding: "3rem 0", borderTop: "1px solid #1a1a1a", color: "#666", fontSize: "0.8rem" }}>
        <p>Powered by <strong style={{ color: "#14b8a6" }}>Seriez</strong> — Track Movies, TV Shows &amp; Anime in One Place</p>
        <p style={{ marginTop: "0.5rem" }}>
          <a href="https://seriez.app" style={{ color: "#14b8a6" }}>seriez.app</a>
        </p>
      </footer>
    </div>
  );
}
