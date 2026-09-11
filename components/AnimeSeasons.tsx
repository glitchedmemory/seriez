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

  // Collapse "Part N" splits into ONE season. This must happen HERE (on the full
  // list including the current item) because enrichAnimeRelations excludes the
  // currentId — so "Season 2" (current, on its own page) and "Season 2 Part 2"
  // (a neighbor) only meet in this component. Group by title with any
  // " Part N" suffix stripped, keep one representative per group (prefer the
  // entry WITHOUT a Part suffix, then the current item, then the earliest).
  const stripPart = (t: string) => t.replace(/\s+Part\s+\d+\s*$/i, "").trim();
  const groups = new Map<string, { id: number; title: string; seasonYear: number | null; isOriginal?: boolean }[]>();
  const groupOrder: string[] = [];
  for (const item of uniqueItems) {
    const base = stripPart(item.title);
    if (!groups.has(base)) { groups.set(base, []); groupOrder.push(base); }
    groups.get(base)!.push(item);
  }
  const items: { id: number; title: string; seasonYear: number | null; isOriginal?: boolean }[] = [];
  for (const base of groupOrder) {
    const entries = groups.get(base)!;
    // Prefer the entry that is the current page; else the one without " Part N";
    // else the first (BFS order).
    const rep =
      entries.find(e => e.id === currentId) ||
      entries.find(e => !/\s+Part\s+\d+\s*$/i.test(e.title)) ||
      entries[0];
    items.push(rep);
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
