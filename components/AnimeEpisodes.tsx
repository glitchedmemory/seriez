import type { AnimeEpisode } from "@/lib/anilist";

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function AnimeEpisodes({ episodes }: { episodes: AnimeEpisode[] }) {
  if (episodes.length === 0) return null;

  return (
    <div className="mt-8 px-4 md:px-0">
      <h2 className="text-lg font-semibold text-text-primary mb-3">Episodes · {episodes.length}</h2>
      <div className="space-y-2">
        {episodes.slice(0, 10).map((ep) => (
          <div key={ep.number} className="flex items-start gap-4 bg-bg-card border border-border rounded-xl p-4">
            {ep.thumbnail ? (
              <img src={ep.thumbnail} alt={ep.title} className="w-32 h-18 rounded-lg object-cover flex-shrink-0" loading="lazy" />
            ) : (
              <div className="w-32 h-18 rounded-lg bg-bg-surface flex-shrink-0 flex items-center justify-center text-text-secondary text-xs">
                Ep {ep.number}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-accent">{ep.number}</span>
                <h3 className="text-sm font-medium text-text-primary truncate">{ep.title}</h3>
              </div>
              {ep.titleJapanese && (
                <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-1">{ep.titleJapanese}</p>
              )}
              <div className="flex items-center gap-3 mt-1 text-[10px] text-text-secondary">
                {ep.airDate && <span>{formatDate(ep.airDate)}</span>}
                {ep.duration > 0 && <span>{ep.duration}m</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
      {episodes.length > 10 && (
        <p className="text-xs text-text-secondary mt-3 text-center">
          + {episodes.length - 10} more episodes
        </p>
      )}
    </div>
  );
}
