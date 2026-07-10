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
  // Combine relations + current item
  const allItems: { id: number; title: string; seasonYear: number | null; isOriginal: boolean }[] = [
    ...relations.map(r => ({ id: r.id, title: r.title, seasonYear: r.seasonYear, isOriginal: r.isOriginal })),
    { id: currentId, title: currentTitle, seasonYear: currentYear || null, isOriginal: false },
  ];

  // The original is the relation marked isOriginal=true, or the earliest-year item
  let original = relations.find(r => r.isOriginal);
  if (!original) {
    // Fallback: earliest year among all (including current)
    let earliestYear = currentYear || Infinity;
    let earliestItem = allItems[allItems.length - 1]; // current item is last
    for (const item of allItems) {
      const y = item.seasonYear;
      if (y !== null && y < earliestYear) { earliestYear = y; earliestItem = item; }
    }
    original = earliestItem ? { id: earliestItem.id, title: earliestItem.title, type: "ANIME", format: "TV", seasonYear: earliestItem.seasonYear, isOriginal: true } : null;
  }

  const originalId = original?.id ?? currentId;

  // Sequels: all TV relations EXCEPT the original, sorted by year
  const sequels = allItems
    .filter(item => item.id !== originalId)
    .sort((a, b) => (a.seasonYear || 0) - (b.seasonYear || 0));

  if (!original && sequels.length <= 1) return null;

  return (
    <div className="mt-8 px-4 md:px-0">
      <h2 className="text-lg font-semibold text-text-primary mb-3">Seasons</h2>
      <div className="flex flex-wrap gap-2">
        {/* Original button — always first, full title */}
        {original && (
          <a
            key={original.id}
            href={`/title/${original.id}?type=anime`}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              original.id === currentId
                ? "bg-accent text-white cursor-default pointer-events-none shadow-md"
                : "bg-bg-card text-text-secondary border border-border hover:bg-accent/10 hover:text-text-primary hover:border-accent/30"
            }`}
          >
            {original.title}
          </a>
        )}

        {/* Numbered sequels: S1, S2, ... */}
        {sequels.map((item, i) => (
          <a
            key={item.id}
            href={`/title/${item.id}?type=anime`}
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
