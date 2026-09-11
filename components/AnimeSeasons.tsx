type Relation = {
  id: number;
  title: string;
  type: string;
  format: string;
  seasonYear: number | null;
  status?: string;
  isOriginal?: boolean;
};

// Try to extract an explicit season number from the title, e.g.
// "OSHI NO KO" -> 1, "... 2nd Season" -> 2, "Season 3" -> 3, "Final Season" -> Infinity
function seasonNumberFromTitle(title: string): number | null {
  if (!title) return null;
  const t = title.replace(/[«»\[\]【】]/g, "").trim();
  // "Season N" / "N Season" (e.g. "Season 2", "2nd Season")
  let m = t.match(/\b(?:season)\s+(\d+)\b/i);
  if (m) return parseInt(m[1], 10);
  m = t.match(/\b(\d+)(?:st|nd|rd|th)\s+season\b/i);
  if (m) return parseInt(m[1], 10);
  // "Final Season", "Final Season Part 2", "Final Chapters", "Last Season"
  // → treat as the last one (very large number, resolved by sorting).
  if (/\bfinal\b|\blast season\b/i.test(t)) return Number.MAX_SAFE_INTEGER;
  // ordinal like "2nd", "3rd" at the end (e.g. "Something 3rd")
  m = t.match(/(\d+)(?:st|nd|rd|th)\s*$/);
  if (m) return parseInt(m[1], 10);
  // plain trailing number (e.g. "Boku no Hero Academia 2", "Naruto Shippuden 2")
  // → treat as that season number.
  m = t.match(/\s(\d+)\s*$/);
  if (m) return parseInt(m[1], 10);
  // base title with no marker → season 1
  return 1;
}

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
  // Combine relations + current item.
  const allItems: { id: number; title: string; seasonYear: number | null }[] = [
    ...relations.map(r => ({ id: r.id, title: r.title, seasonYear: r.seasonYear })),
    { id: currentId, title: currentTitle, seasonYear: currentYear || null },
  ];

  // Deduplicate by id
  const seen = new Set<number>();
  const uniqueItems = allItems.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  // Resolve a sort key: explicit season number from title > seasonYear > Infinity.
  // Also collapse multiple "parts" of the same season (e.g. "Season 3" + "Season 3
  // Part 2", or "Final Season" + "Final Season Part 2") into ONE entry so the
  // Season list matches the official season count instead of every broadcast part.
  // When collapsing, always prefer the CURRENT item so the active highlight works.
  const bySeason = new Map<number, { id: number; title: string; seasonYear: number | null }>();
  const order: number[] = [];
  for (const item of uniqueItems) {
    const season = seasonNumberFromTitle(item.title);
    const key = season ?? Number.MAX_SAFE_INTEGER;
    const existing = bySeason.get(key);
    if (!existing) {
      bySeason.set(key, { id: item.id, title: item.title, seasonYear: item.seasonYear });
      order.push(key);
    } else if (item.id === currentId) {
      // The current item always wins its season slot so it stays highlighted.
      const before = order.indexOf(key);
      bySeason.set(key, { id: item.id, title: item.title, seasonYear: item.seasonYear });
      // keep original order position
      order[before] = key;
    }
  }

  const items = order
    .map(key => bySeason.get(key)!)
    .sort((a, b) => {
      const as = seasonNumberFromTitle(a.title) ?? (a.seasonYear || Number.MAX_SAFE_INTEGER);
      const bs = seasonNumberFromTitle(b.title) ?? (b.seasonYear || Number.MAX_SAFE_INTEGER);
      return as - bs;
    });

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
