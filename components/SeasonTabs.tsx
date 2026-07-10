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
            href={`/title/${seriesId}/season/${n}`}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              n === currentSeason
                ? "bg-accent text-white cursor-default pointer-events-none shadow-md"
                : "bg-bg-card text-text-secondary border border-border hover:bg-accent/10 hover:text-text-primary hover:border-accent/30"
            }`}
          >
            S{n}
          </a>
        ))}
      </div>
    </div>
  );
}
