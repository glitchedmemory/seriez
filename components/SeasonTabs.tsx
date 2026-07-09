export default function SeasonTabs({ totalSeasons, currentSeason, seriesId }: {
  totalSeasons: number;
  currentSeason: number;
  seriesId: number;
}) {
  if (totalSeasons <= 1) return null;

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold text-text-primary mb-3">Seasons</h2>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: totalSeasons }, (_, i) => i + 1).map((n) => (
          <a
            key={n}
            href={`/title/${seriesId}/season/${n}?type=tv`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              n === currentSeason
                ? "bg-accent text-white cursor-default pointer-events-none"
                : "bg-bg-card text-text-secondary hover:text-text-primary hover:bg-[#2d2d4a] border border-border hover:border-accent"
            }`}
          >
            S{n}
          </a>
        ))}
      </div>
    </div>
  );
}
