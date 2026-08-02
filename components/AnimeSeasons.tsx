type Relation = {
  id: number;
  title: string;
  type: string;
  format: string;
  seasonYear: number | null;
  isOriginal: boolean;
};

export default function AnimeSeasons({
  relations,
  currentId,
  currentTitle,
  currentYear,
}: {
  relations: Relation[];
  currentId: number;
  currentTitle: string;
  currentYear: number;
}) {
  // Combine relations + current item, sort by year
  const allItems: { id: number; title: string; seasonYear: number | null }[] = [
    ...relations.map(r => ({ id: r.id, title: r.title, seasonYear: r.seasonYear })),
    { id: currentId, title: currentTitle, seasonYear: currentYear || null },
  ].sort((a, b) => (a.seasonYear || 0) - (b.seasonYear || 0));

  // Deduplicate by id
  const seen = new Set<number>();
  const items = allItems.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  if (items.length <= 1) return null;

  return (
    <div className="mt-8 px-4 md:px-0">
      <h2 className="text-lg font-semibold text-text-primary mb-3">Seasons</h2>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <a
            key={item.id}
            href={`/anime/${item.id}`}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              item.id === currentId
                ? "bg-accent text-white cursor-default pointer-events-none shadow-md"
                : "bg-bg-card text-text-secondary border border-border hover:bg-accent/10 hover:text-text-primary hover:border-accent/30"
            }`}
          >
            S{i + 1}
          </a>
        ))}
      </div>
    </div>
  );
}
