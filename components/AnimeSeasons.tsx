type Relation = {
  id: number;
  title: string;
  type: string;
  format: string;
  seasonYear: number | null;
  status?: string;
  isOriginal?: boolean;
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
  // Combine relations + current item. Preserve isOriginal so the sort below can
  // pin the earliest season (season 1) to the front.
  const allItems: { id: number; title: string; seasonYear: number | null; isOriginal?: boolean }[] = [
    ...relations.map(r => ({ id: r.id, title: r.title, seasonYear: r.seasonYear, isOriginal: r.isOriginal })),
    { id: currentId, title: currentTitle, seasonYear: currentYear || null, isOriginal: true },
  ];

  // Deduplicate by id
  const seen = new Set<number>();
  const uniqueItems = allItems.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  // Collapse "Part N" splits (e.g. "Attack on Titan Final Season" + "Final Season
  // Part 2", "Alicization - War of Underworld" + "... Part 2") into ONE entry, so
  // the Season list matches the official season count. An entry is a "part" of the
  // previous one when its title starts with the other's title + "Part".
  const items: { id: number; title: string; seasonYear: number | null; isOriginal?: boolean }[] = [];
  for (const item of uniqueItems) {
    const prev = items[items.length - 1];
    const isPart = prev && (
      item.title.startsWith(prev.title + " Part") ||
      item.title.startsWith(prev.title.split(" Part")[0] + " Part")
    );
    if (isPart) {
      // Collapse into the previous entry (keep current if it's the current item).
      if (item.id === currentId) items[items.length - 1] = { ...item };
      continue;
    }
    items.push(item);
  }

  // Sort by airing year (ascending). enrichAnimeRelations walks the SEQUEL/
  // PREQUEL graph via BFS, so its return order is a traversal order (season 2's
  // neighbors, etc.) — NOT a chronological season order. Sorting by seasonYear
  // yields the correct S1 → S2 → ... → Final order regardless of which season
  // is the current one. Items with no year (null) go last.
  const byYear = (a: { seasonYear: number | null }, b: { seasonYear: number | null }) =>
    (a.seasonYear ?? Number.MAX_SAFE_INTEGER) - (b.seasonYear ?? Number.MAX_SAFE_INTEGER);
  items.sort(byYear);

  if (items.length <= 1) return null;

  return (
    <div className="mt-8 px-4 md:px-0">
      <h2 className="text-lg font-semibold text-text-primary mb-3">Seasons</h2>
      <div className="flex flex-wrap gap-2">
        {items.map((item, idx) => {
          // Always render labels as sequential S1, S2, S3... (match the sorted order).
          // This keeps the label text uniform even for entries whose title has no
          // clean "Season N" (e.g. "Final Season" → last position → "S4").
          const label = `S${idx + 1}`;
          return (
            <a
              key={item.id}
              href={`/anime/${item.id}`}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                item.id === currentId
                  ? "bg-accent text-white cursor-default pointer-events-none shadow-md"
                  : "bg-bg-card text-text-secondary border border-border hover:bg-accent/10 hover:text-text-primary hover:border-accent/30"
              }`}
            >
              {label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
