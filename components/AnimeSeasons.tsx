type Relation = { id: number; title: string; type: string; format: string; seasonYear: number | null };

export default function AnimeSeasons({ relations, currentId }: { relations: Relation[]; currentId: number }) {
  if (relations.length === 0) return null;

  // Sort by year then title
  const sorted = [...relations].sort((a, b) => (a.seasonYear || 0) - (b.seasonYear || 0) || a.title.localeCompare(b.title));

  return (
    <div className="mt-8 px-4 md:px-0">
      <h2 className="text-lg font-semibold text-text-primary mb-3">Seasons</h2>
      <div className="flex flex-wrap gap-2">
        {sorted.map((r) => (
          <a
            key={r.id}
            href={`/title/${r.id}?type=anime`}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors border ${
              r.id === currentId
                ? "bg-accent/20 text-accent border-accent/40"
                : "bg-bg-card text-text-secondary border-border hover:border-accent/30 hover:text-text-primary"
            }`}
          >
            {r.seasonYear ? `S${r.seasonYear}` : r.title}
          </a>
        ))}
      </div>
    </div>
  );
}
