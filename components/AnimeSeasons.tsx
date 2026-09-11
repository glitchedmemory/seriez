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
// "OSHI NO KO" -> 1, "... 2nd Season" -> 2, "Season 3" -> 3.
// Titles that carry no explicit number (subtitled seasons like "Sword Art Online:
// Alicization", or roman-numeral "Sword Art Online II") return null so the sort
// falls back to seasonYear ordering.
function seasonNumberFromTitle(title: string): number | null {
  if (!title) return null;
  const t = title.replace(/[«»\[\]【】]/g, "").trim();
  // "Season N" / "Nth Season" (e.g. "Season 2", "2nd Season", "3rd Season")
  let m = t.match(/\b(?:season)\s+(\d+)\b/i);
  if (m) return parseInt(m[1], 10);
  m = t.match(/\b(\d+)(?:st|nd|rd|th)\s+season\b/i);
  if (m) return parseInt(m[1], 10);
  // "Final Season", "Final Chapters", "Last Season" → sort to the very end.
  if (/\bfinal\b|\blast season\b/i.test(t)) return Number.MAX_SAFE_INTEGER;
  // trailing ordinal ("Something 3rd") or plain number ("... Academia 2")
  m = t.match(/(\d+)(?:st|nd|rd|th)\s*$/);
  if (m) return parseInt(m[1], 10);
  m = t.match(/\s(\d+)\s*$/);
  if (m) return parseInt(m[1], 10);
  // roman numeral suffix ("Sword Art Online II", "... III") → 2, 3, ...
  m = t.match(/\b(II|III|IV|V|VI|VII|VIII|IX|X)\s*$/i);
  if (m) {
    const roman: Record<string, number> = { II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
    return roman[m[1].toUpperCase()] ?? null;
  }
  // no marker → fall back to year ordering (return null, not 1).
  return null;
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

  // Collapse "Part N" splits (e.g. "Attack on Titan Final Season" + "Final Season
  // Part 2", "Alicization - War of Underworld" + "... Part 2") into ONE entry, so
  // the Season list matches the official season count. An entry is a "part" of the
  // previous one when its title starts with the other's title + "Part".
  const items: { id: number; title: string; seasonYear: number | null }[] = [];
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

  // Sort by explicit season number (title) when available, else by seasonYear.
  const sortKey = (it: { title: string; seasonYear: number | null }) => {
    const s = seasonNumberFromTitle(it.title);
    if (s !== null) return s;
    return it.seasonYear || Number.MAX_SAFE_INTEGER;
  };
  items.sort((a, b) => sortKey(a) - sortKey(b));

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
