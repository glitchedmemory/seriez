import type { TmdbDetail } from "@/lib/tmdb";

/**
 * Movie "Series" section — a franchise navigator matching the TV "Seasons" tab
 * (SeasonTabs.tsx) in both position and style. Each pill shows the movie's real
 * title (TMDB's own title per part), ordered by release date.
 */
export default function MovieSeries({ detail }: { detail: TmdbDetail }) {
  const franchise = detail.franchise;
  if (detail.type !== "movie" || !franchise || franchise.parts.length < 2) return null;

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold text-text-primary mb-3">Series</h2>
      <div className="flex flex-wrap gap-2">
        {franchise.parts.map((p) => {
          const isCurrent = p.id === detail.id;
          return (
            <a
              key={p.id}
              href={`/movie/${p.id}`}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                isCurrent
                  ? "bg-accent text-white cursor-default pointer-events-none shadow-md"
                  : "bg-bg-card text-text-secondary border border-border hover:bg-accent/10 hover:text-text-primary hover:border-accent/30"
              }`}
            >
              {p.title}
            </a>
          );
        })}
      </div>
    </div>
  );
}
